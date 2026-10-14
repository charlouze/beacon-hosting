import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { gameVersionFrom, type GameVersion } from '@beacon/session';
import { gameCopyRecord, type GameCopyRecord } from './game-copy-record.js';
import { gameCopyDocPath } from './fields.js';

process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';

const SUNKENLAND = gameCopyDocPath('sunkenland');

let app: ReturnType<typeof initializeApp>;
let db: Firestore;
let record: GameCopyRecord;

const version = (digits: string): GameVersion => {
  const built = gameVersionFrom(digits);
  if (built === null) throw new Error(`not a version: ${digits}`);
  return built;
};

const stored = async () => (await db.doc(SUNKENLAND).get()).data();

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-beacon' }, 'game-copy-record-spec');
  db = getFirestore(app);
  record = gameCopyRecord(db);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await db.doc(SUNKENLAND).delete();
});

describe('the document of a copy', () => {
  it('is one document per game, under gameCopies', () => {
    expect(gameCopyDocPath('sunkenland')).toBe('gameCopies/sunkenland');
  });
});

describe('reach', () => {
  it('answers without writing anything', async () => {
    await record.reach('sunkenland');

    expect(await stored()).toBeUndefined();
  });
});

describe('recordDeposit', () => {
  it('records the deposited version, at the time of the Firestore server', async () => {
    const before = Date.now();
    await record.recordDeposit('sunkenland', version('25746735'));

    const data = await stored();
    expect(data?.['depositedVersion']).toBe('25746735');
    expect(data?.['depositedAt']).toBeInstanceOf(Timestamp);
    expect((data?.['depositedAt'] as Timestamp).toMillis()).toBeGreaterThanOrEqual(before - 5_000);
  });

  it('replaces the version of an earlier deposit', async () => {
    await record.recordDeposit('sunkenland', version('23178631'));
    await record.recordDeposit('sunkenland', version('25746735'));

    expect((await stored())?.['depositedVersion']).toBe('25746735');
  });

  it('leaves every field it does not own as it found it', async () => {
    const readAt = Timestamp.fromMillis(1_791_303_546_000);
    await db.doc(SUNKENLAND).set({ publishedVersion: '25746735', readAt });

    await record.recordDeposit('sunkenland', version('23178631'));

    expect(await stored()).toMatchObject({ publishedVersion: '25746735', readAt, depositedVersion: '23178631' });
  });
});
