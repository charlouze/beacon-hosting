import { beforeEach, describe, expect, it } from 'vitest';
import { FakeInstanceApi, scwIp, scwServer, scwVolume } from './fake-instance-api.js';
import { ScalewayServerHost } from './scaleway-server-host.js';
import { OWNERSHIP_TAG, sessionTag } from './tags.js';

const owned = (sessionId?: string) =>
  sessionId === undefined ? [OWNERSHIP_TAG] : [OWNERSHIP_TAG, sessionTag(sessionId)];

let api: FakeInstanceApi;
let host: ScalewayServerHost;

beforeEach(() => {
  api = new FakeInstanceApi();
  host = new ScalewayServerHost(api);
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

  it('kills a running server with terminate, which takes its volumes along', async () => {
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
