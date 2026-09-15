import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Save } from '@beacon/session';
import { saveRecords, SAVES } from './save-records.js';

process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';

let app: ReturnType<typeof initializeApp>;
let db: Firestore;

const SAVE = Save.of({
  createdAt: new Date('2026-09-07T20:04:26Z'),
  worldId: 'les-copains',
  objectKey: 'saves/les-copains/pre-shutdown/s1/2026-09-07T20-04-26Z.tar.gz',
  sizeBytes: 50_000,
  origin: 'pre-shutdown',
});

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-beacon' }, 'save-records-spec');
  db = getFirestore(app);
});

afterAll(() => deleteApp(app));

beforeEach(async () => {
  const existing = await db.collection(SAVES).get();
  await Promise.all(existing.docs.map((doc) => doc.ref.delete()));
});

describe('saveRecords', () => {
  // §5, field for field. It is metadata and nothing else: the bytes live in the
  // bucket, and this collection is what a human reads to choose one by hand.
  it('writes the five fields the spec names', async () => {
    await saveRecords(db).record(SAVE);
    const [doc] = (await db.collection(SAVES).get()).docs;
    const data = doc.data();
    expect(data['worldId']).toBe('les-copains');
    expect(data['objectKey']).toBe(SAVE.objectKey);
    expect(data['sizeBytes']).toBe(50_000);
    expect(data['origin']).toBe('pre-shutdown');
    expect(data['createdAt'].toDate()).toEqual(new Date('2026-09-07T20:04:26Z'));
  });

  // One document per object, because there is one object per save (§5). A key
  // recorded twice would make the same archive look like two.
  it('records the same key once, however often it is reported', async () => {
    const records = saveRecords(db);
    await records.record(SAVE);
    await records.record(SAVE);
    expect((await db.collection(SAVES).get()).size).toBe(1);
  });
});
