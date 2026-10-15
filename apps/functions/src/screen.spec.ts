import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { displayedFactsFrom, keptSetupFrom, sessionFrom, setupDocPath } from '@beacon/session-record';
import { DEFAULT_SETTINGS, World } from '@beacon/session';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEV_WORLD_ID } from './personas.js';
import { screen, SCREENS, isScreen, screenFixture } from './screen.js';

process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';
process.env['FIREBASE_AUTH_EMULATOR_HOST'] ??= '127.0.0.1:9099';

const NOW = new Date('2026-09-14T20:00:00.000Z');

// `sessionFrom` reads `worldId` and `game` off the world, not off the
// document (§5) — a fixed stand-in world is enough for every test here, since
// none of them assert on it.
const WORLD = World.from({
  worldId: DEV_WORLD_ID,
  game: 'enshrouded',
  name: 'Dev world',
  inviteCode: 'dev',
  players: [],
});

describe('screenFixture', () => {
  it.each([
    ['preflight-behind', 'copy-behind'],
    ['preflight-unreadable', 'version-unreadable'],
  ] as const)('stages %s as a world out of service whose last setup stopped at its preflight check', (name, cause) => {
    const fixture = screenFixture(name, NOW);
    expect(fixture['state']).toBe('IDLE');
    expect(fixture['abandonedSetup']).toEqual({
      sessionId: fixture['sessionId'],
      at: expect.any(Date),
      cause,
    });
  });

  // It waits from the copy document `screen()` writes, not from an abandon.
  it('stages copy-awaited as a world out of service with no abandoned setup', () => {
    expect(screenFixture('copy-awaited', NOW)['abandonedSetup']).toBeNull();
  });

  it('names only screens the board can actually announce', () => {
    expect(SCREENS).toEqual([
      'idle',
      'preflight',
      'preparing',
      'running',
      'running-sunkenland',
      'expiring',
      'closing',
      'failed',
      'preflight-behind',
      'preflight-unreadable',
      'copy-awaited',
      'unreadable',
    ]);
    expect(isScreen('running')).toBe(true);
    expect(isScreen('RUNNING')).toBe(false);
  });

  // The point of the whole module: a fixture the domain refuses is a fixture
  // that shows 'Unknown' instead of the screen asked for — silently, since the
  // board has a row for it.
  it.each([
    ['idle', 'IDLE'],
    ['preflight', 'PROVISIONING'],
    ['preparing', 'PROVISIONING'],
    ['running', 'RUNNING'],
    ['running-sunkenland', 'RUNNING'],
    ['expiring', 'RUNNING'],
    ['closing', 'STOPPING'],
    ['failed', 'FAILED'],
    ['copy-awaited', 'IDLE'],
  ] as const)('makes %s readable as %s', (screen, state) => {
    expect(sessionFrom(screenFixture(screen, NOW), WORLD)?.state).toBe(state);
  });

  it('makes unreadable a document this vocabulary cannot read', () => {
    expect(sessionFrom(screenFixture('unreadable', NOW), WORLD)).toBeNull();
  });

  it('publishes a join point on every running screen, per game', () => {
    expect(displayedFactsFrom(screenFixture('running', NOW)).joinInfo?.game).toBe('enshrouded');
    expect(displayedFactsFrom(screenFixture('running-sunkenland', NOW)).joinInfo?.game).toBe(
      'sunkenland',
    );
  });

  // What separates 'running' from 'expiring' is the only thing the product
  // really has: whether the extension button is clickable.
  it('puts the deadline outside the extension window on running', () => {
    const deadline = screenFixture('running', NOW)['deadline'] as Date;
    expect(deadline.getTime() - NOW.getTime()).toBeGreaterThan(DEFAULT_SETTINGS.extensionWindowMs);
  });

  it('puts the deadline inside the extension window on expiring', () => {
    const deadline = screenFixture('expiring', NOW)['deadline'] as Date;
    expect(deadline.getTime() - NOW.getTime()).toBeLessThan(DEFAULT_SETTINGS.extensionWindowMs);
    expect(deadline.getTime()).toBeGreaterThan(NOW.getTime());
  });

  it('opens the preparing session when its setup starts, so a ready window starts from the opening', () => {
    const fixture = screenFixture('preparing', NOW);
    const startedAt = fixture['startedAt'] as Date;
    expect(startedAt).toEqual(fixture['stateSince']);
    expect(startedAt).toEqual(fixture['provisionClaimedAt']);
    expect(NOW.getTime() - startedAt.getTime()).toBe(40_000);
    expect((fixture['deadline'] as Date).getTime() - startedAt.getTime()).toBe(
      DEFAULT_SETTINGS.sessionDurationMs,
    );
  });

  it('says what went wrong on the screen that reports a failure', () => {
    expect(displayedFactsFrom(screenFixture('failed', NOW)).lastError).toBeTruthy();
  });

  it('leaves no fact behind from the screen written before it', () => {
    const idle = screenFixture('idle', NOW);
    for (const field of ['sessionId', 'game', 'deadline', 'ip', 'joinInfo', 'lastError']) {
      expect(idle[field]).toBeNull();
    }
  });

  // Every screen writes the same key set, so one `set` overwrites the previous
  // screen whole — a partial write would leave a RUNNING session's ip under an
  // IDLE state, which is exactly the incoherence the watchdog hunts.
  it('writes the same fields whatever the screen', () => {
    const keys = Object.keys(screenFixture('idle', NOW)).sort();
    for (const screen of SCREENS) {
      expect(Object.keys(screenFixture(screen, NOW)).sort()).toEqual(keys);
    }
  });
});

describe('screen', () => {
  let app: ReturnType<typeof initializeApp>;
  let db: Firestore;

  beforeAll(() => {
    app = initializeApp({ projectId: 'demo-beacon' }, 'screen-spec');
    db = getFirestore(app);
  });

  afterAll(async () => {
    await deleteApp(app);
  });

  it('stages the screen on the dev world', async () => {
    await screen('running', NOW);

    const doc = await db.doc('worlds/dev-world/server/current').get();
    expect(doc.get('state')).toBe('RUNNING');
    expect(doc.get('game')).toBeUndefined();
    expect(doc.get('joinInfo').hostname).toBe('dev-world.beacon.charlouze.com');
  });

  it('keeps two completed setups of the dev world game, so a ready window can be announced', async () => {
    await db.doc('completedSetups/enshrouded').delete();
    await screen('preparing', NOW);

    const doc = await db.doc('completedSetups/enshrouded').get();
    expect(doc.get('setups').map((setup: { durationMs: number }) => setup.durationMs)).toEqual([
      300_000, 480_000,
    ]);
  });

  it('stages a claimed session that keeps no step yet, on preflight', async () => {
    await screen('preparing', NOW);
    await screen('preflight', NOW);

    const server = await db.doc('worlds/dev-world/server/current').get();
    expect(server.get('state')).toBe('PROVISIONING');
    expect(server.get('provisionClaimedAt')).not.toBeNull();
    expect((await db.doc(setupDocPath(DEV_WORLD_ID)).get()).exists).toBe(false);
  });

  it('keeps the first step for the staged session, on preparing', async () => {
    await screen('preflight', NOW);
    await screen('preparing', NOW);

    const kept = keptSetupFrom((await db.doc(setupDocPath(DEV_WORLD_ID)).get()).data() ?? {});
    expect(kept?.sessionId).toBe('dev-session-0001');
    expect(kept?.step.step).toBe('waking');
  });
});
