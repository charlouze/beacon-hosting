import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { World } from '@beacon/session';
import { adminWorldRecord, systemEvents, worldStateStores } from './world-state.js';

process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';
const NOW = new Date('2026-09-15T20:00:00Z');

let app: ReturnType<typeof initializeApp>;
let db: Firestore;

const aWorld = (worldId: string) =>
  World.from({ worldId, game: 'enshrouded', name: 'Les copains', inviteCode: 'c0de', players: [] });
const WORLD = aWorld('les-copains');

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-beacon' }, 'world-state-spec');
  db = getFirestore(app);
});
afterAll(() => deleteApp(app));
beforeEach(async () => {
  await db.recursiveDelete(db.collection('worlds'));
  await db.recursiveDelete(db.collection('events'));
});

describe('adminWorldRecord', () => {
  it('creates a world and its idle server document together, once', async () => {
    const worlds = adminWorldRecord(db);
    await worlds.create(WORLD, NOW);
    expect((await db.doc('worlds/les-copains/server/current').get()).get('state')).toBe('IDLE');
    expect((await worlds.read('les-copains'))?.name).toBe('Les copains');
    await expect(worlds.create(WORLD, NOW)).rejects.toThrow();
  });

  it('reads the players from the subcollection', async () => {
    await adminWorldRecord(db).create(WORLD, NOW);
    await db.doc('worlds/les-copains/players/u7').set({ uid: 'u7', joinedAt: NOW, code: 'c0de' });
    expect((await adminWorldRecord(db).read('les-copains'))?.hasPlayer('u7')).toBe(true);
  });

  it('reads an absent world as null', async () => {
    expect(await adminWorldRecord(db).read('nobody')).toBeNull();
  });
});

describe('worldStateStores', () => {
  it('finds every world that has a server document', async () => {
    await adminWorldRecord(db).create(WORLD, NOW);
    await adminWorldRecord(db).create(aWorld('les-autres'), NOW);
    expect([...(await worldStateStores(db).all())].sort()).toEqual(['les-autres', 'les-copains']);
  });

  it('stamps the world on every event it files', async () => {
    await adminWorldRecord(db).create(WORLD, NOW);
    await worldStateStores(db).for('les-copains').apply(
      { state: null, lastError: null, clearFacts: false, deadline: null, closeIntents: [],
        events: [{ type: 'DeadlineClamped', sessionId: 's1', detail: 'x' }] },
      NOW,
    );
    const events = await db.collection('events').get();
    expect(events.docs[0].get('worldId')).toBe('les-copains');
  });
});

describe('systemEvents', () => {
  it('files with no world at all', async () => {
    await systemEvents(db).file([{ type: 'ResourceStranded', sessionId: null, detail: 'vol-1' }], NOW);
    const events = await db.collection('events').get();
    expect(events.docs[0].get('worldId')).toBeNull();
    expect(events.docs[0].get('actor')).toEqual({ uid: 'system', name: 'system' });
  });
});
