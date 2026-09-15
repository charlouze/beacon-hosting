import {
  DEFAULT_LIMITS,
  DEFAULT_SETTINGS,
  World,
  type HostedServer,
  type OpenedServer,
  type OpenServerRequest,
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
import { adminWorldRecord, settingsStore, systemEvents, worldStateStores } from '@beacon/session-record';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { provisioningLedger, type ProvisioningLedger } from './provisioning-ledger.js';
import { runWatchdog, type WatchdogDeps } from './watchdog.js';
import { watchdogHealth } from './watchdog-health.js';

process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';

const NOW = new Date('2026-09-04T21:00:00Z');
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000);
const minutesAhead = (n: number) => new Date(NOW.getTime() + n * 60_000);

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

  // Never exercised: this fake drives the watchdog, which only closes and
  // sweeps. A body is required to satisfy `ServerHost`, not to be called.
  async open(_request: OpenServerRequest): Promise<OpenedServer> {
    throw new Error('FakeServerHost.open is not exercised by the watchdog');
  }

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
let ledger: ProvisioningLedger;

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
  await db.recursiveDelete(db.collection('worlds'));
  await db.doc('health/watchdog').delete();
  host = new FakeServerHost();
  ledger = provisioningLedger(db);
});

const aWorld = (worldId: string) =>
  World.from({ worldId, game: 'enshrouded', name: 'World', inviteCode: 'code', players: [] });

/**
 * `worlds/{worldId}/server/current`, in one call — the world document created
 * once, on first use, and the server document set to exactly `fields`, the
 * same discipline the old single-world tests wrote against root
 * `server/current` before this task moved it under a world.
 */
async function seedWorld(worldId: string, fields: Record<string, unknown>): Promise<void> {
  const worldDoc = await db.doc(`worlds/${worldId}`).get();
  if (!worldDoc.exists) await adminWorldRecord(db).create(aWorld(worldId), NOW);
  // `startedAt` defaults to `stateSince` when the caller does not name one:
  // every fixture that cares about `Session` (RUNNING here) already carries
  // its own `stateSince`, and a session started when its state began is the
  // ordinary case, not a guess this helper invents beyond what the caller gave.
  const defaults = fields['state'] === 'IDLE' || fields['state'] === undefined
    ? {}
    : { startedAt: fields['stateSince'], startedBy: 'u1' };
  await db.doc(`worlds/${worldId}/server/current`).set({ ...defaults, ...fields });
}

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
  open: (sessionId, intent, at) => inner.open(sessionId, intent, at),
  record: (sessionId, facts) => inner.record(sessionId, facts),
  read: (sessionId) => inner.read(sessionId),
  close: (sessionId, at) => inner.close(sessionId, at),
  worldOf: (sessionId) => inner.worldOf(sessionId),
});

const deps = (): WatchdogDeps => ({
  clock: { now: () => NOW },
  host,
  states: worldStateStores(db),
  events: systemEvents(db),
  ledger: afterTheInventory(ledger),
  health: watchdogHealth(db),
  settings: settingsStore(db),
  limits: DEFAULT_LIMITS,
});

const eventTypes = async () =>
  (await db.collection('events').get()).docs.map((d) => d.data()['type']).sort();

/**
 * A world where the record is idle, clean, and a previous pass saw a volume.
 * Spy-based and its own thing: `deps()` above drives real Firestore and a
 * fake `ServerHost` instance, which the quiet-sweep assertions — "the
 * provider was never asked" — cannot see through. Rebuilding `deps()` to be
 * spy-based would break the eighteen tranche-1 tests it already serves.
 */
const quietDeps = (previous: { sweptAt: Date | null }): WatchdogDeps => ({
  clock: { now: () => NOW },
  host: {
    open: vi.fn(),
    list: vi.fn(async () => []),
    close: vi.fn(),
    sweepUnclaimed: vi.fn(async () => QUIET),
  },
  states: {
    for: vi.fn(() => ({
      read: vi.fn(async () => ({
        state: 'IDLE' as const,
        sessionId: null,
        stateSince: null,
        hasReservedFacts: false,
      })),
      readSession: vi.fn(async () => null),
      claimProvisioning: vi.fn(),
      publish: vi.fn(),
      apply: vi.fn(),
    })),
    all: vi.fn(async () => ['w1']),
  },
  events: { file: vi.fn() },
  ledger: {
    openSessions: vi.fn(async () => []),
    open: vi.fn(),
    record: vi.fn(),
    read: vi.fn(async () => null),
    close: vi.fn(),
    worldOf: vi.fn(async () => null),
  },
  health: {
    previousPass: vi.fn(async () => ({ stranded: ['volume v1'], sweptAt: previous.sweptAt })),
    beat: vi.fn(async () => undefined),
  },
  settings: { read: vi.fn(async () => DEFAULT_SETTINGS) },
  limits: DEFAULT_LIMITS,
});

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
    await seedWorld('w1', {
      state: 'STOPPING',
      sessionId: 'sess1',
      stateSince: minutesAgo(11),
      instanceId: 'i-1',
    });

    await runWatchdog(deps());

    expect(await eventTypes()).toEqual(['CleanupFailed']);
    expect(await ledger.openSessions()).toEqual(['sess1']);
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
    await seedWorld('w1', {
      state: 'PROVISIONING',
      sessionId: 'sess1',
      stateSince: minutesAgo(26),
      instanceId: 'i-1',
      joinInfo: { serverId: 'abc~123' },
      provisionClaimedAt: minutesAgo(26),
    });

    await runWatchdog(deps());

    expect(host.closed).toEqual(['sess1']);
    const after = (await db.doc('worlds/w1/server/current').get()).data();
    expect(after?.['state']).toBe('IDLE');
    expect(after?.['instanceId']).toBeNull();
    // The two the plan forgot once: without them, the next session shows a dead
    // join point and can never be provisioned at all.
    expect(after?.['joinInfo']).toBeNull();
    expect(after?.['provisionClaimedAt']).toBeNull();
    expect(await eventTypes()).toEqual(['ProvisioningFailed']);
  });

  // Task 9 bis, and the load-bearing rule of the whole tranche: a deadline
  // finishes a session, it does not seize its resources. Destroying here is
  // exactly the bug the whole-branch review found — the machine was gone
  // before the agent ever learned it was stopping, and `pre-shutdown` never
  // meant anything.
  it('writes STOPPING and destroys nothing once a deadline passes the grace', async () => {
    host.hosted = [hosted('sess1')];
    await db.doc('provisioning/sess1').set({ closedAt: null });
    await seedWorld('w1', {
      state: 'RUNNING',
      sessionId: 'sess1',
      startedBy: 'u1',
      startedAt: minutesAgo(60),
      deadline: minutesAgo(3),
      stateSince: minutesAgo(60),
      instanceId: 'i-1',
      ipId: 'ip-1',
      ip: '1.2.3.4',
    });

    await runWatchdog(deps());

    expect(host.closed).toEqual([]);
    const after = (await db.doc('worlds/w1/server/current').get()).data();
    expect(after?.['state']).toBe('STOPPING');
    expect(after?.['stateSince'].toDate()).toEqual(NOW);
    // Untouched: the machine is still alive, and the clean shutdown of §6
    // needs it to stay that way until the agent reports back.
    expect(after?.['instanceId']).toBe('i-1');
    expect(await eventTypes()).toEqual(['SessionExpired']);
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
    await seedWorld('w1', {
      state: 'STOPPING',
      sessionId: 'sess1',
      stateSince: minutesAgo(11),
      instanceId: 'i-1',
    });

    await runWatchdog({
      ...deps(),
      host: new ScalewayServerHost(api, { resolve: async () => null }),
      ledger,
    });

    const [event] = (await db.collection('events').get()).docs;
    expect(event.data()['type']).toBe('CleanupFailed');
    expect(event.data()['detail']).toContain('s-1');
    expect((await db.doc('worlds/w1/server/current').get()).data()?.['state']).toBe('FAILED');
    expect(await ledger.openSessions()).toEqual(['sess1']);
    expect(api.servers).toHaveLength(1);
  });

  it('sends a record to FAILED when the cleanup could not be guaranteed', async () => {
    host.hosted = [hosted('sess1')];
    host.refuse.add('sess1');
    await db.doc('provisioning/sess1').set({ closedAt: null });
    await seedWorld('w1', {
      state: 'STOPPING',
      sessionId: 'sess1',
      stateSince: minutesAgo(11),
      instanceId: 'i-1',
    });

    await runWatchdog(deps());

    expect((await db.doc('worlds/w1/server/current').get()).data()?.['state']).toBe('FAILED');
  });

  // Task 12: one pass, every world, each getting its own correction from its
  // own outcomes only — the reconcile.ts contract this task exists to honour.
  it('handles two worlds in two states in one pass', async () => {
    await seedWorld('a', {
      state: 'RUNNING',
      sessionId: 's-a',
      deadline: minutesAgo(10),
      stateSince: minutesAgo(240),
      instanceId: 'i-a',
    });
    await seedWorld('b', {
      state: 'RUNNING',
      sessionId: 's-b',
      deadline: minutesAhead(200),
      stateSince: minutesAgo(30),
      instanceId: 'i-b',
    });
    await ledger.open('s-a', { worldId: 'a', tag: sessionTag('s-a'), instanceSize: 'DEV1-L' }, minutesAgo(240));
    await ledger.open('s-b', { worldId: 'b', tag: sessionTag('s-b'), instanceSize: 'DEV1-L' }, minutesAgo(30));
    host.hosted = [{ sessionId: 's-a', summary: 'a' }, { sessionId: 's-b', summary: 'b' }];

    await runWatchdog(deps());

    expect((await db.doc('worlds/a/server/current').get()).get('state')).toBe('STOPPING');
    expect((await db.doc('worlds/b/server/current').get()).get('state')).toBe('RUNNING');
    expect(host.closed).toEqual([]);
    const events = await db.collection('events').get();
    expect(events.docs.map((d) => [d.get('type'), d.get('worldId')])).toEqual([['SessionExpired', 'a']]);
  });

  // The unexplained belong to the pass, never to a world (reconcile.ts):
  // filed once, through `SystemEvents`, whatever worlds happen to be open.
  it('files what the sweep found once, with no world', async () => {
    await seedWorld('a', { state: 'IDLE' });
    await seedWorld('b', { state: 'IDLE' });
    host.sweep = { destroyed: ['ip-ghost'], stranded: [], errors: [] };

    await runWatchdog(deps());

    const events = await db.collection('events').get();
    expect(events.size).toBe(1);
    expect(events.docs[0].get('worldId')).toBeNull();
  });

  // The contract task 12 exists to honour, with a real destruction on each
  // side: `own` must be this world's outcomes and no other's, or the same
  // stuck session would be filed twice — once per world it was handed to.
  it('destroys a stuck session in each of two worlds, filed once and to its own world', async () => {
    await seedWorld('a', {
      state: 'STOPPING',
      sessionId: 's-a',
      stateSince: minutesAgo(11),
      instanceId: 'i-a',
    });
    await seedWorld('b', {
      state: 'STOPPING',
      sessionId: 's-b',
      stateSince: minutesAgo(11),
      instanceId: 'i-b',
    });
    host.hosted = [hosted('s-a'), hosted('s-b')];

    await runWatchdog(deps());

    expect(host.closed.sort()).toEqual(['s-a', 's-b']);
    const events = await db.collection('events').get();
    expect(
      events.docs.map((d) => [d.get('type'), d.get('sessionId'), d.get('worldId')]).sort(),
    ).toEqual([
      ['SessionStopped', 's-a', 'a'],
      ['SessionStopped', 's-b', 'b'],
    ]);
    expect((await db.doc('worlds/a/server/current').get()).get('state')).toBe('IDLE');
    expect((await db.doc('worlds/b/server/current').get()).get('state')).toBe('IDLE');
  });

  // The sentinel path (no world explains the machine) counted once whatever
  // the number of open worlds — previously only exercised with zero worlds,
  // where the loop over `view.worlds` never ran at all.
  it('destroys a machine no world explains once, whatever worlds are open', async () => {
    await seedWorld('a', { state: 'IDLE' });
    await seedWorld('b', { state: 'IDLE' });
    host.hosted = [hosted('ghost')];

    await runWatchdog(deps());

    expect(host.closed).toEqual(['ghost']);
    const events = await db.collection('events').get();
    expect(events.docs.map((d) => [d.get('type'), d.get('sessionId'), d.get('worldId')])).toEqual(
      [['SessionReclaimed', 'ghost', null]],
    );
  });
});

describe('a pass with nothing open', () => {
  // The whole point: five api calls per pass, 8 640 times a month, to find
  // nothing. Skipping them is safe because §11 makes the started hour due on
  // each resource — a stray reclaimed at thirty minutes costs what it would
  // at five.
  it('asks the provider nothing when the last sweep is recent', async () => {
    const deps = quietDeps({ sweptAt: new Date(NOW.getTime() - 5 * 60_000) });
    await runWatchdog(deps);
    expect(deps.host.list).not.toHaveBeenCalled();
    expect(deps.host.sweepUnclaimed).not.toHaveBeenCalled();
    expect(deps.ledger.openSessions).not.toHaveBeenCalled();
  });

  // It still beats. The alert of §6 watches the job, not the document, but a
  // pass that wrote nothing would leave "since when?" unanswerable — and a
  // `lastSweptAt` left untouched is what makes the next sweep come due.
  it('still beats, and does not pretend it looked', async () => {
    const deps = quietDeps({ sweptAt: new Date(NOW.getTime() - 5 * 60_000) });
    await runWatchdog(deps);
    expect(deps.health.beat).toHaveBeenCalledWith(NOW, ['volume v1'], null);
  });

  it('sweeps again once the quiet interval has passed', async () => {
    const deps = quietDeps({ sweptAt: new Date(NOW.getTime() - 31 * 60_000) });
    await runWatchdog(deps);
    expect(deps.host.sweepUnclaimed).toHaveBeenCalled();
    expect(deps.health.beat).toHaveBeenCalledWith(NOW, [], NOW);
  });
});
