import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
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
  getFirestore as getClientFirestore,
  setLogLevel,
} from 'firebase/firestore';
import { World, type Game } from '@beacon/session';
import { clientSessionRecord, type ClientSessionRecord, type WorldSummary } from './client-session.js';
import { EVENTS, idleServerDocument, playerDocument, serverDocPath, worldDocument } from './fields.js';

// Same teardown artefact as `round-trip.spec.ts`: the record's settings
// listener lives as long as the record, and deleting a test's client app
// under it makes the sdk log a shutdown error per test.
setLogLevel('silent');

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

beforeEach(async () => {
  await env.clearFirestore();
});

const clientApps: FirebaseApp[] = [];

afterEach(async () => {
  await Promise.all(clientApps.splice(0).map((app) => deleteApp(app)));
});

const NOW = new Date('2026-09-15T20:00:00Z');

/**
 * The browser's face, on the same `mockUserToken: 'owner'` bypass
 * `round-trip.spec.ts` and `version-drift.spec.ts` use: this file is not
 * about what the rules accept — `authorised-writes.spec.ts` is — it is about
 * what `client-session.ts` itself decides and writes.
 */
function record(clock?: { now: () => Date }): ClientSessionRecord {
  const app = initializeClientApp({ projectId: 'demo-beacon' }, `client-${clientApps.length}`);
  clientApps.push(app);
  const db = getClientFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080, { mockUserToken: 'owner' });
  return clientSessionRecord(db, clock);
}

/**
 * `worlds/{id}`, one `players/{uid}` per player and an idle `server/current`,
 * written through the Admin SDK — under §5 that is the deployment's and an
 * admin's own doors into these documents, never a member's, so a test that
 * went through the client to arrange its own fixture would be testing the
 * fixture and not the record.
 */
async function seedWorld(
  worldId: string,
  options: { players: readonly string[]; inviteCode?: string; game?: Game },
): Promise<void> {
  const world = World.from({
    worldId,
    game: options.game ?? 'enshrouded',
    name: worldId,
    inviteCode: options.inviteCode ?? 'c0de',
    players: options.players,
  });
  const db = getFirestore();
  await db.doc(`worlds/${worldId}`).set(worldDocument(world, NOW));
  await Promise.all(
    options.players.map((uid) =>
      db.doc(`worlds/${worldId}/players/${uid}`).set(playerDocument(uid, world.inviteCode, NOW)),
    ),
  );
  await db.doc(serverDocPath(worldId)).set(idleServerDocument(NOW));
}

/**
 * The first publication a `watch*` method delivers, skipping `null` — a
 * world or a view not yet readable is not the state under test, it is the
 * subscription still connecting. `watchMyWorlds` never publishes `null` at
 * all: its own gate holds back the very first call until every world its
 * query found has reported once, so the first array this ever sees is
 * already complete.
 */
function firstValue<T>(subscribe: (onValue: (value: T) => void) => () => void): Promise<T> {
  return new Promise((resolve) => {
    const unsubscribe = subscribe((value) => {
      if (value === null || value === undefined) return;
      unsubscribe();
      resolve(value);
    });
  });
}

/** `events`, oldest first — the order the journal is read in everywhere else. */
async function eventTypes(): Promise<string[]> {
  const snapshot = await getFirestore().collection(EVENTS).orderBy('at').get();
  return snapshot.docs.map((entry) => entry.get('type') as string);
}

describe('a member and their worlds', () => {
  it('sees the worlds where they play, with each server state', async () => {
    await seedWorld('les-copains', { players: ['alice'] });
    await seedWorld('les-autres', { players: ['bob'] });

    const seen = await firstValue<readonly WorldSummary[]>((on) =>
      record().watchMyWorlds('alice', on),
    );

    expect(seen.map((w) => w.world.worldId)).toEqual(['les-copains']);
    expect(seen[0].server?.session.state).toBe('IDLE');
  });

  it('joins with the code, and is then a player', async () => {
    await seedWorld('les-copains', { players: ['bob'], inviteCode: 'c0de' });

    await record().join('les-copains', 'c0de', { uid: 'alice', name: 'Alice' });

    const view = await firstValue<WorldSummary | null>((on) => record().watchWorld('les-copains', on));
    expect(view?.world.hasPlayer('alice')).toBe(true);
    expect(await eventTypes()).toContain('PlayerJoined');
  });

  it('refuses a wrong code before writing anything', async () => {
    await seedWorld('les-copains', { players: ['bob'], inviteCode: 'c0de' });

    await expect(
      record().join('les-copains', 'nope', { uid: 'alice', name: 'Alice' }),
    ).rejects.toThrow(/code/);

    expect(await eventTypes()).toEqual([]);
  });

  it('leaves, renames and regenerates the code, each filed as the spec says', async () => {
    await seedWorld('les-copains', { players: ['alice'], inviteCode: 'c0de' });
    const client = record();

    await client.rename('les-copains', 'Les bras cassés', { uid: 'alice', name: 'Alice' });
    await client.regenerateInvite('les-copains', { uid: 'alice', name: 'Alice' });

    const renamed = await firstValue<WorldSummary | null>((on) =>
      record().watchWorld('les-copains', on),
    );
    expect(renamed?.world.name).toBe('Les bras cassés');
    expect(renamed?.world.inviteCode).not.toBe('c0de');

    await client.leave('les-copains', { uid: 'alice', name: 'Alice' });
    expect(await eventTypes()).toEqual(['WorldRenamed', 'PlayerLeft']);
  });

  it('opens a session on a world, and refuses it on a second one while the first is open', async () => {
    await seedWorld('les-copains', { players: ['alice'] });
    const client = record();

    await client.open({ worldId: 'les-copains', sessionId: 's1', actor: { uid: 'alice', name: 'Alice' } });

    await expect(
      client.open({ worldId: 'les-copains', sessionId: 's2', actor: { uid: 'alice', name: 'Alice' } }),
    ).rejects.toThrow(/PROVISIONING/);
  });

  it('opens two sessions on two worlds the same evening', async () => {
    await seedWorld('les-copains', { players: ['alice'] });
    await seedWorld('les-autres', { players: ['alice'] });
    const client = record();

    await client.open({ worldId: 'les-copains', sessionId: 's1', actor: { uid: 'alice', name: 'Alice' } });
    await client.open({ worldId: 'les-autres', sessionId: 's2', actor: { uid: 'alice', name: 'Alice' } });

    const both = await firstValue<readonly WorldSummary[]>((on) =>
      record().watchMyWorlds('alice', on),
    );
    expect(both.map((w) => w.server?.session.state)).toEqual(['PROVISIONING', 'PROVISIONING']);
  });
});

/**
 * The three gestures a session already offered before this tranche, kept
 * true once each one takes a `worldId`: a world's `server/current` still
 * publishes with its facts as one view, an extension still moves only the
 * deadline within its window, and a stop request still leaves its audit line
 * in the same batch as the state it moves.
 */
describe('a session on a world', () => {
  const ACTOR = { uid: 'alice', name: 'Alice' };

  async function runningServer(worldId: string, deadline: Date): Promise<void> {
    await getFirestore()
      .doc(serverDocPath(worldId))
      .set(
        {
          state: 'RUNNING',
          stateSince: Timestamp.fromDate(NOW),
          sessionId: 's1',
          startedBy: ACTOR.uid,
          startedAt: Timestamp.fromDate(NOW),
          deadline: Timestamp.fromDate(deadline),
        },
        { merge: true },
      );
  }

  it('publishes the world and its session as one view', async () => {
    await seedWorld('les-copains', { players: ['alice'] });

    const view = await firstValue<WorldSummary | null>((on) => record().watchWorld('les-copains', on));

    expect(view?.world.name).toBe('les-copains');
    expect(view?.server?.session.state).toBe('IDLE');
    expect(view?.server?.facts.ip).toBeNull();
  });

  it('extends a running session by writing the deadline alone', async () => {
    await seedWorld('les-copains', { players: ['alice'] });
    const deadline = new Date('2026-09-15T23:45:00Z');
    await runningServer('les-copains', deadline);
    const now = new Date('2026-09-15T23:30:00Z');

    await record({ now: () => now }).extend('les-copains', ACTOR);

    const data = (await getFirestore().doc(serverDocPath('les-copains')).get()).data() ?? {};
    expect((data['deadline'] as Timestamp).toDate()).toEqual(new Date('2026-09-16T00:45:00Z'));
    expect(await eventTypes()).toEqual(['SessionExtended']);
  });

  it('asks for a stop, and the state and its audit line leave together', async () => {
    await seedWorld('les-copains', { players: ['alice'] });
    await runningServer('les-copains', new Date('2026-09-16T00:00:00Z'));

    await record().requestStop('les-copains', ACTOR);

    expect((await getFirestore().doc(serverDocPath('les-copains')).get()).get('state')).toBe(
      'STOPPING',
    );
    expect(await eventTypes()).toEqual(['SessionStopRequested']);
  });
});
