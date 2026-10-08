import { beforeEach, describe, expect, it } from 'vitest';
import { World } from '@beacon/session';
import { FakeBlockApi, scwBlockVolume, volumeInUse, volumeNotFound } from './fake-block-api.js';
import { FakeInstanceApi, scwIp, scwServer, scwVolume } from './fake-instance-api.js';
import { ScalewayServerHost, type DetachmentWait } from './scaleway-server-host.js';
import { OWNERSHIP_TAG, sessionTag } from './tags.js';

const owned = (sessionId?: string) =>
  sessionId === undefined ? [OWNERSHIP_TAG] : [OWNERSHIP_TAG, sessionTag(sessionId)];

const images = { resolve: async () => 'img-1' };

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
  host = new ScalewayServerHost(api, block, images, wait);
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
    await expect(new ScalewayServerHost(api, block, images, wait).close('s1')).resolves.toBeUndefined();
  });

  it('treats a server that is already gone as closed', async () => {
    const api = new FakeInstanceApi([scwServer('srv-1', ['beacon', 'session:s1'])]);
    api.failWith = { call: 'terminate', error: notFound() };
    await expect(new ScalewayServerHost(api, block, images, wait).close('s1')).resolves.toBeUndefined();
  });

  // The distinction that matters: a refusal is still a refusal. Swallowing
  // every error under the name of idempotence would make the watchdog report
  // success on a provider that is simply unreachable.
  it('still refuses when the provider says something else', async () => {
    const api = new FakeInstanceApi([], [scwIp('ip-1', '1.2.3.4', ['beacon', 'session:s1'])]);
    api.failWith = { call: 'deleteIp', error: new Error('quota exceeded') };
    await expect(new ScalewayServerHost(api, block, images, wait).close('s1')).rejects.toThrow(/quota/);
  });
});

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

  // §6, the third list: signalé, jamais détruit. A volume carries no tag, so
  // nothing proves it is ours, and deleting someone else's disk is the one
  // mistake this component may not make.
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

  it('carries both tags on the ip and on the server, from creation', async () => {
    const api = new FakeInstanceApi();
    await new ScalewayServerHost(api, block, images, wait).open(REQUEST);
    expect(api.ips[0].tags).toEqual(owned('s1'));
    expect(api.servers[0].tags).toEqual(owned('s1'));
  });

  // The ip first, and this is the order the sequence exists for: the address
  // is known before the machine is, which is what lets a join point be
  // announced. It is also what makes the resource reapable if the next call
  // fails — an untagged ip created after a tagged server would be invisible.
  it('reserves the ip before it creates the server', async () => {
    const api = new FakeInstanceApi();
    await new ScalewayServerHost(api, block, images, wait).open(REQUEST);
    expect(api.calls.filter((c) => c.startsWith('create'))).toEqual([
      'createIp beacon+session:s1',
      'createServer beacon+session:s1',
    ]);
  });

  // There is no second chance at first boot: user data posted after poweron
  // is read by nothing, and the machine sits there billed and empty.
  it('posts the cloud-init before it powers the machine on', async () => {
    const api = new FakeInstanceApi();
    await new ScalewayServerHost(api, block, images, wait).open(REQUEST);
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
    const api = new FakeInstanceApi();
    const opened = await new ScalewayServerHost(api, block, images, wait).open(REQUEST);
    expect(opened.address).toBe('51.15.0.1');
    expect(opened.size).toBe('DEV1-L');
    expect(opened.references).toEqual({ instanceId: 'srv-1', ipId: 'ip-1' });
  });

  // The failure that costs money. An ip created and then abandoned keeps
  // billing, and carries the tags that would let the watchdog find it — so the
  // honest thing is to say what exists, not to hide it behind a bare throw.
  it('names the ip it already created when the server refuses', async () => {
    const api = new FakeInstanceApi();
    api.failOn = 'createServer';
    await expect(new ScalewayServerHost(api, block, images, wait).open(REQUEST)).rejects.toThrow(
      /ip ip-1 is tagged session:s1/,
    );
  });

  it('refuses to open when no image matches the size', async () => {
    const api = new FakeInstanceApi();
    const none = { resolve: async () => null };
    await expect(new ScalewayServerHost(api, block, none, wait).open(REQUEST)).rejects.toThrow(
      /no ubuntu image/,
    );
    expect(api.calls).toEqual([]);
  });
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
    host = new ScalewayServerHost(api, block, images, { ...wait, budgetMs: 2_500 });

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

describe('sweepUnclaimed and a block volume', () => {
  it('never asks the instance api to delete the block volume of a stray server', async () => {
    api.servers = [scwServer('s-1', owned(), 'stopped', ['v-l'], ['v-b'])];

    await host.sweepUnclaimed();

    expect(api.calls.filter((c) => c.startsWith('deleteVolume'))).toEqual(['deleteVolume v-l']);
    expect(block.calls).toEqual([]);
  });
});
