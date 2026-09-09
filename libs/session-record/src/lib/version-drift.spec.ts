import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { getFirestore } from 'firebase-admin/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';
import { deleteApp, initializeApp as initializeClientApp, type FirebaseApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  getFirestore as getClientFirestore,
  setLogLevel,
} from 'firebase/firestore';
import { clientSessionRecord } from './client-session.js';
import { SETTINGS_DOC } from './fields.js';

// Same teardown artefact as `round-trip.spec.ts`: the record's settings
// listener lives as long as the record, and deleting a test's client app under
// it makes the sdk log a shutdown error per test.
setLogLevel('silent');

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
});

const clientApps: FirebaseApp[] = [];

afterEach(async () => {
  await Promise.all(clientApps.splice(0).map((app) => deleteApp(app)));
});

/** The deployment's face: it is the only writer of `rulesVersion` (§5). */
const admin = {
  writeSettings: (patch: Record<string, unknown>): Promise<unknown> =>
    getFirestore().doc(SETTINGS_DOC).set(patch, { merge: true }),
};

/**
 * The browser's face, on the same `mockUserToken: 'owner'` bypass the round
 * trip uses: what is under test is the drift, not the authorisation.
 *
 * `drifts` is returned as a function and not as a number, because it keeps
 * moving after the call and a captured number would not.
 *
 * `nextSnapshot` is the anchor every test here waits on. It resolves from the
 * record's own settings subscription — deliberately that one, and not a second
 * `onSnapshot` this file could open on the same document: a private
 * subscription would prove the emulator is alive and prove nothing about the
 * listener under test, which is exactly the failure that must not degrade into
 * a green. The replay of the cached value that `watchSettings` performs on
 * subscription finds no one waiting, so what it resolves on is snapshots and
 * not the replay.
 *
 * One snapshot callback notifies the settings listeners and then the drift
 * listener, both synchronously; resolving here is a microtask, so an awaiting
 * test resumes only once the drift listener has had its turn on that same
 * snapshot.
 */
function watchDrift(compiled: string): {
  drifts: () => number;
  nextSnapshot: () => Promise<void>;
} {
  const app = initializeClientApp({ projectId: 'demo-beacon' }, `drift-${clientApps.length}`);
  clientApps.push(app);
  const db = getClientFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080, { mockUserToken: 'owner' });
  const record = clientSessionRecord(db);

  let drifts = 0;
  record.watchVersionDrift(compiled, () => {
    drifts += 1;
  });

  const waiting: (() => void)[] = [];
  record.watchSettings(() => {
    for (const resolve of waiting.splice(0)) resolve();
  });

  return {
    drifts: () => drifts,
    nextSnapshot: () => new Promise<void>((resolve) => waiting.push(resolve)),
  };
}

/**
 * The grace after the anchor, for the tests that assert a reload did **not**
 * happen: the anchor proves the drift listener was handed the snapshot, this
 * covers what could still follow it. Nothing resolves when a listener decides
 * to do nothing, and that part can only be waited out.
 */
const sleepUntilSettled = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 300));

describe('the tab from yesterday', () => {
  // A freshly seeded database has never been stamped. Reloading on that would
  // be an infinite loop on first boot.
  it('does not reload while the deployment has stamped nothing', async () => {
    await admin.writeSettings({ rulesVersion: null });
    const { drifts, nextSnapshot } = watchDrift('abc123');

    await nextSnapshot();
    await sleepUntilSettled();
    expect(drifts()).toBe(0);
  });

  it('does not reload while the deployed version is the compiled one', async () => {
    await admin.writeSettings({ rulesVersion: 'abc123' });
    const { drifts, nextSnapshot } = watchDrift('abc123');

    await nextSnapshot();
    await sleepUntilSettled();
    expect(drifts()).toBe(0);
  });

  // The whole point: the tab from yesterday learns that today happened.
  it('reloads once the deployed version differs', async () => {
    await admin.writeSettings({ rulesVersion: 'abc123' });
    const { drifts, nextSnapshot } = watchDrift('abc123');
    await nextSnapshot();

    const drifted = nextSnapshot();
    await admin.writeSettings({ rulesVersion: 'def456' });
    await drifted;

    expect(drifts()).toBe(1);
  });

  // Firestore delivers a snapshot per write, and a reload per snapshot would
  // fight the reload itself.
  it('reloads once however many snapshots follow', async () => {
    await admin.writeSettings({ rulesVersion: 'abc123' });
    const { drifts, nextSnapshot } = watchDrift('abc123');
    // The listener is caught up on the stamp it agrees with before either
    // write leaves, and again between them: two snapshots really do follow,
    // where a client still connecting would have been handed one and this test
    // would have proven nothing.
    await nextSnapshot();

    const drifted = nextSnapshot();
    await admin.writeSettings({ rulesVersion: 'def456' });
    await drifted;

    const following = nextSnapshot();
    await admin.writeSettings({ rulesVersion: 'ghi789' });
    await following;

    expect(drifts()).toBe(1);
  });
});
