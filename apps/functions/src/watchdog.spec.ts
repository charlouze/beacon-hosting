import {
  DEFAULT_LIMITS,
  type HostedServer,
  type ServerHost,
  type UnclaimedSweep,
} from '@beacon/session';
import {
  FakeInstanceApi,
  OWNERSHIP_TAG,
  ScalewayServerHost,
  scwServer,
  sessionTag,
} from '@beacon/scaleway-compute';
import { serverStateStore } from '@beacon/session-record';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { provisioningLedger, type ProvisioningLedger } from './provisioning-ledger.js';
import { runWatchdog, type WatchdogDeps } from './watchdog.js';
import { watchdogHealth } from './watchdog-health.js';

process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';

const NOW = new Date('2026-09-04T21:00:00Z');
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000);

const QUIET: UnclaimedSweep = { destroyed: [], stranded: [], errors: [] };

class FakeServerHost implements ServerHost {
  readonly closed: string[] = [];
  sweep: UnclaimedSweep = QUIET;
  /** The provider unreachable: the listing itself refuses, nothing is seen. */
  refuseSweep = false;
  refuse = new Set<string>();
  /** Lets a test make the world move while the inventory is in flight. */
  onList: (() => Promise<void>) | null = null;
  /** True from the moment the inventory has been handed back. */
  listed = false;

  constructor(public hosted: HostedServer[] = []) {}

  async list(): Promise<HostedServer[]> {
    if (this.onList !== null) await this.onList();
    this.listed = true;
    return this.hosted;
  }

  async close(sessionId: string): Promise<void> {
    if (this.refuse.has(sessionId)) throw new Error(`scaleway refused ${sessionId}`);
    this.closed.push(sessionId);
  }

  async sweepUnclaimed(): Promise<UnclaimedSweep> {
    if (this.refuseSweep) throw new Error('scaleway refused the listing');
    return this.sweep;
  }
}

const hosted = (sessionId: string): HostedServer => ({ sessionId, summary: `held ${sessionId}` });

let app: ReturnType<typeof initializeApp>;
let db: Firestore;
let host: FakeServerHost;

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-beacon' }, 'watchdog-spec');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await db.recursiveDelete(db.collection('events'));
  await db.recursiveDelete(db.collection('provisioning'));
  await db.doc('server/current').delete();
  await db.doc('health/watchdog').delete();
  host = new FakeServerHost();
});

/**
 * Makes the order of the reads a structural fact instead of a race. Watching
 * the effect — a machine born mid-pass and spared — needs the intent write to
 * land before the query, and against a `Promise.all` both are dispatched in
 * the same tick over two streams: the observation would be a coin flip, in the
 * suite §10 makes the merge gate. Here the delegation itself refuses to answer
 * before the inventory has come back.
 */
const afterTheInventory = (inner: ProvisioningLedger): ProvisioningLedger => ({
  openSessions: async () => {
    expect(host.listed).toBe(true);
    return inner.openSessions();
  },
  close: (sessionId, at) => inner.close(sessionId, at),
});

const deps = (): WatchdogDeps => ({
  clock: { now: () => NOW },
  host,
  state: serverStateStore(db),
  ledger: afterTheInventory(provisioningLedger(db)),
  health: watchdogHealth(db),
  limits: DEFAULT_LIMITS,
});

const eventTypes = async () =>
  (await db.collection('events').get()).docs.map((d) => d.data()['type']).sort();

describe('runWatchdog', () => {
  it('beats and does nothing else on an empty project', async () => {
    await runWatchdog(deps());

    expect(host.closed).toEqual([]);
    expect(await eventTypes()).toEqual([]);
    expect((await db.doc('health/watchdog').get()).exists).toBe(true);
  });

  it('destroys a hosted session no open intent explains, and closes its intent', async () => {
    host.hosted = [hosted('sess1')];
    await db.doc('provisioning/sess1').set({ closedAt: NOW });

    await runWatchdog(deps());

    expect(host.closed).toEqual(['sess1']);
    expect(await eventTypes()).toEqual(['SessionReclaimed']);
  });

  it('leaves alone a session whose intent is open', async () => {
    host.hosted = [hosted('sess1')];
    await db.doc('provisioning/sess1').set({ closedAt: null });

    await runWatchdog(deps());

    expect(host.closed).toEqual([]);
    expect(await eventTypes()).toEqual([]);
  });

  // Leaving the intent alone is what brings the watchdog back to this session
  // on the next pass instead of forgetting it.
  it('records a refused destruction and does not close the intent', async () => {
    host.hosted = [hosted('sess1')];
    host.refuse.add('sess1');
    await db.doc('provisioning/sess1').set({ closedAt: null });
    // An open intent alone would spare it; the record says otherwise.
    await db.doc('server/current').set({
      state: 'STOPPING',
      sessionId: 'sess1',
      stateSince: minutesAgo(11),
      instanceId: 'i-1',
    });

    await runWatchdog(deps());

    expect(await eventTypes()).toEqual(['CleanupFailed']);
    expect(await provisioningLedger(db).openSessions()).toEqual(['sess1']);
  });

  // The failure the probe produced on 2026-09-03, taken one step further than
  // it was observed: a throw inside the loop ended the pass after a successful
  // destruction. With two sessions, the second would have lived. This is the
  // component that exists to make sure it does not.
  it('destroys the second session even when the first one refuses', async () => {
    host.hosted = [hosted('sess1'), hosted('sess2')];
    host.refuse.add('sess1');

    await runWatchdog(deps());

    expect(host.closed).toEqual(['sess2']);
    expect(await eventTypes()).toEqual(['CleanupFailed', 'SessionReclaimed']);
  });

  it('records the sweep of what carries no session tag', async () => {
    host.sweep = { ...QUIET, destroyed: ['ip 51.15.0.1'] };

    await runWatchdog(deps());

    const [event] = (await db.collection('events').get()).docs;
    expect(event.data()['type']).toBe('SessionReclaimed');
    expect(event.data()['sessionId']).toBeNull();
  });

  // §6's third list. Nothing is destroyed and nothing will be: the entry in
  // the audit is the whole action, and it is what makes a stranded 80 GB disk
  // findable by a human before it has been billed for a month.
  it('records a stranded volume it deliberately did not destroy', async () => {
    host.sweep = { ...QUIET, stranded: ['volume v-1 (80 GB)'] };

    await runWatchdog(deps());

    const [event] = (await db.collection('events').get()).docs;
    expect(event.data()['type']).toBe('ResourceStranded');
    expect(event.data()['detail']).toBe('volume v-1 (80 GB)');
    expect(host.closed).toEqual([]);
  });

  // The reason the pass has to remember. Nothing destroys that volume, so it
  // is stranded again in five minutes, and again after that: 288 facts a day
  // in the collection §11 queries to total the month.
  it('announces a stranded volume once, not on every pass', async () => {
    host.sweep = { ...QUIET, stranded: ['volume v-1 (80 GB)'] };

    await runWatchdog(deps());
    await runWatchdog(deps());

    expect(await eventTypes()).toEqual(['ResourceStranded']);
  });

  it('announces again a volume that disappeared and came back', async () => {
    host.sweep = { ...QUIET, stranded: ['volume v-1 (80 GB)'] };
    await runWatchdog(deps());
    host.sweep = QUIET;
    await runWatchdog(deps());

    host.sweep = { ...QUIET, stranded: ['volume v-1 (80 GB)'] };
    await runWatchdog(deps());

    expect(await eventTypes()).toEqual(['ResourceStranded', 'ResourceStranded']);
  });

  // A pass that could not look has not seen the volume disappear. Recording an
  // empty set here would claim nothing is stranded — false for five minutes —
  // and re-announce everything on the next pass: the same bug, in miniature.
  it('keeps what it had announced when the sweep itself is refused', async () => {
    host.sweep = { ...QUIET, stranded: ['volume v-1 (80 GB)'] };
    await runWatchdog(deps());

    host.refuseSweep = true;
    await runWatchdog(deps());

    expect(await eventTypes()).toEqual(['CleanupFailed', 'ResourceStranded']);
    const health = (await db.doc('health/watchdog').get()).data();
    expect(health?.['stranded']).toEqual(['volume v-1 (80 GB)']);
  });

  // The other half of the value: the journal says when a volume appeared, the
  // document says what is stranded right now.
  it('records what is stranded now beside the beat', async () => {
    host.sweep = { ...QUIET, stranded: ['volume v-1 (80 GB)'] };

    await runWatchdog(deps());

    const health = (await db.doc('health/watchdog').get()).data();
    expect(health?.['stranded']).toEqual(['volume v-1 (80 GB)']);
    expect(health?.['lastRunAt'].toDate()).toEqual(NOW);
  });

  // The order of the three reads is load-bearing, and this is the only test
  // that can say so. §6 writes the intent BEFORE calling the provider, so an
  // inventory taken first can only ever be explained by intents read after it.
  // Read together, a machine created between the two reads looks unexplained —
  // and gets destroyed on its first minute of life.
  it('reads the open intents after the inventory, never alongside it', async () => {
    host.hosted = [hosted('sess1')];
    host.onList = async () => {
      await db.doc('provisioning/sess1').set({ closedAt: null });
    };

    await runWatchdog(deps());

    expect(host.closed).toEqual([]);
  });

  it('beats even when a destruction failed — the pass still happened', async () => {
    host.hosted = [hosted('sess1')];
    host.refuse.add('sess1');

    await runWatchdog(deps());

    expect((await db.doc('health/watchdog').get()).exists).toBe(true);
  });

  it('destroys and grounds a session stuck in PROVISIONING past the limit', async () => {
    host.hosted = [hosted('sess1')];
    await db.doc('provisioning/sess1').set({ closedAt: null });
    await db.doc('server/current').set({
      state: 'PROVISIONING',
      sessionId: 'sess1',
      stateSince: minutesAgo(16),
      instanceId: 'i-1',
      joinInfo: { serverId: 'abc~123' },
      provisionClaimedAt: minutesAgo(16),
    });

    await runWatchdog(deps());

    expect(host.closed).toEqual(['sess1']);
    const after = (await db.doc('server/current').get()).data();
    expect(after?.['state']).toBe('IDLE');
    expect(after?.['instanceId']).toBeNull();
    // The two the plan forgot once: without them, the next session shows a dead
    // join point and can never be provisioned at all.
    expect(after?.['joinInfo']).toBeNull();
    expect(after?.['provisionClaimedAt']).toBeNull();
    expect(await eventTypes()).toEqual(['ProvisioningFailed']);
  });

  // The only test that composes the real adapter with the real watchdog.
  // watchdog.spec drives a fake host, scaleway-server-host.spec drives a fake
  // api, and the seam between the two is precisely what neither can see: that
  // the adapter's aggregated throw is what reconcile reads as an unguaranteed
  // cleanup. The ledger is the undecorated one — the ordering assertion above
  // watches the fake host, and this test does not use it.
  it('turns a refusal from the real adapter into CleanupFailed, intent left open', async () => {
    const api = new FakeInstanceApi([scwServer('s-1', [OWNERSHIP_TAG, sessionTag('sess1')])]);
    api.failOn = 'terminate';
    await db.doc('provisioning/sess1').set({ closedAt: null });
    await db.doc('server/current').set({
      state: 'STOPPING',
      sessionId: 'sess1',
      stateSince: minutesAgo(11),
      instanceId: 'i-1',
    });

    await runWatchdog({
      ...deps(),
      host: new ScalewayServerHost(api),
      ledger: provisioningLedger(db),
    });

    const [event] = (await db.collection('events').get()).docs;
    expect(event.data()['type']).toBe('CleanupFailed');
    expect(event.data()['detail']).toContain('s-1');
    expect((await db.doc('server/current').get()).data()?.['state']).toBe('FAILED');
    expect(await provisioningLedger(db).openSessions()).toEqual(['sess1']);
    expect(api.servers).toHaveLength(1);
  });

  it('sends a record to FAILED when the cleanup could not be guaranteed', async () => {
    host.hosted = [hosted('sess1')];
    host.refuse.add('sess1');
    await db.doc('provisioning/sess1').set({ closedAt: null });
    await db.doc('server/current').set({
      state: 'STOPPING',
      sessionId: 'sess1',
      stateSince: minutesAgo(11),
      instanceId: 'i-1',
    });

    await runWatchdog(deps());

    expect((await db.doc('server/current').get()).data()?.['state']).toBe('FAILED');
  });
});
