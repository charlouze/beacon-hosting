import { describe, expect, it } from 'vitest';
import { isDetached } from './block-api.js';
import { FakeBlockApi, scwBlockVolume } from './fake-block-api.js';
import { BLOCK_VOLUME_TYPE } from './instance-api.js';
import { scwServer } from './fake-instance-api.js';

describe('FakeBlockApi', () => {
  it('filters on the whole tag, like the measured api', async () => {
    const api = new FakeBlockApi([
      scwBlockVolume('v-1', ['beacon', 'session:s1']),
      scwBlockVolume('v-2', ['beacon', 'session:s10']),
    ]);

    const { volumes } = await api.listVolumes({ tag: 'session:s1' });

    expect(volumes.map((volume) => volume.id)).toEqual(['v-1']);
  });

  it('can answer with everything, to prove the adapter re-checks', async () => {
    const api = new FakeBlockApi([scwBlockVolume('v-1', ['someone-else'])]);
    api.ignoresTagFilter = true;

    const { volumes } = await api.listVolumes({ tag: 'session:s1' });

    expect(volumes.map((volume) => volume.id)).toEqual(['v-1']);
  });

  it('answers a listing without a tag with every volume', async () => {
    const api = new FakeBlockApi([
      scwBlockVolume('v-1', ['beacon']),
      scwBlockVolume('v-2', ['someone-else']),
      scwBlockVolume('v-3'),
    ]);

    const { volumes } = await api.listVolumes({});

    expect(volumes.map((volume) => volume.id)).toEqual(['v-1', 'v-2', 'v-3']);
    expect(api.calls).toEqual(['listVolumes']);
  });

  it('refuses a listing without a tag on the call a test names', async () => {
    const api = new FakeBlockApi();
    api.failOn = 'listVolumes';

    await expect(api.listVolumes({})).rejects.toThrow('scaleway refused listVolumes');
  });

  it('refuses to delete an attached volume with a 412', async () => {
    const api = new FakeBlockApi([scwBlockVolume('v-1', [], true)]);

    await expect(api.deleteVolume({ volumeId: 'v-1' })).rejects.toMatchObject({ status: 412 });
    expect(api.volumes).toHaveLength(1);
  });

  it('deletes a volume once it is detached', async () => {
    const api = new FakeBlockApi([scwBlockVolume('v-1', [], true)]);
    api.detach('v-1');

    await api.deleteVolume({ volumeId: 'v-1' });

    expect(api.volumes).toEqual([]);
  });

  it('answers 404 for a volume it does not hold', async () => {
    const api = new FakeBlockApi();

    await expect(api.deleteVolume({ volumeId: 'v-1' })).rejects.toMatchObject({ status: 404 });
  });

  it('replaces the tags of a volume', async () => {
    const api = new FakeBlockApi([scwBlockVolume('v-1')]);

    await api.setVolumeTags({ volumeId: 'v-1', tags: ['beacon', 'session:s1'] });

    expect(api.volumes[0].tags).toEqual(['beacon', 'session:s1']);
    expect(api.calls).toEqual(['setVolumeTags v-1 beacon+session:s1']);
  });

  it('throws on the call a test names', async () => {
    const api = new FakeBlockApi();
    api.failOn = 'listVolumes';

    await expect(api.listVolumes({ tag: 'session:s1' })).rejects.toThrow('scaleway refused listVolumes');
  });
});

describe('isDetached', () => {
  it('reads an empty reference list as detached, and nothing else', () => {
    expect(isDetached(scwBlockVolume('v-1'))).toBe(true);
    expect(isDetached(scwBlockVolume('v-1', [], true))).toBe(false);
  });
});

describe('scwServer', () => {
  it('says which of its volumes are local and which are block', () => {
    const server = scwServer('s-1', [], 'stopped', ['v-l'], ['v-b']);

    expect(Object.values(server.volumes)).toEqual([
      { id: 'v-l', volumeType: 'l_ssd' },
      { id: 'v-b', volumeType: BLOCK_VOLUME_TYPE },
    ]);
  });
});
