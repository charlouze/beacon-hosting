import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { deleteApp as deleteAdminApp, initializeApp, type App } from 'firebase-admin/app';
import { deleteApp, initializeApp as initializeClientApp, type FirebaseApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  getFirestore as getClientFirestore,
  setLogLevel,
  terminate,
  type Firestore,
} from 'firebase/firestore';
import { DEFAULT_SETTINGS } from '@beacon/session';
import { clientSessionRecord, type ClientSessionRecord } from './client-session.js';
import { EVENTS, SERVER_DOC, SETTINGS_DOC } from './fields.js';

// Same teardown artefact as `round-trip.spec.ts`: the settings listener a
// record owns for its whole lifetime logs a shutdown error when the test's
// client app is deleted. A refused listener — the visitor's — logs a
// permission denial for the same reason, and neither is what is under test.
setLogLevel('silent');

process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';

/**
 * A database of this file's own, and it is the whole reason this file has no
 * purge to run.
 *
 * A subscription the rules refuse is completed by the emulator server-side,
 * the sdk reopens it, and the stream stays registered against the document
 * once completed. `clearData` walks every stream registered on the database it
 * clears and answers 500 on the first completed one it meets — in whichever
 * suite calls `clearFirestore()` next, which is every other suite of this
 * folder. Sweeping them beforehand only trades a certainty for a race: the
 * count is not bounded by the number of tests but by how long a refused record
 * lives and how often the sdk retries it.
 *
 * Under its own project id there is nothing to sweep. No other suite clears
 * this database, this suite never clears it either — see `reset()` — so a
 * completed stream is never walked at all.
 */
const PROJECT_ID = 'demo-beacon-authorised-writes';

const ALICE = 'alice';
const BOB = 'bob';
const MALLORY = 'mallory';
const ACTOR = { uid: ALICE, name: 'Alice' };

let env: RulesTestEnvironment;
let adminApp: App;

beforeAll(async () => {
  // Named, like `server-state.spec.ts`: the default admin app is the one the
  // suites sharing `demo-beacon` initialise, and this project is not theirs.
  adminApp = initializeApp({ projectId: PROJECT_ID }, 'authorised-writes-spec');
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(new URL('../../../../firestore.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

const clients: { app: FirebaseApp; db: Firestore }[] = [];

afterAll(async () => {
  // Closed here and never between two tests, for the reason `reset()` gives.
  for (const { app, db } of clients.splice(0)) {
    await terminate(db);
    await deleteApp(app);
  }
  await deleteAdminApp(adminApp);
  await env?.cleanup();
});

const admin = () => getFirestore(adminApp);

/**
 * The seeded base, restored document by document — **not** `clearFirestore()`.
 *
 * A record keeps a listener on `config/settings` for its whole lifetime, and
 * here that listener is evaluated against the rules rather than bypassed by the
 * `'owner'` token every other suite of this folder uses. The emulator's
 * `clearData` walks its listen streams to notify them, throws
 * `IllegalStateException: Stream is already completed` on the one the refused
 * record left, and answers 500. Terminating the client first does not help: a
 * completed stream is exactly what it trips over.
 *
 * So the documents are put back instead, and the client apps stay open until
 * the file is done. `set()` replaces whole, `events` is the only collection a
 * test adds to, and nothing else in the base has a writer here.
 */
async function reset(): Promise<void> {
  await admin().recursiveDelete(admin().collection(EVENTS));
  // Through the Admin SDK, which is above the rules — the same way §5 says
  // these documents come into existence: the deployment seeds them, and an
  // admin enrols from the console.
  await admin().doc(`members/${ALICE}`).set({ role: 'player', email: 'alice@example.com' });
  await admin().doc(`members/${BOB}`).set({ role: 'player', email: 'bob@example.com' });
  await admin()
    .doc(SETTINGS_DOC)
    .set({ ...DEFAULT_SETTINGS, rulesVersion: null });
  await admin().doc(SERVER_DOC).set(IDLE_SERVER);
}

beforeEach(reset);

afterEach(() => {
  vi.useRealTimers();
});

/**
 * The client face on an **authenticated** connection, rules enforced.
 *
 * `env.authenticatedContext(uid).firestore()` cannot serve here: the library
 * carries its own copy of the sdk, so what it hands back is not the `Firestore`
 * of `firebase/firestore` that `clientSessionRecord` takes — and its context is
 * torn down the moment a `withSecurityRulesDisabled` callback returns. An app
 * this suite owns, pointed at the emulator with a mock token that is a *user*
 * and not the documented `'owner'` bypass, is the same sdk the browser runs,
 * against the same rules the deployment ships.
 */
function recordAs(uid: string): ClientSessionRecord {
  const app = initializeClientApp({ projectId: PROJECT_ID }, `authorised-${clients.length}`);
  const db = getClientFirestore(app);
  clients.push({ app, db });
  connectFirestoreEmulator(db, '127.0.0.1', 8080, {
    mockUserToken: { sub: uid, user_id: uid },
  });
  return clientSessionRecord(db);
}

/**
 * §9, and the hole this file was written to close: `round-trip.spec.ts` and
 * `version-drift.spec.ts` exercise these three writes through the `'owner'`
 * token, which bypasses the rules, and `server-current.spec.ts` exercises the
 * rules against a payload retyped by hand. Neither says that what the record
 * actually sends — a `writeBatch`, a `set(..., { merge: true })`, and an
 * `events` entry travelling in the same lot — survives the deployed rules.
 *
 * `reserved-fields.spec.ts` pins the field *names* across the two languages.
 * This one pins the values, the shape of the batch, and the identity that
 * signs it.
 */
describe('what the browser really writes, through the rules that are really deployed', () => {
  it('opens a session, with its audit entry in the same lot', async () => {
    const record = recordAs(ALICE);

    await record.open({ sessionId: 's1', game: 'enshrouded', actor: ACTOR });

    const server = (await admin().doc(SERVER_DOC).get()).data() ?? {};
    expect(server['state']).toBe('PROVISIONING');
    expect(server['sessionId']).toBe('s1');
    expect(server['startedBy']).toBe(ALICE);
    const events = await admin().collection(EVENTS).get();
    expect(events.docs.map((entry) => entry.get('type'))).toEqual(['SessionStarted']);
    expect(events.docs[0].get('actor')).toEqual(ACTOR);
  });

  it('extends a running session by writing the deadline alone', async () => {
    await running('2026-09-06T23:45:00Z');
    const record = recordAs(ALICE);

    await record.extend(ACTOR);

    expect(await deadline()).toEqual(new Date('2026-09-07T01:00:00Z'));
    const events = await admin().collection(EVENTS).get();
    expect(events.docs.map((entry) => entry.get('type'))).toEqual(['SessionExtended']);
  });

  it('asks for a stop, and the state and its audit line leave together', async () => {
    await running('2026-09-06T23:45:00Z');
    const record = recordAs(ALICE);

    await record.requestStop(ACTOR);

    expect((await admin().doc(SERVER_DOC).get()).get('state')).toBe('STOPPING');
    const events = await admin().collection(EVENTS).get();
    expect(events.docs.map((entry) => entry.get('type'))).toEqual(['SessionStopRequested']);
  });

  // Without these two, the three above would pass just as well against a rules
  // file that allowed everything — which is the failure mode a suite of
  // successes is worst at noticing.
  it('refuses the very same opening to somebody who is not a member', async () => {
    const record = recordAs(MALLORY);

    await expect(
      record.open({
        sessionId: 's1',
        game: 'enshrouded',
        actor: { uid: MALLORY, name: 'Mallory' },
      }),
    ).rejects.toThrow();

    expect((await admin().doc(SERVER_DOC).get()).get('state')).toBe('IDLE');
    expect((await admin().collection(EVENTS).get()).size).toBe(0);
  });

  // §7: the resource is shared on purpose, but nobody opens a session in
  // somebody else's name. Refused on the write and not on the read, which is
  // the half a non-member's refusal cannot reach.
  it("refuses a member's opening signed with another member", async () => {
    const record = recordAs(ALICE);

    await expect(
      record.open({ sessionId: 's1', game: 'enshrouded', actor: { uid: BOB, name: 'Bob' } }),
    ).rejects.toThrow();

    expect((await admin().doc(SERVER_DOC).get()).get('state')).toBe('IDLE');
    expect((await admin().collection(EVENTS).get()).size).toBe(0);
  });
});

/** What §5 seeds, and what `harness.ts` gives the rules suites. */
const IDLE_SERVER = {
  state: 'IDLE',
  stateSince: null,
  sessionId: null,
  startedBy: null,
  startedAt: null,
  deadline: null,
  game: null,
  instanceId: null,
  ipId: null,
  ip: null,
  joinInfo: null,
  provisionClaimedAt: null,
  lastError: null,
};

/**
 * A RUNNING session closing at midnight, with `now` inside its extension
 * window. Written by the Admin SDK because RUNNING is a finding, and §5
 * reserves it to a function — which is precisely what the opening test above
 * proves the client cannot forge.
 */
async function running(nowIso: string): Promise<void> {
  const now = new Date(nowIso);
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(now);
  await admin()
    .doc(SERVER_DOC)
    .set({
      ...IDLE_SERVER,
      state: 'RUNNING',
      stateSince: Timestamp.fromDate(now),
      sessionId: 's1',
      game: 'enshrouded',
      startedBy: ALICE,
      startedAt: Timestamp.fromDate(now),
      deadline: Timestamp.fromDate(new Date('2026-09-07T00:00:00Z')),
    });
}

const deadline = async () =>
  ((await admin().doc(SERVER_DOC).get()).get('deadline') as Timestamp).toDate();
