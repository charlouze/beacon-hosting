import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getApps, initializeApp } from 'firebase-admin/app';
import { deleteApp, initializeApp as initializeClientApp, type FirebaseApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore as getClientFirestore,
  serverTimestamp,
  setDoc,
  setLogLevel,
} from 'firebase/firestore';
import { DEFAULT_SETTINGS, Session, World } from '@beacon/session';
import {
  idleServerDocument,
  openingFields,
  playerDocument,
  serverDocPath,
  sessionFrom,
  worldDocument,
  worldFrom,
} from './fields.js';

// Silences the sdk's own "Uncaught Error in snapshot listener" noise a
// terminated client app logs on teardown — a teardown artefact of this
// suite, not a defect worth chasing.
setLogLevel('silent');

const WORLD = World.from({
  worldId: 'les-copains',
  game: 'enshrouded',
  name: 'Les copains',
  inviteCode: 'c0de',
  players: ['u1'],
});
const now = new Date('2026-09-06T20:00:00Z');

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
  if (getApps().length === 0) initializeApp({ projectId: 'demo-beacon' });
});

afterAll(async () => {
  await env?.cleanup();
});

// Every client app opened by `clientDb` in the running test, closed here so a
// leaked Firestore client cannot spill into the next test.
const clientApps: FirebaseApp[] = [];

afterEach(async () => {
  await env.clearFirestore();
  await Promise.all(clientApps.splice(0).map((app) => deleteApp(app)));
});

/**
 * A raw client connection, on the same "owner" mock-token bypass
 * `env.withSecurityRulesDisabled` uses internally. What is under test here is
 * the mapping `fields.ts` holds between the two transports, not the
 * authorisation the rules decide — that is tranche 4's, and T9's for a world.
 */
function clientDb() {
  const app = initializeClientApp({ projectId: 'demo-beacon' }, `client-${clientApps.length}`);
  clientApps.push(app);
  const db = getClientFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080, { mockUserToken: 'owner' });
  return db;
}

/**
 * §9: the round trip, once per transport. Each face writes and **the other**
 * reads it back — a suite that only checked each face against itself would
 * pass with two mappings that disagree, which is the one failure this file
 * exists to catch.
 */
describe('the two faces agree on a world', () => {
  it('reads back, admin side, the world and the player the browser wrote', async () => {
    const client = clientDb();
    await setDoc(doc(client, `worlds/${WORLD.worldId}`), worldDocument(WORLD, now));
    await setDoc(
      doc(client, `worlds/${WORLD.worldId}/players/u2`),
      playerDocument('u2', WORLD.inviteCode, serverTimestamp()),
    );

    const worldData = (await getFirestore().doc(`worlds/${WORLD.worldId}`).get()).data() ?? {};
    const world = worldFrom(WORLD.worldId, worldData, ['u1', 'u2']);
    expect(world?.name).toBe('Les copains');
    expect(world?.hasPlayer('u2')).toBe(true);

    const player = (await getFirestore().doc(`worlds/${WORLD.worldId}/players/u2`).get()).data();
    expect(player?.['uid']).toBe('u2');
  });

  it('reads back, browser side, the world the admin wrote', async () => {
    await getFirestore().doc(`worlds/${WORLD.worldId}`).set(worldDocument(WORLD, now));

    const snapshot = await getDoc(doc(clientDb(), `worlds/${WORLD.worldId}`));
    const world = worldFrom(WORLD.worldId, snapshot.data() ?? {}, ['u1']);
    expect(world?.game).toBe('enshrouded');
    expect(world?.inviteCode).toBe('c0de');
  });

  it('reads back, admin side, the opening the browser wrote', async () => {
    const client = clientDb();
    const path = serverDocPath(WORLD.worldId);
    await setDoc(doc(client, path), idleServerDocument(now));

    const { session } = Session.opening(
      { sessionId: 's1', world: WORLD, actor: { uid: 'u1', name: 'Alice' } },
      { now: () => now },
      DEFAULT_SETTINGS,
    );
    await setDoc(doc(client, path), openingFields(session, serverTimestamp()), { merge: true });

    const data = (await getFirestore().doc(path).get()).data() ?? {};
    const read = sessionFrom(data, WORLD);
    expect(read?.state).toBe('PROVISIONING');
    expect(read?.sessionId).toBe('s1');
    // Taken from the world, never from the document (§5) — it carries no game.
    expect(read?.game).toBe('enshrouded');
    expect(read?.worldId).toBe('les-copains');
    expect(data['game']).toBeUndefined();
  });

  it('reads back, browser side, a session the admin published', async () => {
    const path = serverDocPath(WORLD.worldId);
    await getFirestore()
      .doc(path)
      .set({
        state: 'RUNNING',
        sessionId: 's1',
        startedBy: 'u1',
        startedAt: Timestamp.fromDate(now),
        deadline: Timestamp.fromDate(new Date('2026-09-07T00:00:00Z')),
        joinInfo: { game: 'enshrouded', hostname: 'h', address: '1.2.3.4', port: 15637 },
      });

    const snapshot = await getDoc(doc(clientDb(), path));
    const session = sessionFrom(snapshot.data() ?? {}, WORLD);
    expect(session?.state).toBe('RUNNING');
    expect(session?.worldId).toBe('les-copains');
    expect(session?.hasJoinInfo).toBe(true);
    expect(session?.deadline.at).toEqual(new Date('2026-09-07T00:00:00Z'));
  });
});
