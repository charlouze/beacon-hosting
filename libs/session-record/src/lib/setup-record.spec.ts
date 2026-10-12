import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { serverDocPath, setupDocPath, toDate } from './fields.js';
import { setupStores, type SetupStore } from './setup-record.js';

process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';

const OPENED = new Date('2026-10-12T20:00:00Z');
const AT = new Date('2026-10-12T20:02:00Z');
const ORDER = ['waking', 'restoring-world', 'fetching-game', 'starting-game'] as const;

const SERVER_DOC = serverDocPath('w1');
const SETUP_DOC = setupDocPath('w1');

let app: ReturnType<typeof initializeApp>;
let db: Firestore;
let store: SetupStore;

const preparing = (sessionId: string) =>
  db.doc(SERVER_DOC).set({ state: 'PROVISIONING', sessionId });

const setup = async () => (await db.doc(SETUP_DOC).get()).data();

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-beacon' }, 'setup-record-spec');
  db = getFirestore(app);
  store = setupStores(db).for('w1');
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await db.doc(SERVER_DOC).delete();
  await db.doc(SETUP_DOC).delete();
});

describe('setupDocPath', () => {
  it('sits beside the session context of its world', () => {
    expect(setupDocPath('w1')).toBe('worlds/w1/server/setup');
  });
});

describe('begin', () => {
  it('writes the session, the order of its game and the first step since the opening', async () => {
    await store.begin('s1', ORDER, OPENED);

    const data = await setup();
    expect(data).toEqual({
      sessionId: 's1',
      stepOrder: [...ORDER],
      step: 'waking',
      stepSince: expect.anything(),
      activity: null,
      progress: null,
    });
    expect(toDate(data?.['stepSince'])).toEqual(OPENED);
  });

  // Nothing ever deletes this document: the setup of the next session is what
  // erases the previous one, whole.
  it('rewrites everything the previous setup left', async () => {
    await db.doc(SETUP_DOC).set({
      sessionId: 's0',
      stepOrder: ['waking', 'fetching-game', 'restoring-world', 'starting-game'],
      step: 'fetching-game',
      stepSince: new Date('2026-10-11T20:00:00Z'),
      activity: 'downloading',
      progress: 80,
      stray: 'left over',
    });

    await store.begin('s1', ORDER, OPENED);

    const data = await setup();
    expect(data?.['sessionId']).toBe('s1');
    expect(data?.['step']).toBe('waking');
    expect(data?.['activity']).toBeNull();
    expect(data?.['progress']).toBeNull();
    expect(data).not.toHaveProperty('stray');
  });
});

describe('advance', () => {
  it('replaces the step, from the instant it was declared, and answers what changed', async () => {
    await preparing('s1');
    await store.begin('s1', ORDER, OPENED);

    const advance = await store.advance(
      's1',
      { step: 'fetching-game', activity: 'downloading', progress: 3 },
      AT,
    );

    expect(advance).toEqual({
      kept: { step: 'fetching-game', since: AT, activity: 'downloading', progress: 3 },
      changed: 'step',
      left: { step: 'waking', since: OPENED },
    });
    const data = await setup();
    expect(data?.['step']).toBe('fetching-game');
    expect(toDate(data?.['stepSince'])).toEqual(AT);
    expect(data?.['activity']).toBe('downloading');
    expect(data?.['progress']).toBe(3);
    expect(data?.['stepOrder']).toEqual([...ORDER]);
  });

  it('keeps the instant the step began when only its progress moves', async () => {
    await preparing('s1');
    await store.begin('s1', ORDER, OPENED);
    await store.advance('s1', { step: 'fetching-game', progress: 3 }, AT);

    const advance = await store.advance(
      's1',
      { step: 'fetching-game', progress: 4 },
      new Date('2026-10-12T20:02:10Z'),
    );

    expect(advance?.changed).toBe('progress');
    const data = await setup();
    expect(toDate(data?.['stepSince'])).toEqual(AT);
    expect(data?.['progress']).toBe(4);
  });

  it('answers that nothing changed when the same declaration comes twice', async () => {
    await preparing('s1');
    await store.begin('s1', ORDER, OPENED);

    const advance = await store.advance('s1', { step: 'waking' }, AT);

    expect(advance?.changed).toBeNull();
    expect(toDate((await setup())?.['stepSince'])).toEqual(OPENED);
  });

  it('writes nothing when the kept setup belongs to another session', async () => {
    await preparing('s1');
    await store.begin('s0', ORDER, OPENED);

    const advance = await store.advance('s1', { step: 'fetching-game' }, AT);

    expect(advance).toBeNull();
    expect((await setup())?.['step']).toBe('waking');
  });

  it('writes nothing when the world moved on to another session', async () => {
    await preparing('s2');
    await store.begin('s1', ORDER, OPENED);

    const advance = await store.advance('s1', { step: 'fetching-game' }, AT);

    expect(advance).toBeNull();
    expect((await setup())?.['step']).toBe('waking');
  });

  it('writes nothing once the session is no longer preparing', async () => {
    await db.doc(SERVER_DOC).set({ state: 'RUNNING', sessionId: 's1' });
    await store.begin('s1', ORDER, OPENED);

    const advance = await store.advance('s1', { step: 'starting-game' }, AT);

    expect(advance).toBeNull();
    expect((await setup())?.['step']).toBe('waking');
  });

  it('writes nothing, and creates nothing, when no setup was begun', async () => {
    await preparing('s1');

    const advance = await store.advance('s1', { step: 'fetching-game' }, AT);

    expect(advance).toBeNull();
    expect(await setup()).toBeUndefined();
  });

  it('writes nothing over a kept setup it cannot read', async () => {
    await preparing('s1');
    await db.doc(SETUP_DOC).set({ sessionId: 's1', step: 'booting', stepSince: OPENED });

    const advance = await store.advance('s1', { step: 'fetching-game' }, AT);

    expect(advance).toBeNull();
    expect((await setup())?.['step']).toBe('booting');
  });
});
