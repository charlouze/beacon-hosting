import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { completedSetupStore, type CompletedSetupStore } from './completed-setups-record.js';
import { completedSetupsDocPath } from './fields.js';

process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';

const ENSHROUDED = completedSetupsDocPath('enshrouded');
const SUNKENLAND = completedSetupsDocPath('sunkenland');

let app: ReturnType<typeof initializeApp>;
let db: Firestore;
let store: CompletedSetupStore;

const kept = async (path: string) => (await db.doc(path).get()).data();

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-beacon' }, 'completed-setups-record-spec');
  db = getFirestore(app);
  store = completedSetupStore(db);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await db.doc(ENSHROUDED).delete();
  await db.doc(SUNKENLAND).delete();
});

describe('keep', () => {
  it('keeps the first completed setup of a game', async () => {
    await store.keep('enshrouded', { sessionId: 's1', durationMs: 300_000 });

    expect(await kept(ENSHROUDED)).toEqual({ setups: [{ sessionId: 's1', durationMs: 300_000 }] });
  });

  it('keeps the next one after it', async () => {
    await store.keep('enshrouded', { sessionId: 's1', durationMs: 300_000 });
    await store.keep('enshrouded', { sessionId: 's2', durationMs: 480_000 });

    expect(await kept(ENSHROUDED)).toEqual({
      setups: [
        { sessionId: 's1', durationMs: 300_000 },
        { sessionId: 's2', durationMs: 480_000 },
      ],
    });
  });

  it('keeps each game apart', async () => {
    await store.keep('enshrouded', { sessionId: 's1', durationMs: 300_000 });
    await store.keep('sunkenland', { sessionId: 's2', durationMs: 480_000 });

    expect(await kept(ENSHROUDED)).toEqual({ setups: [{ sessionId: 's1', durationMs: 300_000 }] });
    expect(await kept(SUNKENLAND)).toEqual({ setups: [{ sessionId: 's2', durationMs: 480_000 }] });
  });

  it('keeps a session once, whatever its second report says it took', async () => {
    await store.keep('enshrouded', { sessionId: 's1', durationMs: 300_000 });
    await store.keep('enshrouded', { sessionId: 's1', durationMs: 360_000 });

    expect(await kept(ENSHROUDED)).toEqual({ setups: [{ sessionId: 's1', durationMs: 300_000 }] });
  });

  it('keeps a session once when its two reports race', async () => {
    await Promise.all([
      store.keep('enshrouded', { sessionId: 's1', durationMs: 300_000 }),
      store.keep('enshrouded', { sessionId: 's1', durationMs: 300_000 }),
    ]);

    expect(await kept(ENSHROUDED)).toEqual({ setups: [{ sessionId: 's1', durationMs: 300_000 }] });
  });

  it('keeps the last five, and lets the oldest go', async () => {
    for (const index of [1, 2, 3, 4, 5, 6]) {
      await store.keep('enshrouded', { sessionId: `s${index}`, durationMs: index * 60_000 });
    }

    const data = await kept(ENSHROUDED);
    expect(data?.['setups'].map((setup: { sessionId: string }) => setup.sessionId)).toEqual([
      's2',
      's3',
      's4',
      's5',
      's6',
    ]);
  });

  it('rewrites a document it cannot read, and keeps what it could', async () => {
    await db.doc(ENSHROUDED).set({
      setups: [{ sessionId: 's0', durationMs: 240_000 }, { sessionId: 'broken' }, 'noise'],
      stray: 'left over',
    });

    await store.keep('enshrouded', { sessionId: 's1', durationMs: 300_000 });

    expect(await kept(ENSHROUDED)).toEqual({
      setups: [
        { sessionId: 's0', durationMs: 240_000 },
        { sessionId: 's1', durationMs: 300_000 },
      ],
    });
  });
});
