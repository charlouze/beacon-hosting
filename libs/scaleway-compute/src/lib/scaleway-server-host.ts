import type {
  Game,
  HostedServer,
  OpenedServer,
  OpenServerRequest,
  ServerHost,
  SessionId,
  UnclaimedSweep,
} from '@beacon/session';
import type { ImageResolver } from './images.js';
import { isDetached, type BlockApi, type ScwBlockVolume } from './block-api.js';
import { BLOCK_VOLUME_TYPE, type InstanceApi, type ScwIp, type ScwServer } from './instance-api.js';
import { serverCreation } from './server-creation.js';
import { OWNERSHIP_TAG, readSessionTag, sessionTag } from './tags.js';

/** How long one close() may wait for the volumes of its session to detach. */
export interface DetachmentWait {
  /**
   * The most one close() spends pausing, in total. It counts the pauses, not
   * the calls between them: the caller's own deadline has to leave room for
   * those.
   */
  readonly budgetMs: number;
  readonly pause: (ms: number) => Promise<void>;
}

/** The disk a server of that game boots on, in gigabytes. */
export type DiskSizing = (game: Game) => number;

/** A block volume detaches 1 to 13 s after its server dies — measured on 2026-10-08. */
const POLL_MS = 1_000;

/** What one round of the wait leaves behind. */
interface VolumeRound {
  /** Refusals that waiting will not cure. */
  readonly refusals: string[];
  readonly stillAttached: string[];
}

interface OwnedResource {
  readonly sessionId: SessionId | null;
  readonly summary: string;
}

/**
 * Exact membership, re-checked on what came back instead of taken on trust
 * from the query. `tags=` was measured exact on the flexible ip and on nothing
 * else, so a `listServers` that matched loosely would hand this component the
 * probe's `beacon-probe` machine as one of ours — and the thing that destroys
 * is the last place to find that out.
 */
const carrying =
  (tag: string) =>
  (resource: { readonly tags: readonly string[] }): boolean =>
    resource.tags.includes(tag);

export class ScalewayServerHost implements ServerHost {
  constructor(
    private readonly api: InstanceApi,
    private readonly block: BlockApi,
    private readonly images: ImageResolver,
    private readonly wait: DetachmentWait,
    private readonly diskGbFor: DiskSizing,
  ) {}

  async open(request: OpenServerRequest): Promise<OpenedServer> {
    // Both tags, from creation (§5). The constant one is what makes "every
    // resource of this system whose session is unknown" a query the api can
    // answer; the session one is what pairs a resource with its intent.
    const tags = [OWNERSHIP_TAG, sessionTag(request.sessionId)];

    // Before anything is created: a game without a disk, or a size without an
    // image, must cost nothing.
    const { game } = request.world;
    const diskGb = this.diskGbFor(game);
    if (!Number.isInteger(diskGb) || diskGb <= 0) {
      throw new Error(`no disk size for ${game}`);
    }
    const creation = await serverCreation(this.images, {
      name: `beacon-${request.sessionId}`,
      commercialType: request.size,
      diskGb,
      tags,
    });
    if (creation === null) {
      throw new Error(`no ubuntu image for ${request.size} on a block volume`);
    }

    const { ip } = await this.api.createIp({ tags });
    if (ip?.address === undefined) {
      throw new Error('createIp returned no address — nothing to announce, nothing to attach');
    }

    // From here on, a failure has already spent money. Every throw names the
    // ip and how it is tagged — the earliest resource created, and enough to
    // find the whole attempt by tag, whatever else did or didn't get created
    // after it. The watchdog reaps all of it within five minutes regardless,
    // which the message does not have to enumerate.
    const created = await this.failing(
      () => this.api.createServer({ ...creation, publicIps: [ip.id] }),
      ip,
      request,
    );
    const server = created.server;
    if (server === undefined) {
      throw new Error(
        `createServer returned no server, and ip ${ip.id} is tagged ${sessionTag(request.sessionId)}`,
      );
    }

    await this.tagRootVolume(server, tags, ip, request);

    // The cloud-init lands before the boot: there is no second chance at
    // first boot, and user data posted after poweron is read by nothing.
    await this.failing(
      () => this.api.setServerUserData({ serverId: server.id, content: request.bootstrap }),
      ip,
      request,
    );
    await this.failing(() => this.api.powerOn({ serverId: server.id }), ip, request);

    return {
      address: ip.address,
      size: request.size,
      references: { instanceId: server.id, ipId: ip.id },
    };
  }

  async list(): Promise<HostedServer[]> {
    const bySession = new Map<SessionId, string[]>();
    for (const resource of await this.owned()) {
      if (resource.sessionId === null) continue;
      const parts = bySession.get(resource.sessionId) ?? [];
      parts.push(resource.summary);
      bySession.set(resource.sessionId, parts);
    }
    return [...bySession].map(([sessionId, parts]) => ({
      sessionId,
      summary: parts.join(', '),
    }));
  }

  async close(sessionId: SessionId): Promise<void> {
    // One tag, not two. The filter is exact — measured — and the behaviour of
    // a conjunction was never measured at all.
    const tag = sessionTag(sessionId);
    const { ips } = await this.api.listIps({ tags: [tag] });
    const { servers } = await this.api.listServers({ tags: [tag] });

    const failures: string[] = [];

    // One try per resource, like everywhere else here. Wrapping the two loops
    // instead is the probe's reaper: the first refusal ended the pass, and
    // whatever came after it lived. The ips go first regardless — a flexible ip
    // outliving its server keeps billing.
    for (const ip of ips.filter(carrying(tag))) {
      try {
        await this.api.deleteIp({ ip: ip.id });
      } catch (error) {
        if (isAlreadyGone(error)) continue;
        failures.push(`ip ${ip.id}: ${String(error)}`);
      }
    }

    // Asked before the servers die, for what already carries the tag, and
    // handed to the wait as its first listing. A refusal is the wait's to
    // report: it asks again.
    const listed = await this.taggedVolumes(tag).catch(() => null);
    const tagged = new Set(listed?.map((volume) => volume.id));

    // Noted before the server dies, and whether or not it does: once it is
    // gone, nothing else ties an untagged block volume to this session.
    const attached = new Set<string>();
    const untagged = new Map<string, string>();
    for (const server of servers.filter(carrying(tag))) {
      for (const volumeId of blockVolumeIdsOf(server)) {
        attached.add(volumeId);
        if (tagged.has(volumeId)) continue;
        // The last moment a tag can still land: should the deletion below
        // fail, the tag is what lets a later close() or the sweep find the
        // volume. A refusal changes nothing to what follows.
        try {
          await this.block.setVolumeTags({ volumeId, tags: [OWNERSHIP_TAG, tag] });
        } catch (error) {
          untagged.set(volumeId, String(error));
        }
      }
      try {
        await this.destroyServer(server);
      } catch (error) {
        if (isAlreadyGone(error)) continue;
        failures.push(`server ${server.id}: ${String(error)}`);
      }
    }

    failures.push(...(await this.destroyBlockVolumes(tag, attached, listed)));

    // Only for a volume that is still there: once its server is gone nothing
    // finds it again, and this message is the last to name it next to its
    // session.
    for (const [volumeId, refusal] of untagged) {
      if (attached.has(volumeId)) failures.push(`volume ${volumeId}: left untagged — ${refusal}`);
    }

    // Aggregated, and it still throws: a rejection is how the watchdog learns
    // the cleanup could not be guaranteed and files CleanupFailed.
    if (failures.length > 0) {
      throw new Error(`failed to close session ${sessionId}: ${failures.join(', ')}`);
    }
  }

  async sweepUnclaimed(): Promise<UnclaimedSweep> {
    // The volumes first, and before any destruction: a disk this very pass is
    // about to orphan is in flight, not stranded. Listing after would report it
    // as abandoned every time a server dies.
    const { volumes } = await this.api.listVolumes();
    // No tag asked for: what is stranded is exactly what carries no tag of
    // ours, and no filter on a tag returns that.
    const detached = (await this.block.listVolumes({})).volumes.filter(isDetached);

    // Detached and carrying the ownership tag: what is left of a game server
    // that is gone, whatever session it was tagged for.
    const ours = carrying(OWNERSHIP_TAG);
    const leftovers = detached.filter(ours);
    const stranded = [
      ...volumes.filter((volume) => volume.server?.id === undefined),
      ...detached.filter((volume) => !ours(volume)),
    ].map((volume) => `volume ${volume.id} (${Math.round(volume.size / 1e9)} GB)`);

    const { servers } = await this.api.listServers({ tags: [OWNERSHIP_TAG] });
    const { ips } = await this.api.listIps({ tags: [OWNERSHIP_TAG] });

    const strayIps = ips
      .filter(carrying(OWNERSHIP_TAG))
      .filter((ip) => readSessionTag(ip.tags) === null);
    const strayServers = servers
      .filter(carrying(OWNERSHIP_TAG))
      .filter((server) => readSessionTag(server.tags) === null);

    const destroyed: string[] = [];
    const errors: string[] = [];

    // One try per resource, and this is the whole point. The probe's reaper
    // wrapped the loop instead: the first refusal ended the pass, the next
    // server lived, and what had already been destroyed was never recorded.
    for (const ip of strayIps) {
      try {
        await this.api.deleteIp({ ip: ip.id });
        destroyed.push(`ip ${ip.address}`);
      } catch (error) {
        if (isAlreadyGone(error)) continue;
        errors.push(`ip ${ip.id}: ${String(error)}`);
      }
    }
    for (const server of strayServers) {
      try {
        await this.destroyServer(server);
        destroyed.push(`server ${server.id}`);
      } catch (error) {
        if (isAlreadyGone(error)) continue;
        errors.push(`server ${server.id}: ${String(error)}`);
      }
    }
    // No wait here, unlike close(): a volume the provider still holds is the
    // next pass's, and already gone means a close() got there first.
    for (const volume of leftovers) {
      try {
        await this.block.deleteVolume({ volumeId: volume.id });
        destroyed.push(sweptVolume(volume));
      } catch (error) {
        if (isAlreadyGone(error)) continue;
        errors.push(`volume ${volume.id}: ${String(error)}`);
      }
    }

    return { destroyed, stranded, errors };
  }

  /** Everything the ownership tag claims, servers and ips alike. */
  private async owned(): Promise<OwnedResource[]> {
    const { servers } = await this.api.listServers({ tags: [OWNERSHIP_TAG] });
    const { ips } = await this.api.listIps({ tags: [OWNERSHIP_TAG] });
    return [
      ...servers.filter(carrying(OWNERSHIP_TAG)).map((server) => ({
        sessionId: readSessionTag(server.tags),
        summary: `server ${server.id} (${server.state})`,
      })),
      ...ips.filter(carrying(OWNERSHIP_TAG)).map((ip) => ({
        sessionId: readSessionTag(ip.tags),
        summary: `ip ${ip.address}`,
      })),
    ];
  }

  /**
   * Re-throws naming the ip, not necessarily everything that exists by the
   * time the call failed — the ip is created first and carries both tags, so
   * it alone is enough to find the attempt. Nothing is destroyed here: the
   * ip and the server carry both tags, the volume is held by the server, and
   * destroying is the watchdog's single responsibility — a second component
   * that reaps is a second component that can reap the wrong thing.
   */
  private async failing<T>(
    call: () => Promise<T>,
    ip: ScwIp,
    request: OpenServerRequest,
  ): Promise<T> {
    try {
      return await call();
    } catch (error) {
      throw new Error(
        `failed to open ${request.sessionId}: ip ${ip.id} is tagged ${sessionTag(request.sessionId)} — ${String(error)}`,
      );
    }
  }

  /**
   * The volume is born of the server and born untagged: the sdk offers no tag
   * on the volume of a creation. Until the tags land, only its attachment to
   * the server reaches it — which is how close() finds it if they never do.
   */
  private async tagRootVolume(
    server: ScwServer,
    tags: string[],
    ip: ScwIp,
    request: OpenServerRequest,
  ): Promise<void> {
    const volumeIds = blockVolumeIdsOf(server);
    // A server on a local disk would boot all the same, and nothing downstream
    // would notice.
    if (volumeIds.length === 0) {
      throw new Error(
        `createServer returned no block volume, and ip ${ip.id} is tagged ${sessionTag(request.sessionId)}`,
      );
    }
    for (const volumeId of volumeIds) {
      await this.failing(() => this.block.setVolumeTags({ volumeId, tags }), ip, request);
    }
  }

  /**
   * Deletes the block volumes of a session — those carrying its tag, and
   * those its servers held — and returns what could not be deleted.
   *
   * A block volume outlives its server and stays attached for a few seconds
   * after it, during which the provider refuses the deletion. So this polls:
   * a volume still attached waits for the next round, any other refusal ends
   * the wait, and so does the budget.
   *
   * `listed` stands for the first listing when the caller already has one. A
   * volume that is gone leaves `byAttachment`: what remains in it afterwards
   * was not deleted.
   */
  private async destroyBlockVolumes(
    tag: string,
    byAttachment: Set<string>,
    listed: ScwBlockVolume[] | null,
  ): Promise<string[]> {
    let tagged = listed;
    let paused = 0;

    for (;;) {
      try {
        tagged ??= await this.taggedVolumes(tag);
      } catch (error) {
        return [`volumes: ${String(error)}`];
      }
      const round = await this.deleteDetachedVolumes(tagged, byAttachment);
      tagged = null;
      if (round.refusals.length > 0) return round.refusals;
      if (round.stillAttached.length === 0) return [];

      const left = this.wait.budgetMs - paused;
      if (left <= 0) {
        return round.stillAttached.map(
          (volumeId) =>
            `volume ${volumeId}: still attached after ${this.wait.budgetMs / 1_000} s`,
        );
      }
      const pause = Math.min(POLL_MS, left);
      await this.wait.pause(pause);
      paused += pause;
    }
  }

  /** One tag, re-checked on what came back, as for an ip and a server. */
  private async taggedVolumes(tag: string): Promise<ScwBlockVolume[]> {
    return (await this.block.listVolumes({ tag })).volumes.filter(carrying(tag));
  }

  /**
   * One round of the wait: tries every volume that may be detached. A volume
   * of `byAttachment` that is gone leaves the set, so the next round does not
   * ask for it again.
   */
  private async deleteDetachedVolumes(
    tagged: readonly ScwBlockVolume[],
    byAttachment: Set<string>,
  ): Promise<VolumeRound> {
    // An untagged volume is not in the listing, so nothing says whether it is
    // detached: the deletion is the question, and a 412 is the answer.
    const deletable = new Set(byAttachment);
    const stillAttached: string[] = [];
    for (const volume of tagged) {
      if (isDetached(volume)) {
        deletable.add(volume.id);
      } else {
        deletable.delete(volume.id);
        stillAttached.push(volume.id);
      }
    }

    // One try per volume: a refusal on the first must not abandon the second.
    const refusals: string[] = [];
    for (const volumeId of deletable) {
      try {
        await this.block.deleteVolume({ volumeId });
        byAttachment.delete(volumeId);
      } catch (error) {
        if (isAlreadyGone(error)) byAttachment.delete(volumeId);
        else if (isStillAttached(error)) stillAttached.push(volumeId);
        else refusals.push(`volume ${volumeId}: ${String(error)}`);
      }
    }
    return { refusals, stillAttached };
  }

  private async destroyServer(server: ScwServer): Promise<void> {
    if (server.state === 'running') {
      // One call, and it takes the local volumes with it — not the block ones,
      // which close() and the sweep delete once they detach. Deliberately not
      // serverActionAndWait: that helper polls a server terminate has just
      // deleted, gets a 404, and throws after a successful destruction —
      // measured on 2026-09-03, on one server. On two, the throw ends the loop
      // and the second lives; that part is inference, and it is why the loops
      // above catch per resource rather than trusting this call not to throw.
      await this.api.serverAction({ serverId: server.id, action: 'terminate' });
      return;
    }

    // A server that never booted refuses terminate outright: "invalid state
    // 'stopped' for the action 'terminate'". Deleting it leaves its local
    // disks behind — billed, detached, absent from the server list, and
    // carrying no tag that would let anyone claim them afterwards. The block
    // ones are not asked of this api, which answers 404 for them: that would
    // read as a deletion.
    const volumeIds = localVolumeIdsOf(server);
    await this.api.deleteServer({ serverId: server.id });

    // One try per volume: a refusal on the first must not abandon the second.
    // Abandoning it drops a disk we already knew how to destroy into the
    // stranded list, where it then needs a human and a console for something
    // this call already knew how to do.
    const failures: string[] = [];
    for (const volumeId of volumeIds) {
      try {
        await this.api.deleteVolume({ volumeId });
      } catch (error) {
        if (isAlreadyGone(error)) continue;
        failures.push(`${volumeId}: ${String(error)}`);
      }
    }
    if (failures.length > 0) {
      throw new Error(`failed to delete volume(s) of server ${server.id}: ${failures.join(', ')}`);
    }
  }
}

function blockVolumeIdsOf(server: ScwServer): string[] {
  return Object.values(server.volumes)
    .filter((volume) => volume.volumeType === BLOCK_VOLUME_TYPE)
    .map((volume) => volume.id);
}

function localVolumeIdsOf(server: ScwServer): string[] {
  return Object.values(server.volumes)
    .filter((volume) => volume.volumeType !== BLOCK_VOLUME_TYPE)
    .map((volume) => volume.id);
}

/** A destroyed volume, in the audit's words: the session it was tagged for, when one is. */
function sweptVolume(volume: ScwBlockVolume): string {
  const sessionId = readSessionTag(volume.tags);
  return sessionId === null ? `volume ${volume.id}` : `volume ${volume.id} of session ${sessionId}`;
}

/**
 * A resource the provider no longer holds. Not a failure: `close()` promises
 * idempotence, and since a pass can now run seconds after another one, trying
 * to delete what the previous pass just deleted is ordinary rather than
 * exceptional.
 *
 * Read off the status and nothing else: the sdk raises a 404 under more than
 * one class, and a refusal that is not one can say "not found" too. Widening
 * this to `catch (error) { return }` would make an unreachable provider look
 * like a successful destruction, which is the one lie this system cannot
 * afford.
 */
function isAlreadyGone(error: unknown): boolean {
  return (error as { status?: number } | null)?.status === 404;
}

/**
 * The Block API's refusal to delete a volume something still holds: a 412,
 * measured on 2026-10-08. Read off the error's shape for the reason
 * `isAlreadyGone` gives.
 */
function isStillAttached(error: unknown): boolean {
  const candidate = error as { status?: number; type?: string } | null;
  return candidate?.status === 412 || candidate?.type === 'precondition_failed';
}
