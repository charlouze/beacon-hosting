import type { InstanceApi, ScwIp, ScwServer, ScwVolume } from './instance-api.js';

/**
 * An in-memory Instance api that records what it was asked. Test-only, and it
 * lives in src/ rather than in the spec file because tasks 5 and 6 both drive
 * it and a copy in each would drift.
 */
export class FakeInstanceApi implements InstanceApi {
  readonly calls: string[] = [];
  failOn: string | null = null;
  /**
   * Answers every listing with the whole array, tag filter ignored. Scaleway's
   * `tags=` was measured exact on the flexible ip and on nothing else: a fake
   * that always filters exactly *is* the assumption under test, and would let
   * an adapter trusting the query alone pass.
   */
  ignoresTagFilter = false;

  constructor(
    public servers: ScwServer[] = [],
    public ips: ScwIp[] = [],
    public volumes: ScwVolume[] = [],
  ) {}

  private record(call: string): void {
    this.calls.push(call);
    if (this.failOn !== null && call.startsWith(this.failOn)) {
      throw new Error(`scaleway refused ${call}`);
    }
  }

  async listServers(request: { tags: string[] }) {
    this.record(`listServers ${request.tags.join('+')}`);
    if (this.ignoresTagFilter) return { servers: this.servers };
    return { servers: this.servers.filter((s) => request.tags.every((t) => s.tags.includes(t))) };
  }

  async listIps(request: { tags: string[] }) {
    this.record(`listIps ${request.tags.join('+')}`);
    if (this.ignoresTagFilter) return { ips: this.ips };
    return { ips: this.ips.filter((i) => request.tags.every((t) => i.tags.includes(t))) };
  }

  async serverAction(request: { serverId: string; action: 'terminate' }) {
    this.record(`terminate ${request.serverId}`);
    this.servers = this.servers.filter((s) => s.id !== request.serverId);
    return {};
  }

  async deleteServer(request: { serverId: string }) {
    this.record(`deleteServer ${request.serverId}`);
    this.servers = this.servers.filter((s) => s.id !== request.serverId);
  }

  async listVolumes() {
    this.record('listVolumes');
    return { volumes: this.volumes };
  }

  async deleteVolume(request: { volumeId: string }) {
    this.record(`deleteVolume ${request.volumeId}`);
    this.volumes = this.volumes.filter((v) => v.id !== request.volumeId);
  }

  async deleteIp(request: { ip: string }) {
    this.record(`deleteIp ${request.ip}`);
    this.ips = this.ips.filter((i) => i.id !== request.ip);
  }
}

export const scwServer = (
  id: string,
  tags: string[],
  state = 'running',
  volumeIds: string[] = [],
): ScwServer => ({
  id,
  name: `beacon-${id}`,
  state,
  tags,
  volumes: Object.fromEntries(volumeIds.map((v, index) => [String(index), { id: v }])),
});

export const scwIp = (id: string, address: string, tags: string[]): ScwIp => ({
  id,
  address,
  tags,
});

export const scwVolume = (id: string, serverId: string | null = null): ScwVolume => ({
  id,
  name: `volume-${id}`,
  size: 80_000_000_000,
  server: serverId === null ? null : { id: serverId },
});
