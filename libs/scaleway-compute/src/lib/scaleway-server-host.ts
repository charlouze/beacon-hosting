import type {
  HostedServer,
  OpenedServer,
  OpenServerRequest,
  ServerHost,
  SessionId,
  UnclaimedSweep,
} from '@beacon/session';
import type { ImageResolver } from './images.js';
import type { InstanceApi, ScwIp, ScwServer } from './instance-api.js';
import { OWNERSHIP_TAG, readSessionTag, sessionTag } from './tags.js';

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
    private readonly images: ImageResolver,
  ) {}

  async open(request: OpenServerRequest): Promise<OpenedServer> {
    // Both tags, from creation (§5). The constant one is what makes "every
    // resource of this system whose session is unknown" a query the api can
    // answer; the session one is what pairs a resource with its intent.
    const tags = [OWNERSHIP_TAG, sessionTag(request.sessionId)];

    // Before anything is created: an unmatched size must cost nothing, and
    // `DEV1-L` has no fallback — it is the only 8 GiB type of the zone both
    // available and shipped with its disk (§2).
    const image = await this.images.resolve(request.size);
    if (image === null) {
      throw new Error(`no ubuntu image for ${request.size}`);
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
      () =>
        this.api.createServer({
          name: `beacon-${request.sessionId}`,
          commercialType: request.size,
          image,
          publicIps: [ip.id],
          tags,
        }),
      ip,
      request,
    );
    const server = created.server;
    if (server === undefined) {
      throw new Error(
        `createServer returned no server, and ip ${ip.id} is tagged ${sessionTag(request.sessionId)}`,
      );
    }

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
    for (const server of servers.filter(carrying(tag))) {
      try {
        await this.destroyServer(server);
      } catch (error) {
        if (isAlreadyGone(error)) continue;
        failures.push(`server ${server.id}: ${String(error)}`);
      }
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
    const stranded = volumes
      .filter((volume) => volume.server?.id === undefined)
      .map((volume) => `volume ${volume.id} (${Math.round(volume.size / 1e9)} GB)`);

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
   * resources carry both tags, and destroying is the watchdog's single
   * responsibility — a second component that reaps is a second component that
   * can reap the wrong thing.
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

  private async destroyServer(server: ScwServer): Promise<void> {
    if (server.state === 'running') {
      // One call, and it takes the attached volumes with it. Deliberately not
      // serverActionAndWait: that helper polls a server terminate has just
      // deleted, gets a 404, and throws after a successful destruction —
      // measured on 2026-09-03, on one server. On two, the throw ends the loop
      // and the second lives; that part is inference, and it is why the loops
      // above catch per resource rather than trusting this call not to throw.
      await this.api.serverAction({ serverId: server.id, action: 'terminate' });
      return;
    }

    // A server that never booted refuses terminate outright: "invalid state
    // 'stopped' for the action 'terminate'". Deleting it leaves the disks
    // behind — billed, detached, absent from the server list, and carrying no
    // tag that would let anyone claim them afterwards.
    const volumeIds = volumeIdsOf(server);
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

/** Kept next to its only caller: the two death paths of close() need it. */
export function volumeIdsOf(server: ScwServer): string[] {
  return Object.values(server.volumes).map((volume) => volume.id);
}

/**
 * A resource the provider no longer holds. Not a failure: `close()` promises
 * idempotence, and since a pass can now run seconds after another one, trying
 * to delete what the previous pass just deleted is ordinary rather than
 * exceptional.
 *
 * Read off the error's shape because the sdk exports no typed error for it —
 * so the three forms it has been seen to take are all accepted, and nothing
 * else is. Widening this to `catch (error) { return }` would make an
 * unreachable provider look like a successful destruction, which is the one
 * lie this system cannot afford.
 */
function isAlreadyGone(error: unknown): boolean {
  const candidate = error as { status?: number; type?: string; message?: string } | null;
  if (candidate?.status === 404) return true;
  if (candidate?.type === 'not_found') return true;
  return /not found|does not exist/i.test(candidate?.message ?? '');
}
