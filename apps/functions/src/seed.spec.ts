import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { seed } from './seed.js';

process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';

let app: ReturnType<typeof initializeApp>;
let db: Firestore;

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-beacon' }, 'seed-spec');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await db.doc('server/current').delete();
  await db.doc('config/settings').delete();
});

describe('seed', () => {
  // Each document is checked on its own: a crash between the two creates must
  // not make a re-run skip the second.
  it('seeds the two documents on an empty database', async () => {
    await seed();

    for (const path of ['server/current', 'config/settings']) {
      expect((await db.doc(path).get()).exists).toBe(true);
    }
  });

  // Every field of §5, present and null. A field that is absent rather than
  // null does not read the same way in a rules diff, and `firestore.rules` is
  // written against this very document.
  it('seeds server/current as IDLE, with every field of the model', async () => {
    await seed();

    const stored = (await db.doc('server/current').get()).data();
    expect(stored?.['state']).toBe('IDLE');
    expect(Object.keys(stored ?? {}).sort()).toEqual([
      'deadline',
      'game',
      'instanceId',
      'ip',
      'ipId',
      'joinInfo',
      'lastError',
      'provisionClaimedAt',
      'sessionId',
      'startedAt',
      'startedBy',
      'state',
      'stateSince',
    ]);
  });

  // Null and not absent, for the same reason: the stamp of §10 writes this
  // field on every merge, and `libs/session-record` reads its absence as "no
  // deployment has stamped it yet" rather than as a drift.
  it('seeds config/settings with both reserved fields unstamped', async () => {
    await seed();

    const settings = (await db.doc('config/settings').get()).data();
    expect(settings?.['rulesVersion']).toBeNull();
    expect(settings?.['agentEndpoint']).toBeNull();
  });

  // The recovery path (§10): re-running after an incident must be safe.
  it('leaves existing documents untouched', async () => {
    await db.doc('server/current').set({ state: 'RUNNING' });
    await db.doc('config/settings').set({ sessionDurationMs: 1 });

    await seed();

    expect((await db.doc('server/current').get()).data()).toEqual({ state: 'RUNNING' });
    expect((await db.doc('config/settings').get()).data()).toEqual({ sessionDurationMs: 1 });
  });

  // The deployment has no first admin to name: a Google uid only exists after
  // someone has signed in against the project, which no merge can do. §5 makes
  // that document a console gesture, and this is the sentinel that the seed
  // never quietly takes it back.
  it('creates nothing in members', async () => {
    // Read before and after rather than asserting an empty collection: the
    // suites of this project share one emulator, and what another file left
    // behind must not decide this one.
    const uidsBefore = (await db.collection('members').get()).docs.map((doc) => doc.id);

    await seed();

    expect((await db.collection('members').get()).docs.map((doc) => doc.id)).toEqual(uidsBefore);
  });
});
