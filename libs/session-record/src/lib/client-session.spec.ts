import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { completedSetupStore } from './completed-setups-record.js';
import { clientSessionRecord, type ClientSessionRecord, type WorldSummary } from './client-session.js';
import { EVENTS, idleServerDocument, playerDocument, serverDocPath, worldDocument } from './fields.js';
import { setupStores } from './setup-record.js';

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

  it('keeps publishing the readable worlds when one of them is unreadable', async () => {
    await seedWorld('les-copains', { players: ['alice'] });
    // Malformed on purpose — an invalid game — so `worldFrom` reads it as
    // null, the same way a rules refusal would once T9 lands.
    await getFirestore().doc('worlds/le-mauvais').set({ game: 'not-a-game', name: 'x', inviteCode: 'c0de' });
    await getFirestore()
      .doc('worlds/le-mauvais/players/alice')
      .set(playerDocument('alice', 'c0de', NOW));

    const seen = await firstValue<readonly WorldSummary[]>((on) =>
      record().watchMyWorlds('alice', on),
    );

    expect(seen.map((w) => w.world.worldId)).toEqual(['les-copains']);
  });

  it('shows a player who joins, and drops one who leaves, without a new subscription', async () => {
    await seedWorld('les-copains', { players: ['alice'], inviteCode: 'c0de' });
    const seen: (WorldSummary | null)[] = [];
    const unsubscribe = record().watchWorld('les-copains', (view) => seen.push(view));
    await vi.waitFor(() => expect(seen.some((v) => v !== null)).toBe(true));

    await record().join('les-copains', 'c0de', { uid: 'bob', name: 'Bob' });
    await vi.waitFor(() =>
      expect(seen.some((v) => v?.world.hasPlayer('bob') === true)).toBe(true),
    );

    await record().leave('les-copains', { uid: 'bob', name: 'Bob' });
    await vi.waitFor(() => {
      const last = seen.at(-1);
      expect(last?.world.hasPlayer('bob')).toBe(false);
    });

    unsubscribe();
  });

  it('joins with the code, and is then a player', async () => {
    await seedWorld('les-copains', { players: ['bob'], inviteCode: 'c0de' });

    await record().join('les-copains', 'c0de', { uid: 'alice', name: 'Alice' });

    const view = await firstValue<WorldSummary | null>((on) => record().watchWorld('les-copains', on));
    expect(view?.world.hasPlayer('alice')).toBe(true);
    expect(await eventTypes()).toContain('PlayerJoined');
  });

  it('lets a player rejoin their own world, and writes nothing for it', async () => {
    await seedWorld('les-copains', { players: ['alice'], inviteCode: 'c0de' });
    await record().join('les-copains', 'c0de', { uid: 'alice', name: 'Alice' });
    await record().join('les-copains', 'stale', { uid: 'alice', name: 'Alice' });
    expect(await eventTypes()).toEqual([]);
  });

  // Moved to `authorised-writes.spec.ts` (T9): the code is now refused by the
  // rule itself, comparing `request.resource.data.code` to the world's own
  // via a `get()` — and the `'owner'` token this file connects with bypasses
  // rules entirely, so a wrong code written here would go through uncontested.

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

describe('the setup of a session that prepares', () => {
  const OPENED = new Date('2026-10-12T20:14:00Z');
  const AT = new Date('2026-10-12T20:16:00Z');
  const ORDER = ['waking', 'restoring-world', 'fetching-game', 'starting-game'] as const;
  const PREFLIGHT = { stage: 'preflight', since: OPENED, abandonedAt: null, failure: null };

  async function preparingServer(worldId: string, sessionId: string): Promise<void> {
    await getFirestore()
      .doc(serverDocPath(worldId))
      .set(
        {
          state: 'PROVISIONING',
          stateSince: Timestamp.fromDate(OPENED),
          sessionId,
          startedBy: 'alice',
          startedAt: Timestamp.fromDate(OPENED),
          deadline: Timestamp.fromDate(new Date(OPENED.getTime() + 4 * 3_600_000)),
        },
        { merge: true },
      );
  }

  const setups = () => setupStores(getFirestore()).for('les-copains');

  const view = () =>
    firstValue<WorldSummary | null>((on) => record().watchWorld('les-copains', on));

  it('publishes the kept step and the order of the game with the world', async () => {
    await seedWorld('les-copains', { players: ['alice'] });
    await preparingServer('les-copains', 's1');
    await setups().begin('s1', ORDER, OPENED);
    await setups().advance('s1', { step: 'fetching-game', activity: 'downloading', progress: 37 }, AT);

    expect((await view())?.server?.setup).toEqual({
      stage: 'step',
      step: { step: 'fetching-game', since: AT, activity: 'downloading', progress: 37 },
      order: [...ORDER],
      abandonedAt: null,
    });
  });

  it('publishes the preflight check since the opening while no setup is kept', async () => {
    await seedWorld('les-copains', { players: ['alice'] });
    await preparingServer('les-copains', 's1');

    expect((await view())?.server?.setup).toEqual(PREFLIGHT);
  });

  it('publishes the preflight check while the kept setup is still the previous session’s', async () => {
    await seedWorld('les-copains', { players: ['alice'] });
    await preparingServer('les-copains', 's0');
    await setups().begin('s0', ORDER, new Date('2026-10-11T20:00:00Z'));
    await setups().advance('s0', { step: 'starting-game' }, new Date('2026-10-11T20:05:00Z'));
    await preparingServer('les-copains', 's1');

    expect((await view())?.server?.setup).toEqual(PREFLIGHT);
  });

  it('publishes no setup for a world out of service, whatever is kept', async () => {
    await seedWorld('les-copains', { players: ['alice'] });
    await preparingServer('les-copains', 's0');
    await setups().begin('s0', ORDER, OPENED);
    await getFirestore().doc(serverDocPath('les-copains')).set(idleServerDocument(NOW));

    const seen = await view();

    expect(seen?.server?.session.state).toBe('IDLE');
    expect(seen?.server?.setup).toBeNull();
  });

  describe('once it is abandoned', () => {
    const ABANDONED = new Date('2026-10-12T20:19:00Z');

    /** What an abandon leaves: out of service, the session still named, and the mark. */
    async function abandonedServer(sessionId: string, markedSession = sessionId): Promise<void> {
      await getFirestore()
        .doc(serverDocPath('les-copains'))
        .set(
          {
            state: 'IDLE',
            stateSince: Timestamp.fromDate(ABANDONED),
            sessionId,
            abandonedSetup: { sessionId: markedSession, at: Timestamp.fromDate(ABANDONED) },
          },
          { merge: true },
        );
    }

    it('publishes the step the setup stopped at, and the instant it was abandoned', async () => {
      await seedWorld('les-copains', { players: ['alice'] });
      await preparingServer('les-copains', 's1');
      await setups().begin('s1', ORDER, OPENED);
      await setups().advance('s1', { step: 'fetching-game' }, AT);
      await abandonedServer('s1');

      const seen = await view();

      expect(seen?.server?.session.state).toBe('IDLE');
      expect(seen?.server?.setup).toEqual({
        stage: 'step',
        step: { step: 'fetching-game', since: AT, activity: null, progress: null },
        order: [...ORDER],
        abandonedAt: ABANDONED,
      });
    });

    it('publishes the preflight check when the setup it kept is another session’s', async () => {
      await seedWorld('les-copains', { players: ['alice'] });
      await preparingServer('les-copains', 's0');
      await setups().begin('s0', ORDER, OPENED);
      await preparingServer('les-copains', 's1');
      await abandonedServer('s1');

      expect((await view())?.server?.setup).toEqual({ ...PREFLIGHT, abandonedAt: ABANDONED });
    });

    // A session opened and stopped before it was claimed: the mark is still
    // the one of the session before it.
    it('publishes nothing when the mark names another session than the last one opened', async () => {
      await seedWorld('les-copains', { players: ['alice'] });
      await preparingServer('les-copains', 's2');
      await abandonedServer('s2', 's1');

      expect((await view())?.server?.setup).toBeNull();
    });
  });

  describe('the ready window it announces', () => {
    const FIVE_MINUTES = 300_000;
    const EIGHT_MINUTES = 480_000;
    const after = (ms: number) => new Date(OPENED.getTime() + ms);

    const completed = async (game: Game, ...durationsMs: number[]): Promise<void> => {
      const store = completedSetupStore(getFirestore());
      for (const [index, durationMs] of durationsMs.entries()) {
        await store.keep(game, { sessionId: `past-${index}`, durationMs });
      }
    };

    it('goes from the shortest to the longest of the last setups of the game', async () => {
      await seedWorld('les-copains', { players: ['alice'] });
      await preparingServer('les-copains', 's1');
      await completed('enshrouded', 360_000, FIVE_MINUTES, EIGHT_MINUTES);

      expect((await view())?.server?.readyWindow).toEqual({
        from: after(FIVE_MINUTES),
        to: after(EIGHT_MINUTES),
      });
    });

    it('is none while the game counts a single completed setup', async () => {
      await seedWorld('les-copains', { players: ['alice'] });
      await preparingServer('les-copains', 's1');
      await completed('enshrouded', FIVE_MINUTES);

      const seen = await view();

      expect(seen?.server?.session.state).toBe('PROVISIONING');
      expect(seen?.server?.readyWindow).toBeNull();
    });

    it('is none while the game kept nothing at all', async () => {
      await seedWorld('les-copains', { players: ['alice'] });
      await preparingServer('les-copains', 's1');

      expect((await view())?.server?.readyWindow).toBeNull();
    });

    it('is drawn from the setups of the world’s own game, and of no other', async () => {
      await seedWorld('les-copains', { players: ['alice'], game: 'sunkenland' });
      await preparingServer('les-copains', 's1');
      await completed('enshrouded', FIVE_MINUTES, EIGHT_MINUTES);

      expect((await view())?.server?.readyWindow).toBeNull();
    });

    it('is none for a world out of service, whatever its game kept', async () => {
      await seedWorld('les-copains', { players: ['alice'] });
      await completed('enshrouded', FIVE_MINUTES, EIGHT_MINUTES);

      const seen = await view();

      expect(seen?.server?.session.state).toBe('IDLE');
      expect(seen?.server?.readyWindow).toBeNull();
    });

    it('follows a setup that completes while the world is watched', async () => {
      await seedWorld('les-copains', { players: ['alice'] });
      await preparingServer('les-copains', 's1');
      await completed('enshrouded', FIVE_MINUTES);
      const seen: (WorldSummary | null)[] = [];
      const unsubscribe = record().watchWorld('les-copains', (summary) => seen.push(summary));
      await vi.waitFor(() => expect(seen.some((summary) => summary !== null)).toBe(true));

      await completedSetupStore(getFirestore()).keep('enshrouded', {
        sessionId: 'another-world',
        durationMs: EIGHT_MINUTES,
      });

      await vi.waitFor(() =>
        expect(seen.at(-1)?.server?.readyWindow).toEqual({
          from: after(FIVE_MINUTES),
          to: after(EIGHT_MINUTES),
        }),
      );
      unsubscribe();
    });
  });

  // The progress lives in a document of its own: a write to it moves no field
  // of `server/current`, and must reach the screen all the same.
  it('publishes again when the step moves, without any write to the session', async () => {
    await seedWorld('les-copains', { players: ['alice'] });
    await preparingServer('les-copains', 's1');
    await setups().begin('s1', ORDER, OPENED);
    const seen: (WorldSummary | null)[] = [];
    const stop = record().watchWorld('les-copains', (summary) => seen.push(summary));
    const keptStep = () => {
      const setup = seen.at(-1)?.server?.setup;
      return setup?.stage === 'step' ? setup.step : null;
    };
    await vi.waitFor(() => expect(keptStep()?.step).toBe('waking'), {
      timeout: 5_000,
    });

    await setups().advance('s1', { step: 'restoring-world' }, AT);

    await vi.waitFor(
      () =>
        expect(keptStep()).toEqual({
          step: 'restoring-world',
          since: AT,
          activity: null,
          progress: null,
        }),
      { timeout: 5_000 },
    );
    stop();
  });
});
