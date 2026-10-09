import type { BlockApi, ScwBlockVolume } from './block-api.js';

/**
 * An in-memory Block Storage api that records what it was asked. Test-only,
 * and in src/ because the app's own tests drive it too.
 */
export class FakeBlockApi implements BlockApi {
  readonly calls: string[] = [];
  failOn: string | null = null;
  /** A specific error on a specific call, where `failOn` only throws a string. */
  failWith: { call: string; error: unknown } | null = null;
  /**
   * Answers the listing with the whole array, tag filter ignored: a fake that
   * always filters exactly would let an adapter trusting the query alone pass.
   */
  ignoresTagFilter = false;

  constructor(public volumes: ScwBlockVolume[] = []) {}

  private record(call: string): void {
    this.calls.push(call);
    if (this.failOn !== null && call.startsWith(this.failOn)) {
      throw new Error(`scaleway refused ${call}`);
    }
    if (this.failWith !== null && call.startsWith(this.failWith.call)) {
      throw this.failWith.error;
    }
  }

  async listVolumes(request: { tag?: string }) {
    const { tag } = request;
    this.record(tag === undefined ? 'listVolumes' : `listVolumes ${tag}`);
    if (tag === undefined || this.ignoresTagFilter) return { volumes: this.volumes };
    return { volumes: this.volumes.filter((volume) => volume.tags.includes(tag)) };
  }

  async setVolumeTags(request: { volumeId: string; tags: string[] }) {
    this.record(`setVolumeTags ${request.volumeId} ${request.tags.join('+')}`);
    this.held(request.volumeId);
    this.volumes = this.volumes.map((volume) =>
      volume.id === request.volumeId ? { ...volume, tags: request.tags } : volume,
    );
  }

  async deleteVolume(request: { volumeId: string }) {
    this.record(`deleteVolume ${request.volumeId}`);
    // Like the real one: an attached volume is refused, not detached for us.
    if (this.held(request.volumeId).references.length > 0) throw volumeInUse();
    this.volumes = this.volumes.filter((volume) => volume.id !== request.volumeId);
  }

  /** What the provider does on its own, seconds after the server died. */
  detach(volumeId: string): void {
    this.volumes = this.volumes.map((volume) =>
      volume.id === volumeId ? { ...volume, references: [] } : volume,
    );
  }

  private held(volumeId: string): ScwBlockVolume {
    const volume = this.volumes.find((candidate) => candidate.id === volumeId);
    if (volume === undefined) throw volumeNotFound();
    return volume;
  }
}

export const scwBlockVolume = (
  id: string,
  tags: string[] = [],
  attached = false,
): ScwBlockVolume => ({
  id,
  size: 40_000_000_000,
  tags,
  references: attached ? [{ id: `ref-${id}` }] : [],
});

/** What the sdk hands back for the deletion of an attached volume. */
export const volumeInUse = (): Error =>
  Object.assign(new Error('precondition failed'), { status: 412 });

/** What the sdk hands back for a volume that no longer exists. */
export const volumeNotFound = (): Error =>
  Object.assign(new Error('resource not found'), { status: 404 });
