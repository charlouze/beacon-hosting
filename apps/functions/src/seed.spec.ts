import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@beacon/session';
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
  await db.doc('config/settings').delete();
});

describe('seed', () => {
  // §5: a world's `server/current` is born of an adoption, never of the seed.
  it('seeds settings and nothing else', async () => {
    await seed();
    expect((await db.doc('config/settings').get()).exists).toBe(true);
    expect((await db.doc('server/current').get()).exists).toBe(false);
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

  // Two writings of the same rates: a seeded system and one that falls back on
  // the domain must quote the same price.
  it('seeds the size and the rates the domain falls back on', async () => {
    await seed();

    const settings = (await db.doc('config/settings').get()).data();
    expect(settings?.['defaultInstanceSize']).toBe(DEFAULT_SETTINGS.defaultInstanceSize);
    expect(settings?.['tariffPerHour']).toEqual(DEFAULT_SETTINGS.tariffPerHour);
  });

  // The recovery path (§10): re-running after an incident must be safe.
  it('leaves an existing document untouched', async () => {
    await db.doc('config/settings').set({ sessionDurationMs: 1 });

    await seed();

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
