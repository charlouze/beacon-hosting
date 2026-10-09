import { beforeEach, describe, expect, it } from 'vitest';
import { World } from '@beacon/session';
import type { Game } from '@beacon/session';
import type { UnclaimedSweep } from '@beacon/session';
import { FakeBlockApi, scwBlockVolume, volumeInUse, volumeNotFound } from './fake-block-api.js';
import { FakeInstanceApi, scwIp, scwServer, scwVolume } from './fake-instance-api.js';
import { ScalewayServerHost, type DetachmentWait } from './scaleway-server-host.js';
import { OWNERSHIP_TAG, sessionTag } from './tags.js';

const owned = (sessionId?: string) =>
  sessionId === undefined ? [OWNERSHIP_TAG] : [OWNERSHIP_TAG, sessionTag(sessionId)];

const images = { resolve: async () => 'img-1' };
const diskGbFor = (game: Game) => (game === 'sunkenland' ? 40 : 30);

let api: FakeInstanceApi;
let block: FakeBlockApi;
let pauses: number[];
/** What the provider does while close() pauses. Called with the pause count so far. */
let duringPause: (count: number) => void;
let wait: DetachmentWait;
let host: ScalewayServerHost;

beforeEach(() => {
  api = new FakeInstanceApi();
  block = new FakeBlockApi();
  pauses = [];
  duringPause = () => undefined;
  wait = {
    budgetMs: 30_000,
    pause: async (ms) => {
      pauses.push(ms);
      duringPause(pauses.length);
    },
  };
  host = new ScalewayServerHost(api, block, images, wait, diskGbFor);
});

describe('list', () => {
  it('finds nothing in an empty project', async () => {
    expect(await host.list()).toEqual([]);
  });

  it('gathers a server and its ip under one session', async () => {
    api.servers = [scwServer('s-1', owned('sess1'))];
    api.ips = [scwIp('ip-1', '51.15.0.1', owned('sess1'))];

    const hosted = await host.list();

    expect(hosted).toHaveLength(1);
    expect(hosted[0].sessionId).toBe('sess1');
    expect(hosted[0].summary).toContain('s-1');
    expect(hosted[0].summary).toContain('51.15.0.1');
  });

  it('returns one entry per session', async () => {
    api.servers = [scwServer('s-1', owned('sess1')), scwServer('s-2', owned('sess2'))];
    expect((await host.list()).map((h) => h.sessionId).sort()).toEqual(['sess1', 'sess2']);
  });

  // A flexible ip is billed from reservation to deletion, attached or not —
  // measured. An inventory blind to it would miss exactly the resource that
  // outlives its instance.
  it('reports an ip with no server of its own as a hosted server', async () => {
    api.ips = [scwIp('ip-1', '51.15.0.1', owned('sess1'))];
    expect((await host.list()).map((h) => h.sessionId)).toEqual(['sess1']);
  });

  it('ignores what carries no session tag', async () => {
    api.servers = [scwServer('s-1', owned())];
    expect(await host.list()).toEqual([]);
  });

  // Asking by ownership tag alone is the whole point of having one: the
  // reconciliation asks about sessions whose ids it does not know.
  it('asks the provider by the ownership tag and nothing else', async () => {
    await host.list();
    expect(api.calls).toEqual([`listServers ${OWNERSHIP_TAG}`, `listIps ${OWNERSHIP_TAG}`]);
  });

  it('never sees what belongs to someone else', async () => {
    api.servers = [scwServer('s-1', ['someone-else', 'session:theirs'])];
    expect(await host.list()).toEqual([]);
  });

  // The exactness of `tags=` was measured on the flexible ip and nowhere else.
  // If listServers matches loosely, the probe's `beacon-probe` machine comes
  // back here as hosted session probe0001, nothing explains it, and the first
  // production pass destroys the sonde. So the query is not the guard.
  it('ignores a resource the provider returned without the tag it was asked for', async () => {
    api.ignoresTagFilter = true;
    api.servers = [scwServer('s-1', ['beacon-probe', 'session:probe0001'])];
    api.ips = [scwIp('ip-1', '51.15.0.1', ['beacon-probe', 'session:probe0001'])];

    expect(await host.list()).toEqual([]);
  });
});

describe('close', () => {
  it('succeeds and calls nothing when the provider holds nothing', async () => {
    await host.close('sess1');
    expect(api.calls.filter((c) => c.startsWith('delete') || c.startsWith('terminate'))).toEqual([]);
  });

  // Exact filter, one tag. Asking with two was never measured, and a query
  // whose semantics we do not know has no place in the thing that destroys.
  it('asks by the session tag alone', async () => {
    await host.close('sess1');
    expect(api.calls).toEqual([`listIps ${sessionTag('sess1')}`, `listServers ${sessionTag('sess1')}`]);
  });

  // The ip first: a flexible ip outliving its server keeps billing.
  it('destroys the ip before the server', async () => {
    api.servers = [scwServer('s-1', owned('sess1'))];
    api.ips = [scwIp('ip-1', '51.15.0.1', owned('sess1'))];

    await host.close('sess1');

    const destructive = api.calls.filter((c) => !c.startsWith('list'));
    expect(destructive).toEqual(['deleteIp ip-1', 'terminate s-1']);
  });

  it('kills a running server with terminate, which takes its local volumes along', async () => {
    api.servers = [scwServer('s-1', owned('sess1'), 'running', ['v-1'])];

    await host.close('sess1');

    expect(api.calls).toContain('terminate s-1');
    expect(api.calls).not.toContain('deleteVolume v-1');
  });

  // The measured trap. terminate is refused on anything not running, so a
  // server whose boot failed dies by deleteServer — which leaves the disks
  // behind, billed, detached, and carrying no tag anyone could claim them by.
  it('kills a stopped server by deletion, then its volumes itself', async () => {
    api.servers = [scwServer('s-1', owned('sess1'), 'stopped', ['v-1', 'v-2'])];

    await host.close('sess1');

    expect(api.calls.filter((c) => !c.startsWith('list'))).toEqual([
      'deleteServer s-1',
      'deleteVolume v-1',
      'deleteVolume v-2',
    ]);
    expect(api.calls).not.toContain('terminate s-1');
  });

  // The probe's own reaper aborted its loop on the first failure and let the
  // second server live. That is the exact failure this component exists to
  // prevent, so the error must reach the caller rather than be swallowed here.
  it('lets a provider error out, for the watchdog to record', async () => {
    api.servers = [scwServer('s-1', owned('sess1'))];
    api.failOn = 'terminate';

    await expect(host.close('sess1')).rejects.toThrow('scaleway refused');
  });

  // Same rule as the sweep, on the path that answers a reclamation: a refusal
  // on the first ip used to abandon the second and every server behind it.
  it('destroys the second ip even when the first one refuses, and still throws', async () => {
    api.ips = [scwIp('ip-1', '51.15.0.1', owned('sess1')), scwIp('ip-2', '51.15.0.2', owned('sess1'))];
    api.failOn = 'deleteIp ip-1';

    await expect(host.close('sess1')).rejects.toThrow('ip-1');

    expect(api.calls).toContain('deleteIp ip-2');
  });

  it('destroys the second server even when the first one refuses, and still throws', async () => {
    api.servers = [scwServer('s-1', owned('sess1')), scwServer('s-2', owned('sess1'))];
    api.failOn = 'terminate s-1';

    await expect(host.close('sess1')).rejects.toThrow('s-1');

    expect(api.calls).toContain('terminate s-2');
  });

  // Nothing here trusts `tags=` to have filtered: it was measured exact on the
  // flexible ip and on nothing else, and this is the call that destroys.
  it('leaves alone what the provider returned without the session tag', async () => {
    api.ignoresTagFilter = true;
    api.servers = [scwServer('s-1', ['beacon-probe', 'session:probe0001'])];
    api.ips = [scwIp('ip-1', '51.15.0.1', ['beacon-probe', 'session:probe0001'])];

    await host.close('sess1');

    expect(api.calls.filter((c) => !c.startsWith('list'))).toEqual([]);
  });

  // The same failure one level down: a refusal on the first volume must not
  // abandon the second. Abandoning it drops a disk we already knew how to
  // destroy into the third list, where it now needs a human and a console.
  it('destroys every volume even when one of them refuses', async () => {
    api.servers = [scwServer('s-1', owned('sess1'), 'stopped', ['v-1', 'v-2'])];
    api.failOn = 'deleteVolume v-1';

    await expect(host.close('sess1')).rejects.toThrow();

    expect(api.calls).toContain('deleteVolume v-2');
  });
});

describe('closing something the provider no longer holds', () => {
  // Two passes seconds apart is what the immediate pass makes ordinary: the
  // second one lists an ip the first has just deleted. Treated as a failure,
  // it files a CleanupFailed and pushes a healthy record to FAILED.
  it('treats an ip that is already gone as closed', async () => {
    const api = new FakeInstanceApi([], [scwIp('ip-1', '1.2.3.4', ['beacon', 'session:s1'])]);
    api.failWith = { call: 'deleteIp', error: notFound() };
    await expect(new ScalewayServerHost(api, block, images, wait, diskGbFor).close('s1')).resolves.toBeUndefined();
  });

  it('treats a server that is already gone as closed', async () => {
    const api = new FakeInstanceApi([scwServer('srv-1', ['beacon', 'session:s1'])]);
    api.failWith = { call: 'terminate', error: notFound() };
    await expect(new ScalewayServerHost(api, block, images, wait, diskGbFor).close('s1')).resolves.toBeUndefined();
  });

  // The distinction that matters: a refusal is still a refusal. Swallowing
  // every error under the name of idempotence would make the watchdog report
  // success on a provider that is simply unreachable.
  it('still refuses when the provider says something else', async () => {
    const api = new FakeInstanceApi([], [scwIp('ip-1', '1.2.3.4', ['beacon', 'session:s1'])]);
    api.failWith = { call: 'deleteIp', error: new Error('quota exceeded') };
    await expect(new ScalewayServerHost(api, block, images, wait, diskGbFor).close('s1')).rejects.toThrow(/quota/);
  });

  // The status decides, never the prose: a 403 "project not found" leaves the
  // resource alive and billed.
  it('still refuses a refusal whose message says not found without a 404', async () => {
    const api = new FakeInstanceApi([], [scwIp('ip-1', '1.2.3.4', ['beacon', 'session:s1'])]);
    api.failWith = { call: 'deleteIp', error: projectNotFound() };
    await expect(new ScalewayServerHost(api, block, images, wait, diskGbFor).close('s1')).rejects.toThrow('ip-1');
  });

  it('records in the sweep a refusal whose message says not found without a 404', async () => {
    block.volumes = [scwBlockVolume('v-1', owned('sess1'))];
    block.failWith = { call: 'deleteVolume v-1', error: projectNotFound() };

    const sweep = await host.sweepUnclaimed();

    expect(sweep.destroyed).toEqual([]);
    expect(sweep.errors).toHaveLength(1);
    expect(sweep.errors[0]).toContain('v-1');
  });
});

const projectNotFound = () => Object.assign(new Error('project not found'), { status: 403 });

/** What the sdk hands back for a resource that no longer exists. */
const notFound = () => Object.assign(new Error('resource not found'), { status: 404 });

describe('sweepUnclaimed', () => {
  it('destroys only what carries no session tag', async () => {
    api.servers = [scwServer('s-1', owned()), scwServer('s-2', owned('sess1'))];
    api.ips = [scwIp('ip-1', '51.15.0.1', owned())];

    await host.sweepUnclaimed();

    const destructive = api.calls.filter((c) => !c.startsWith('list'));
    expect(destructive).toEqual(['deleteIp ip-1', 'terminate s-1']);
  });

  it('reports what it destroyed', async () => {
    api.ips = [scwIp('ip-1', '51.15.0.1', owned())];
    expect((await host.sweepUnclaimed()).destroyed).toEqual(['ip 51.15.0.1']);
  });

  it('finds nothing to say on a project where every resource is claimed', async () => {
    api.servers = [scwServer('s-1', owned('sess1'))];
    expect(await host.sweepUnclaimed()).toEqual({ destroyed: [], stranded: [], errors: [] });
  });

  // The probe's leftovers carry `beacon-probe`, a third tag this system does
  // not own. Sweeping them would destroy resources that are not ours to judge.
  it('never touches what the probe tagged', async () => {
    api.servers = [scwServer('s-1', ['beacon-probe', 'session:probe0001'])];
    expect((await host.sweepUnclaimed()).destroyed).toEqual([]);
    expect(api.calls.filter((c) => !c.startsWith('list'))).toEqual([]);
  });

  // The probe's own reaper aborted its loop on the first refusal and left the
  // next resource alive. Here the refusal is recorded and the pass goes on —
  // and what was destroyed before it still reaches the audit.
  it('carries on past a refusal, and records both sides of it', async () => {
    api.ips = [scwIp('ip-1', '51.15.0.1', owned())];
    api.servers = [scwServer('s-1', owned())];
    api.failOn = 'deleteIp';

    const sweep = await host.sweepUnclaimed();

    expect(api.calls).toContain('terminate s-1');
    expect(sweep.destroyed).toEqual(['server s-1']);
    expect(sweep.errors).toHaveLength(1);
    expect(sweep.errors[0]).toContain('ip-1');
  });

  // A local volume carries no tag of ours, so nothing proves where it comes
  // from, and deleting someone else's disk is the one mistake this component
  // may not make.
  it('reports a detached volume without touching it', async () => {
    api.volumes = [scwVolume('v-1')];

    const sweep = await host.sweepUnclaimed();

    expect(sweep.stranded).toEqual(['volume v-1 (80 GB)']);
    expect(api.calls).not.toContain('deleteVolume v-1');
  });

  it('says nothing about a volume still attached to a server', async () => {
    api.volumes = [scwVolume('v-1', 's-1')];
    expect((await host.sweepUnclaimed()).stranded).toEqual([]);
  });

  // Listed before anything is destroyed: a disk this very pass is about to
  // orphan is in flight, not stranded. If it really is left behind, the pass
  // five minutes later will say so.
  it('lists the volumes before it destroys anything', async () => {
    api.servers = [scwServer('s-1', owned())];
    api.volumes = [scwVolume('v-1', 's-1')];

    await host.sweepUnclaimed();

    expect(api.calls.indexOf('listVolumes')).toBeLessThan(api.calls.indexOf('terminate s-1'));
  });
});

describe('open', () => {
  const REQUEST = {
    sessionId: 's1',
    world: World.from({
      worldId: 'les-copains',
      game: 'enshrouded' as const,
      name: 'Les copains',
      inviteCode: 'c0de',
      players: [],
    }),
    size: 'DEV1-L',
    bootstrap: '#cloud-config\n',
  };
  const SUNKENLAND = {
    ...REQUEST,
    sessionId: 's2',
    world: World.from({
      worldId: 'les-naufrages',
      game: 'sunkenland' as const,
      name: 'Les naufrages',
      inviteCode: 'c0de',
      players: [],
    }),
  };

  beforeEach(() => {
    api.block = block;
  });

  it('carries both tags on the ip and on the server, from creation', async () => {
    await host.open(REQUEST);
    expect(api.ips[0].tags).toEqual(owned('s1'));
    expect(api.servers[0].tags).toEqual(owned('s1'));
  });

  // The ip first, and this is the order the sequence exists for: the address
  // is known before the machine is, which is what lets a join point be
  // announced. It is also what makes the resource reapable if the next call
  // fails — an untagged ip created after a tagged server would be invisible.
  it('reserves the ip before it creates the server', async () => {
    await host.open(REQUEST);
    expect(api.calls.filter((c) => c.startsWith('create'))).toEqual([
      'createIp beacon+session:s1',
      'createServer beacon+session:s1',
    ]);
  });

  it('creates the server from the resolved image, on the ip it reserved', async () => {
    await host.open(REQUEST);
    expect(api.created).toHaveLength(1);
    expect(api.created[0]).toMatchObject({
      name: 'beacon-s1',
      commercialType: 'DEV1-L',
      image: 'img-1',
      publicIps: ['ip-1'],
      tags: owned('s1'),
    });
  });

  it('gives the server a block root volume of the size its game asks for', async () => {
    await host.open(REQUEST);
    await host.open(SUNKENLAND);
    expect(api.created.map((creation) => creation.volumes)).toEqual([
      { '0': { size: 30_000_000_000, volumeType: 'sbs_volume' } },
      { '0': { size: 40_000_000_000, volumeType: 'sbs_volume' } },
    ]);
  });

  // The volume is born of the server, and born without a tag: until these
  // land, nothing but its attachment says whose it is.
  it('puts both tags on the root volume', async () => {
    await host.open(REQUEST);
    expect(block.volumes).toEqual([
      { id: 'vol-1', size: 30_000_000_000, tags: owned('s1'), references: [{ id: 'ref-vol-1' }] },
    ]);
  });

  it('tags the volume once the server exists, and before the cloud-init and the boot', async () => {
    const setVolumeTags = block.setVolumeTags.bind(block);
    let before: string[] = [];
    block.setVolumeTags = async (request) => {
      before = [...api.calls];
      return setVolumeTags(request);
    };

    await host.open(REQUEST);

    expect(before).toEqual(['createIp beacon+session:s1', 'createServer beacon+session:s1']);
    expect(api.calls.slice(before.length)).toEqual(['setServerUserData srv-1', 'powerOn srv-1']);
  });

  // There is no second chance at first boot: user data posted after poweron
  // is read by nothing, and the machine sits there billed and empty.
  it('posts the cloud-init before it powers the machine on', async () => {
    await host.open(REQUEST);
    expect(api.userData.get('srv-1')).toBe(REQUEST.bootstrap);
    // `indexOf` answers -1 for an absent call, and -1 is less than any real
    // index — a bare `toBeLessThan` would pass if `setServerUserData` were
    // never called at all, which is the exact failure this test is named for.
    const setIndex = api.calls.indexOf('setServerUserData srv-1');
    const powerOnIndex = api.calls.indexOf('powerOn srv-1');
    expect(setIndex).toBeGreaterThanOrEqual(0);
    expect(powerOnIndex).toBeGreaterThanOrEqual(0);
    expect(setIndex).toBeLessThan(powerOnIndex);
  });

  it('answers with the address and the provider references', async () => {
    const opened = await host.open(REQUEST);
    expect(opened.address).toBe('51.15.0.1');
    expect(opened.size).toBe('DEV1-L');
    expect(opened.references).toEqual({ instanceId: 'srv-1', ipId: 'ip-1' });
  });

  // The failure that costs money. An ip created and then abandoned keeps
  // billing, and carries the tags that would let the watchdog find it — so the
  // honest thing is to say what exists, not to hide it behind a bare throw.
  it('names the ip it already created when the server refuses', async () => {
    api.failOn = 'createServer';
    await expect(host.open(REQUEST)).rejects.toThrow(/ip ip-1 is tagged session:s1/);
  });

  it('fails the same way when the tags do not land, and destroys nothing', async () => {
    block.failOn = 'setVolumeTags';

    await expect(host.open(REQUEST)).rejects.toThrow(
      /failed to open s1: ip ip-1 is tagged session:s1 — .*setVolumeTags/,
    );

    expect(api.calls).toEqual(['createIp beacon+session:s1', 'createServer beacon+session:s1']);
    expect(block.calls).toEqual(['setVolumeTags vol-1 beacon+session:s1']);
    expect(api.ips).toHaveLength(1);
    expect(api.servers).toHaveLength(1);
    expect(block.volumes).toHaveLength(1);
  });

  // What is left of that failure is a tagged server holding an untagged
  // volume, and close() reaches the volume through the server.
  it('leaves a volume whose tags never landed within reach of close()', async () => {
    block.failOn = 'setVolumeTags';
    await expect(host.open(REQUEST)).rejects.toThrow();
    block.failOn = null;
    duringPause = () => block.detach('vol-1');

    await host.close('s1');

    expect(api.ips).toEqual([]);
    expect(api.servers).toEqual([]);
    expect(block.volumes).toEqual([]);
  });

  // A server on a local disk would boot, untagged volume and all: nothing
  // downstream would notice, so the opening says so.
  it('fails when the provider returns a server without a block volume', async () => {
    api.createServer = async (request) => {
      api.calls.push(`createServer ${request.tags.join('+')}`);
      return { server: scwServer('srv-9', request.tags, 'stopped', ['v-l']) };
    };

    await expect(host.open(REQUEST)).rejects.toThrow(
      /no block volume.*ip ip-1 is tagged session:s1/,
    );

    expect(block.calls).toEqual([]);
    expect(api.calls).toEqual(['createIp beacon+session:s1', 'createServer beacon+session:s1']);
  });

  it('refuses to open when no image matches the size', async () => {
    const none = { resolve: async () => null };
    await expect(
      new ScalewayServerHost(api, block, none, wait, diskGbFor).open(REQUEST),
    ).rejects.toThrow(/no ubuntu image/);
    expect(api.calls).toEqual([]);
  });

  it.each([0, -40, 12.5, Number.NaN])(
    'refuses to open a game whose disk size is %s, before anything is created',
    async (diskGb) => {
      await expect(
        new ScalewayServerHost(api, block, images, wait, () => diskGb).open(REQUEST),
      ).rejects.toThrow(/no disk size for enshrouded/);
      expect(api.calls).toEqual([]);
    },
  );
});

describe('closing the block volumes of a session', () => {
  const tag = sessionTag('sess1');

  // The constraint of the batch: a server opened before block volumes existed.
  it('closes a server on a local disk without a pause or a block deletion', async () => {
    api.servers = [scwServer('s-1', owned('sess1'), 'stopped', ['v-1'])];
    api.ips = [scwIp('ip-1', '51.15.0.1', owned('sess1'))];

    await host.close('sess1');

    expect(api.calls.filter((c) => !c.startsWith('list'))).toEqual([
      'deleteIp ip-1',
      'deleteServer s-1',
      'deleteVolume v-1',
    ]);
    expect(block.calls).toEqual([`listVolumes ${tag}`]);
    expect(pauses).toEqual([]);
  });

  it('deletes a detached volume carrying the session tag', async () => {
    block.volumes = [scwBlockVolume('v-1', owned('sess1'))];

    await host.close('sess1');

    expect(block.volumes).toEqual([]);
    expect(pauses).toEqual([]);
  });

  // Same re-check as for an ip and a server: this is the call that destroys.
  it('leaves alone a volume the provider returned without the session tag', async () => {
    block.ignoresTagFilter = true;
    block.volumes = [scwBlockVolume('v-1', ['beacon-probe', 'session:probe0001'])];

    await host.close('sess1');

    expect(block.volumes).toHaveLength(1);
    expect(block.calls).toEqual([`listVolumes ${tag}`]);
  });

  // terminate leaves a block volume behind, detached 1 to 13 s later.
  it('waits for a tagged volume to detach, then deletes it', async () => {
    api.servers = [scwServer('s-1', owned('sess1'), 'running', [], ['v-1'])];
    block.volumes = [scwBlockVolume('v-1', owned('sess1'), true)];
    duringPause = (count) => {
      if (count === 2) block.detach('v-1');
    };

    await host.close('sess1');

    expect(block.volumes).toEqual([]);
    expect(pauses).toEqual([1_000, 1_000]);
    // Attached and listed as such: nothing is asked of it until it detaches.
    expect(block.calls.filter((c) => c.startsWith('deleteVolume'))).toEqual(['deleteVolume v-1']);
  });

  // A volume whose tags never landed is reached by its server alone.
  it('deletes an untagged block volume by its attachment, retrying while it is in use', async () => {
    api.servers = [scwServer('s-1', owned('sess1'), 'stopped', [], ['v-1'])];
    block.volumes = [scwBlockVolume('v-1', [], true)];
    duringPause = () => block.detach('v-1');

    await host.close('sess1');

    expect(block.volumes).toEqual([]);
    expect(pauses).toEqual([1_000]);
    expect(block.calls.filter((c) => c.startsWith('deleteVolume'))).toEqual([
      'deleteVolume v-1',
      'deleteVolume v-1',
    ]);
  });

  describe('a volume whose tags never landed', () => {
    beforeEach(() => {
      api.servers = [scwServer('s-1', owned('sess1'), 'running', [], ['v-1'])];
      block.volumes = [scwBlockVolume('v-1', [], true)];
    });

    // The server is all that ties an untagged volume to its session: once it
    // is gone, only a tag finds the volume again.
    it('gets both tags before its server dies', async () => {
      const setVolumeTags = block.setVolumeTags.bind(block);
      let before: string[] | null = null;
      block.setVolumeTags = async (request) => {
        before = [...api.calls];
        return setVolumeTags(request);
      };

      await expect(host.close('sess1')).rejects.toThrow('volume v-1: still attached after 30 s');

      expect(before).not.toBeNull();
      expect(before).not.toContain('terminate s-1');
      expect(api.servers).toEqual([]);
      expect(block.volumes).toEqual([scwBlockVolume('v-1', owned('sess1'), true)]);
    });

    it('is destroyed by its tag on a later close(), its server gone', async () => {
      await expect(host.close('sess1')).rejects.toThrow();
      block.detach('v-1');

      await host.close('sess1');

      expect(block.volumes).toEqual([]);
    });

    it('is destroyed by the sweep instead of reported, its server gone', async () => {
      await expect(host.close('sess1')).rejects.toThrow();
      block.detach('v-1');

      expect(await host.sweepUnclaimed()).toEqual({
        destroyed: ['volume v-1 of session sess1'],
        stranded: [],
        errors: [],
      });
      expect(block.volumes).toEqual([]);
    });

    it('still dies with its server when the tags are refused again', async () => {
      block.failOn = 'setVolumeTags';
      duringPause = () => block.detach('v-1');

      await host.close('sess1');

      expect(api.servers).toEqual([]);
      expect(block.volumes).toEqual([]);
    });

    // The one volume nothing will find again: the failure is the last place
    // that names it next to its session.
    it('is named as untagged when it outlives a close() that could not tag it', async () => {
      block.failOn = 'setVolumeTags';

      await expect(host.close('sess1')).rejects.toThrow(
        /volume v-1: still attached after 30 s, volume v-1: left untagged — .*setVolumeTags v-1/,
      );

      expect(api.servers).toEqual([]);
    });

    it('is not mentioned once destroyed, whatever else failed', async () => {
      api.ips = [scwIp('ip-1', '51.15.0.1', owned('sess1'))];
      api.failOn = 'deleteIp';
      block.failOn = 'setVolumeTags';
      duringPause = () => block.detach('v-1');

      await expect(host.close('sess1')).rejects.toThrow(/^failed to close session sess1: ip ip-1: [^,]*$/);
    });
  });

  it('does not tag again a volume that carries the session tag', async () => {
    api.servers = [scwServer('s-1', owned('sess1'), 'running', [], ['v-1'])];
    block.volumes = [scwBlockVolume('v-1', owned('sess1'), true)];
    duringPause = () => block.detach('v-1');

    await host.close('sess1');

    expect(block.calls.filter((c) => c.startsWith('setVolumeTags'))).toEqual([]);
    expect(block.calls.filter((c) => c.startsWith('listVolumes'))).toHaveLength(2);
  });

  // The Instance API answers 404 for a block volume, which reads as success.
  it('never asks the instance api to delete a block volume', async () => {
    api.servers = [scwServer('s-1', owned('sess1'), 'stopped', ['v-l'], ['v-b'])];
    block.volumes = [scwBlockVolume('v-b')];

    await host.close('sess1');

    expect(api.calls.filter((c) => c.startsWith('deleteVolume'))).toEqual(['deleteVolume v-l']);
    expect(block.calls.filter((c) => c.startsWith('deleteVolume'))).toEqual(['deleteVolume v-b']);
  });

  it('deletes the block volume of a running server it terminated', async () => {
    api.servers = [scwServer('s-1', owned('sess1'), 'running', [], ['v-1'])];
    block.volumes = [scwBlockVolume('v-1')];

    await host.close('sess1');

    expect(block.volumes).toEqual([]);
  });

  it('retries a tagged volume the list calls detached and the deletion calls in use', async () => {
    block.volumes = [scwBlockVolume('v-1', owned('sess1'))];
    block.failWith = { call: 'deleteVolume', error: volumeInUse() };
    duringPause = () => {
      block.failWith = null;
    };

    await host.close('sess1');

    expect(block.volumes).toEqual([]);
    expect(pauses).toEqual([1_000]);
  });

  it('fails once a tagged volume has stayed attached for the whole budget', async () => {
    block.volumes = [scwBlockVolume('v-1', owned('sess1'), true)];

    await expect(host.close('sess1')).rejects.toThrow('volume v-1: still attached after 30 s');

    expect(pauses).toHaveLength(30);
    expect(pauses.reduce((sum, ms) => sum + ms, 0)).toBe(30_000);
  });

  it('fails once a volume reached by its attachment has stayed in use for the whole budget', async () => {
    api.servers = [scwServer('s-1', owned('sess1'), 'stopped', [], ['v-1'])];
    block.volumes = [scwBlockVolume('v-1', [], true)];

    await expect(host.close('sess1')).rejects.toThrow('volume v-1: still attached after 30 s');

    expect(pauses.reduce((sum, ms) => sum + ms, 0)).toBe(30_000);
  });

  it('never pauses past a budget that is not a whole number of polls', async () => {
    block.volumes = [scwBlockVolume('v-1', owned('sess1'), true)];
    host = new ScalewayServerHost(api, block, images, { ...wait, budgetMs: 2_500 }, diskGbFor);

    await expect(host.close('sess1')).rejects.toThrow('still attached after 2.5 s');

    expect(pauses).toEqual([1_000, 1_000, 500]);
  });

  it('ends the wait on any other refusal, and reports that refusal', async () => {
    block.volumes = [scwBlockVolume('v-1', owned('sess1'))];
    block.failWith = { call: 'deleteVolume', error: new Error('quota exceeded') };

    await expect(host.close('sess1')).rejects.toThrow('volume v-1: Error: quota exceeded');

    expect(pauses).toEqual([]);
  });

  // One try per volume, like everywhere else here.
  it('still deletes the second volume when the first one is refused', async () => {
    block.volumes = [scwBlockVolume('v-1', owned('sess1')), scwBlockVolume('v-2', owned('sess1'))];
    block.failOn = 'deleteVolume v-1';

    await expect(host.close('sess1')).rejects.toThrow('v-1');

    expect(block.volumes.map((volume) => volume.id)).toEqual(['v-1']);
  });

  // A sweep, or an earlier close(), deleted it between the list and the call.
  it('treats a volume that is already gone as closed', async () => {
    block.volumes = [scwBlockVolume('v-1', owned('sess1'))];
    block.failWith = { call: 'deleteVolume', error: volumeNotFound() };

    await expect(host.close('sess1')).resolves.toBeUndefined();
    expect(pauses).toEqual([]);
  });

  it('treats a volume its dead server named, and the provider no longer holds, as closed', async () => {
    api.servers = [scwServer('s-1', owned('sess1'), 'stopped', [], ['v-1'])];

    await expect(host.close('sess1')).resolves.toBeUndefined();
    expect(pauses).toEqual([]);
  });

  it('fails when the block api refuses the listing, the ips and servers already destroyed', async () => {
    api.servers = [scwServer('s-1', owned('sess1'))];
    api.ips = [scwIp('ip-1', '51.15.0.1', owned('sess1'))];
    block.failOn = 'listVolumes';

    await expect(host.close('sess1')).rejects.toThrow('volumes: Error: scaleway refused listVolumes');

    expect(api.servers).toEqual([]);
    expect(api.ips).toEqual([]);
  });

  it('still deletes a detached volume when a server refuses to die, and reports both', async () => {
    api.servers = [scwServer('s-1', owned('sess1'))];
    api.failOn = 'terminate';
    block.volumes = [scwBlockVolume('v-1', owned('sess1')), scwBlockVolume('v-2', owned('sess1'), true)];

    await expect(host.close('sess1')).rejects.toThrow(/server s-1: .*volume v-2: still attached/);

    expect(block.volumes.map((volume) => volume.id)).toEqual(['v-2']);
  });
});

describe('sweeping the block volumes', () => {
  it('destroys a detached volume carrying both tags, and names its session', async () => {
    block.volumes = [scwBlockVolume('v-1', owned('sess1'))];

    const sweep = await host.sweepUnclaimed();

    expect(sweep).toEqual({ destroyed: ['volume v-1 of session sess1'], stranded: [], errors: [] });
    expect(block.volumes).toEqual([]);
  });

  it('destroys a detached volume carrying the ownership tag alone', async () => {
    block.volumes = [scwBlockVolume('v-1', owned())];

    expect((await host.sweepUnclaimed()).destroyed).toEqual(['volume v-1']);
    expect(block.volumes).toEqual([]);
  });

  // Two sessions claimed is no session known: the volume is still ours, and
  // still detached, so it dies without a name.
  it('destroys a volume claimed by two sessions without naming either', async () => {
    block.volumes = [scwBlockVolume('v-1', [...owned('sess1'), sessionTag('sess2')])];

    expect((await host.sweepUnclaimed()).destroyed).toEqual(['volume v-1']);
  });

  it('asks for the whole listing, with no tag', async () => {
    await host.sweepUnclaimed();

    expect(block.calls).toEqual(['listVolumes']);
  });

  it('leaves alone an attached volume, whatever it carries', async () => {
    block.volumes = [
      scwBlockVolume('v-1', owned('sess1'), true),
      scwBlockVolume('v-2', [], true),
    ];

    const sweep = await host.sweepUnclaimed();

    expect(sweep).toEqual({ destroyed: [], stranded: [], errors: [] });
    expect(block.calls).toEqual(['listVolumes']);
  });

  // Without the ownership tag nothing proves the volume is ours: a session
  // tag alone is a word anyone can write.
  it('reports a detached volume without the ownership tag, and never deletes it', async () => {
    block.volumes = [
      scwBlockVolume('v-1'),
      scwBlockVolume('v-2', [sessionTag('sess1')]),
      scwBlockVolume('v-3', ['beacon-probe']),
    ];

    const sweep = await host.sweepUnclaimed();

    expect(sweep.stranded).toEqual(['volume v-1 (40 GB)', 'volume v-2 (40 GB)', 'volume v-3 (40 GB)']);
    expect(sweep.destroyed).toEqual([]);
    expect(block.calls).toEqual(['listVolumes']);
  });

  it('reports the local volumes before the block ones', async () => {
    api.volumes = [scwVolume('v-l')];
    block.volumes = [scwBlockVolume('v-b')];

    expect((await host.sweepUnclaimed()).stranded).toEqual(['volume v-l (80 GB)', 'volume v-b (40 GB)']);
  });

  it('fails when the block api refuses the listing, before anything is destroyed', async () => {
    api.ips = [scwIp('ip-1', '51.15.0.1', owned())];
    api.servers = [scwServer('s-1', owned())];
    block.failOn = 'listVolumes';

    await expect(host.sweepUnclaimed()).rejects.toThrow('scaleway refused listVolumes');
    expect(api.calls.filter((c) => !c.startsWith('list'))).toEqual([]);
  });

  it('carries on past a refused deletion, and records both sides of it', async () => {
    block.volumes = [scwBlockVolume('v-1', owned('sess1')), scwBlockVolume('v-2', owned('sess2'))];
    block.failOn = 'deleteVolume v-1';

    const sweep = await host.sweepUnclaimed();

    expect(sweep.destroyed).toEqual(['volume v-2 of session sess2']);
    expect(sweep.errors).toEqual(['volume v-1: Error: scaleway refused deleteVolume v-1']);
  });

  // The listing and the deletion disagree for a moment. The sweep does not
  // wait: it says so, and the next pass asks again.
  it('records a volume the listing called detached and the deletion called in use', async () => {
    block.volumes = [scwBlockVolume('v-1', owned('sess1'))];
    block.failWith = { call: 'deleteVolume v-1', error: volumeInUse() };

    const sweep = await host.sweepUnclaimed();

    expect(sweep.destroyed).toEqual([]);
    expect(sweep.errors).toHaveLength(1);
    expect(sweep.errors[0]).toContain('v-1');
  });

  it('counts a volume that is already gone as neither destroyed nor refused', async () => {
    block.volumes = [scwBlockVolume('v-1', owned('sess1'))];
    block.failWith = { call: 'deleteVolume v-1', error: volumeNotFound() };

    expect(await host.sweepUnclaimed()).toEqual({ destroyed: [], stranded: [], errors: [] });
  });

  it('destroys the ips and the servers before the volumes', async () => {
    api.ips = [scwIp('ip-1', '51.15.0.1', owned())];
    api.servers = [scwServer('s-1', owned())];
    block.volumes = [scwBlockVolume('v-1', owned())];

    expect((await host.sweepUnclaimed()).destroyed).toEqual(['ip 51.15.0.1', 'server s-1', 'volume v-1']);
  });

  // The Instance API answers 404 for a block volume, which would read as a
  // deletion. And the sweep does not wait for a detachment: the volume of the
  // server it has just destroyed is the next pass's.
  it('leaves the block volume of a stray server to the pass after it detached', async () => {
    api.servers = [scwServer('s-1', owned(), 'stopped', ['v-l'], ['v-b'])];
    block.volumes = [scwBlockVolume('v-b', owned(), true)];

    const first = await host.sweepUnclaimed();

    expect(api.calls.filter((c) => c.startsWith('deleteVolume'))).toEqual(['deleteVolume v-l']);
    expect(block.calls).toEqual(['listVolumes']);
    expect(first.destroyed).toEqual(['server s-1']);

    block.detach('v-b');

    expect((await host.sweepUnclaimed()).destroyed).toEqual(['volume v-b']);
    expect(block.volumes).toEqual([]);
  });
});

describe('a close() and a sweep after the same volume', () => {
  /** Runs `rival` once, just before the next block deletion goes through. */
  const beforeNextDeletion = (rival: () => Promise<void>) => {
    const deleteVolume = block.deleteVolume.bind(block);
    block.deleteVolume = async (request) => {
      block.deleteVolume = deleteVolume;
      await rival();
      return deleteVolume(request);
    };
  };

  beforeEach(() => {
    block.volumes = [scwBlockVolume('v-1', owned('sess1'))];
  });

  it('closes a session whose volume a sweep has already destroyed', async () => {
    await host.sweepUnclaimed();

    await expect(host.close('sess1')).resolves.toBeUndefined();
    expect(pauses).toEqual([]);
  });

  it('lets close() succeed when the sweep deletes the volume between its listing and its deletion', async () => {
    let sweep: UnclaimedSweep | undefined;
    beforeNextDeletion(async () => {
      sweep = await host.sweepUnclaimed();
    });

    await expect(host.close('sess1')).resolves.toBeUndefined();
    expect(sweep).toEqual({ destroyed: ['volume v-1 of session sess1'], stranded: [], errors: [] });
    expect(block.volumes).toEqual([]);
  });

  it('lets the sweep go on when close() deletes the volume between its listing and its deletion', async () => {
    beforeNextDeletion(() => host.close('sess1'));

    expect(await host.sweepUnclaimed()).toEqual({ destroyed: [], stranded: [], errors: [] });
    expect(block.volumes).toEqual([]);
  });
});
