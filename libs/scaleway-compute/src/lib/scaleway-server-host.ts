import type { HostedServer, ServerHost, SessionId, UnclaimedSweep } from '@beacon/session';
import type { InstanceApi, ScwServer } from './instance-api.js';
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
  constructor(private readonly api: InstanceApi) {}

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
        failures.push(`ip ${ip.id}: ${String(error)}`);
      }
    }
    for (const server of servers.filter(carrying(tag))) {
      try {
        await this.destroyServer(server);
      } catch (error) {
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
        errors.push(`ip ${ip.id}: ${String(error)}`);
      }
    }
    for (const server of strayServers) {
      try {
        await this.destroyServer(server);
        destroyed.push(`server ${server.id}`);
      } catch (error) {
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
