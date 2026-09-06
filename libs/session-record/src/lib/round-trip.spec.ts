import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';
import { deleteApp, initializeApp as initializeClientApp, type FirebaseApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  getFirestore as getClientFirestore,
  setLogLevel,
} from 'firebase/firestore';
import type { Session } from '@beacon/session';
import { clientSessionRecord, type ClientSessionRecord } from './client-session.js';
import { serverStateStore } from './server-state.js';
import { EVENTS, SERVER_DOC, sessionFrom } from './fields.js';

// `clientSessionRecord` keeps its settings listener open for the record's
// whole lifetime by design (a browser tab owns it until it closes). Deleting
// a test's client app while that listener is still attached makes the sdk
// log an "Uncaught Error in snapshot listener: ... Firestore shutting down"
// for every test — a teardown artefact of this suite, not a defect to chase
// by giving `ClientSessionRecord` an unsubscribe it has no production need
// for. Silencing the sdk's own logger, here only, keeps the output pristine.
setLogLevel('silent');

const ACTOR = { uid: 'u1', name: 'Alice' };
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-beacon',
    firestore: {
      rules: readFileSync(new URL('../../../../firestore.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  if (getApps().length === 0) initializeApp({ projectId: 'demo-beacon' });
  await getFirestore().doc(SERVER_DOC).set({ state: 'IDLE', sessionId: null });
});

// Every client app opened by `clientRecord` in the running test, closed here
// so a leaked Firestore client cannot spill into the next test's timers.
const clientApps: FirebaseApp[] = [];

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(clientApps.splice(0).map((app) => deleteApp(app)));
});

/**
 * The client face, on a connection where the "owner" mock token bypasses the
 * rules — the same bypass `env.withSecurityRulesDisabled` uses internally.
 *
 * `withSecurityRulesDisabled` itself cannot serve this suite: its context is
 * torn down — `app.delete()` — the instant its callback returns (the library
 * "eagerly clean[s] up this context to actively prevent misuse outside of the
 * callback, e.g. storing the context in a variable", by its own comment), so
 * a `record` built inside the callback and used after it, as every test here
 * does, fails every call with "the client has already been terminated". A
 * connection this suite owns for the whole test, opened with the same
 * documented `mockUserToken: 'owner'` bypass, sidesteps that lifecycle
 * entirely without touching the rules under test.
 */
function clientRecord(): ClientSessionRecord {
  const app = initializeClientApp({ projectId: 'demo-beacon' }, `client-${clientApps.length}`);
  clientApps.push(app);
  const db = getClientFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080, { mockUserToken: 'owner' });
  return clientSessionRecord(db);
}

/**
 * §9: the round trip, once per transport. Each face writes and **the other**
 * reads it back — a suite that only checked each face against itself would
 * pass with two mappings that disagree, which is the one failure this file
 * exists to catch.
 *
 * The rules are bypassed on the client side because what is under test is the
 * mapping, not the authorisation: the refusals have their own suite, and they
 * are tranche 4's.
 */
describe('the two faces agree on the document', () => {
  it('reads back, admin side, what the browser wrote', async () => {
    const record = await clientRecord();
    await record.open({ sessionId: 's1', game: 'enshrouded', actor: ACTOR });

    const session = sessionFrom((await getFirestore().doc(SERVER_DOC).get()).data() ?? {});
    expect(session?.state).toBe('PROVISIONING');
    expect(session?.sessionId).toBe('s1');
    expect(session?.game).toBe('enshrouded');
    expect(session?.startedBy).toBe('u1');
    // None: the field is an admin's (§5), and the driver is not one. The
    // function applies the deployed default and publishes what it provisioned.
    expect(session?.instanceSize).toBeNull();
    expect(session?.deadline.at.getTime()).toBeGreaterThan(Date.now());
    // An opening writes no join point (§4): the machine does not exist yet.
    expect(session?.hasJoinInfo).toBe(false);
  });

  it('reads back, browser side, what the function wrote', async () => {
    await runningSince('2026-09-06T22:00:00Z');
    await serverStateStore(getFirestore()).publish(
      {
        ip: '51.15.42.7',
        joinInfo: { game: 'enshrouded', hostname: 'h', address: '51.15.42.7', port: 15637 },
        instanceSize: 'DEV1-L',
        references: { instanceId: 'srv-1', ipId: 'ip-1' },
      },
      new Date('2026-09-06T22:00:00Z'),
    );

    const seen = await firstSnapshot(await clientRecord());
    expect(seen?.state).toBe('RUNNING');
    expect(seen?.sessionId).toBe('s1');
    expect(seen?.instanceSize).toBe('DEV1-L');
    // The join point exists; what it contains is a reserved field the domain
    // transports and never reads (§4) — only whether it is there at all.
    expect(seen?.hasJoinInfo).toBe(true);
  });
});

/**
 * The first value the subscription yields. `onSnapshot` never fires
 * synchronously, so `unsubscribe` is assigned before the promise can settle.
 */
function firstSnapshot(record: ClientSessionRecord): Promise<Session | null> {
  let unsubscribe = (): void => undefined;
  const first = new Promise<Session | null>((resolve) => {
    unsubscribe = record.watch(resolve);
  });
  return first.finally(() => unsubscribe());
}

describe('the client face', () => {
  // §6 étape 1: read the state and write in the same transaction. The second
  // click replays its read, sees PROVISIONING and gives up — no lock, no
  // flag, just the transaction.
  it('lets one of two simultaneous openings through, and one only', async () => {
    const record = await clientRecord();
    const results = await Promise.allSettled([
      record.open({ sessionId: 's1', game: 'enshrouded', actor: ACTOR }),
      record.open({ sessionId: 's2', game: 'enshrouded', actor: ACTOR }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await sessionIdOf()).toMatch(/^s[12]$/);
  });

  it('refuses to open on a document that is not idle', async () => {
    const record = await clientRecord();
    await record.open({ sessionId: 's1', game: 'enshrouded', actor: ACTOR });
    await expect(
      record.open({ sessionId: 's2', game: 'enshrouded', actor: ACTOR }),
    ).rejects.toThrow(/PROVISIONING/);
  });

  it('writes the opening and its audit line in the same transaction', async () => {
    const record = await clientRecord();
    await record.open({ sessionId: 's1', game: 'enshrouded', actor: ACTOR });
    const events = await getFirestore().collection(EVENTS).get();
    expect(events.docs.map((d) => d.get('type'))).toEqual(['SessionStarted']);
    expect(events.docs[0].get('actor')).toEqual(ACTOR);
  });

  // Two people extending in the same second write the same value: the session
  // gains one hour, not two. A batched write and not a transaction, on
  // purpose (§6).
  it('extends inside the window, twice, to the same value', async () => {
    const record = await clientRecord();
    await runningSince('2026-09-06T23:45:00Z');
    await Promise.all([record.extend(ACTOR), record.extend(ACTOR)]);
    expect(await deadlineOf()).toEqual(new Date('2026-09-07T01:00:00Z'));
  });

  it('refuses to extend outside the window, without writing anything', async () => {
    const record = await clientRecord();
    await runningSince('2026-09-06T21:00:00Z');
    await expect(record.extend(ACTOR)).rejects.toThrow(/extension window/);
    expect(await eventCount()).toBe(0);
    expect(await deadlineOf()).toEqual(new Date('2026-09-07T00:00:00Z'));
  });

  it('records who asked for the stop', async () => {
    const record = await clientRecord();
    await runningSince('2026-09-06T23:45:00Z');
    await record.requestStop(ACTOR);
    const events = await getFirestore().collection(EVENTS).get();
    expect(events.docs[0].get('type')).toBe('SessionStopRequested');
    expect(events.docs[0].get('actor')).toEqual(ACTOR);
  });
});

const sessionIdOf = async () =>
  (await getFirestore().doc(SERVER_DOC).get()).get('sessionId') as string;

const deadlineOf = async () =>
  ((await getFirestore().doc(SERVER_DOC).get()).get('deadline') as Timestamp).toDate();

const eventCount = async () => (await getFirestore().collection(EVENTS).get()).size;

/** A RUNNING session whose deadline is one session duration after `now`. */
async function runningSince(nowIso: string): Promise<void> {
  const now = new Date(nowIso);
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(now);
  await getFirestore().doc(SERVER_DOC).set({
    state: 'RUNNING',
    sessionId: 's1',
    game: 'enshrouded',
    startedBy: 'u1',
    startedAt: now,
    deadline: new Date('2026-09-07T00:00:00Z'),
    instanceSize: 'DEV1-L',
    joinInfo: { game: 'enshrouded', hostname: 'h', address: '1.2.3.4', port: 15637 },
  });
}
