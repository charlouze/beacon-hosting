import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { stamp } from './stamp.js';

process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';

let app: ReturnType<typeof initializeApp>;
let db: Firestore;

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-beacon' }, 'stamp-spec');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await db.doc('config/settings').delete();
});

describe('stamp', () => {
  // Targeted: the seed never touches an existing document, so it could not
  // carry this. And a whole-document write here would erase the settings an
  // admin edited between two merges.
  it('stamps the version without touching the rest of the settings', async () => {
    await db.doc('config/settings').set({ sessionDurationMs: 7_200_000, rulesVersion: null });

    await stamp('9c1f2e3');

    expect((await db.doc('config/settings').get()).data()).toEqual({
      sessionDurationMs: 7_200_000,
      rulesVersion: '9c1f2e3',
    });
  });

  // A stamp with nothing to stamp would not fail the deployment, it would make
  // every open tab reload forever against a version that matches nothing.
  it('refuses a blank reference', async () => {
    await db.doc('config/settings').set({ rulesVersion: null });

    await expect(stamp('')).rejects.toThrow(/commit reference/);
  });
});
