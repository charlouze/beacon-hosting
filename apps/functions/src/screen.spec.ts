import { displayedFactsFrom, sessionFrom } from '@beacon/session-record';
import { DEFAULT_SETTINGS } from '@beacon/session';
import { SCREENS, isScreen, screenFixture } from './screen.js';

const NOW = new Date('2026-09-14T20:00:00.000Z');

describe('screenFixture', () => {
  it('names only screens the board can actually announce', () => {
    expect(SCREENS).toEqual([
      'idle',
      'preparing',
      'running',
      'running-sunkenland',
      'expiring',
      'closing',
      'failed',
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
    ['preparing', 'PROVISIONING'],
    ['running', 'RUNNING'],
    ['running-sunkenland', 'RUNNING'],
    ['expiring', 'RUNNING'],
    ['closing', 'STOPPING'],
    ['failed', 'FAILED'],
  ] as const)('makes %s readable as %s', (screen, state) => {
    expect(sessionFrom(screenFixture(screen, NOW))?.state).toBe(state);
  });

  it('makes unreadable a document this vocabulary cannot read', () => {
    expect(sessionFrom(screenFixture('unreadable', NOW))).toBeNull();
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
