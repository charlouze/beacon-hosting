import { beforeEach, describe, expect, it } from 'vitest';
import { getFirestore } from 'firebase-admin/firestore';
import { Save } from '@beacon/session';
import { defaultApp } from './firebase-app.js';
import { saveRecords, SAVES } from './save-records.js';

const db = getFirestore(defaultApp());
const records = saveRecords(db);

const SAVE = Save.of({
  createdAt: new Date('2026-09-07T20:04:26Z'),
  game: 'enshrouded',
  objectKey: 'saves/enshrouded/pre-shutdown/s1/2026-09-07T20-04-26Z.tar.gz',
  sizeBytes: 50_000,
  origin: 'pre-shutdown',
});

beforeEach(async () => {
  const existing = await db.collection(SAVES).get();
  await Promise.all(existing.docs.map((doc) => doc.ref.delete()));
});

describe('saveRecords', () => {
  // §5, field for field. It is metadata and nothing else: the bytes live in the
  // bucket, and this collection is what a human reads to choose one by hand.
  it('writes the five fields the spec names', async () => {
    await records.record(SAVE);
    const [doc] = (await db.collection(SAVES).get()).docs;
    const data = doc.data();
    expect(data['game']).toBe('enshrouded');
    expect(data['objectKey']).toBe(SAVE.objectKey);
    expect(data['sizeBytes']).toBe(50_000);
    expect(data['origin']).toBe('pre-shutdown');
    expect(data['createdAt'].toDate()).toEqual(new Date('2026-09-07T20:04:26Z'));
  });

  // One document per object, because there is one object per save (§5). A key
  // recorded twice would make the same archive look like two.
  it('records the same key once, however often it is reported', async () => {
    await records.record(SAVE);
    await records.record(SAVE);
    expect((await db.collection(SAVES).get()).size).toBe(1);
  });
});
