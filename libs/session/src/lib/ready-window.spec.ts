import { describe, expect, it } from 'vitest';
import {
  completedSetup,
  keepCompletedSetup,
  readyWindow,
  type CompletedSetup,
} from './ready-window.js';

const OPENED = new Date('2026-10-12T20:14:00Z');
const PREPARING = { state: 'PROVISIONING', sessionId: 's1', startedAt: OPENED } as const;

const MINUTE = 60_000;
const after = (ms: number) => new Date(OPENED.getTime() + ms);

describe('completedSetup', () => {
  it('lasts from the opening of its session to its coming into service', () => {
    expect(completedSetup('s1', OPENED, after(7 * MINUTE))).toEqual({
      sessionId: 's1',
      durationMs: 7 * MINUTE,
    });
  });
});

describe('keepCompletedSetup', () => {
  const past = (count: number): CompletedSetup[] =>
    Array.from({ length: count }, (_, index) => ({
      sessionId: `past-${index}`,
      durationMs: (index + 1) * MINUTE,
    }));

  it('keeps a completed setup after the ones already kept', () => {
    expect(keepCompletedSetup(past(2), { sessionId: 's1', durationMs: 9 * MINUTE })).toEqual([
      ...past(2),
      { sessionId: 's1', durationMs: 9 * MINUTE },
    ]);
  });

  it('keeps the first one of a game', () => {
    expect(keepCompletedSetup([], { sessionId: 's1', durationMs: 9 * MINUTE })).toEqual([
      { sessionId: 's1', durationMs: 9 * MINUTE },
    ]);
  });

  it('lets the oldest go once five are kept', () => {
    const kept = keepCompletedSetup(past(5), { sessionId: 's1', durationMs: 9 * MINUTE });

    expect(kept?.map((setup) => setup.sessionId)).toEqual([
      'past-1',
      'past-2',
      'past-3',
      'past-4',
      's1',
    ]);
  });

  // Two `ready` reports of the same session must not count its setup twice.
  it('answers null for a session that is already kept', () => {
    expect(keepCompletedSetup(past(3), { sessionId: 'past-1', durationMs: 9 * MINUTE })).toBeNull();
  });
});

describe('readyWindow', () => {
  it('goes from the opening plus the shortest setup to the opening plus the longest', () => {
    expect(readyWindow(PREPARING, [6 * MINUTE, 5 * MINUTE, 8 * MINUTE])).toEqual({
      from: after(5 * MINUTE),
      to: after(8 * MINUTE),
    });
  });

  it('announces nothing while the game counts no completed setup', () => {
    expect(readyWindow(PREPARING, [])).toBeNull();
  });

  it('announces nothing while the game counts a single completed setup', () => {
    expect(readyWindow(PREPARING, [5 * MINUTE])).toBeNull();
  });

  it('announces a window from two completed setups', () => {
    expect(readyWindow(PREPARING, [8 * MINUTE, 5 * MINUTE])).toEqual({
      from: after(5 * MINUTE),
      to: after(8 * MINUTE),
    });
  });

  // Oldest first: the first of six no longer counts, though it is both the
  // shortest and nothing like the others.
  it('draws from the last five only', () => {
    const durations = [1 * MINUTE, 6 * MINUTE, 7 * MINUTE, 5 * MINUTE, 9 * MINUTE, 8 * MINUTE];

    expect(readyWindow(PREPARING, durations)).toEqual({
      from: after(5 * MINUTE),
      to: after(9 * MINUTE),
    });
  });

  it('announces the next minute for the later hour when both fall in the same one', () => {
    expect(readyWindow(PREPARING, [5 * MINUTE + 10_000, 5 * MINUTE + 40_000])).toEqual({
      from: after(5 * MINUTE + 10_000),
      to: after(6 * MINUTE + 40_000),
    });
  });

  it('never announces a single hour for two setups of the same duration', () => {
    expect(readyWindow(PREPARING, [5 * MINUTE, 5 * MINUTE])).toEqual({
      from: after(5 * MINUTE),
      to: after(6 * MINUTE),
    });
  });

  // 20:19:50 and 20:20:10: twenty seconds apart, and two hours all the same.
  it('leaves alone two hours that fall in neighbouring minutes', () => {
    expect(readyWindow(PREPARING, [5 * MINUTE + 50_000, 6 * MINUTE + 10_000])).toEqual({
      from: after(5 * MINUTE + 50_000),
      to: after(6 * MINUTE + 10_000),
    });
  });

  for (const state of ['IDLE', 'RUNNING', 'STOPPING', 'FAILED'] as const) {
    it(`announces nothing for a session that is ${state}`, () => {
      expect(readyWindow({ ...PREPARING, state }, [5 * MINUTE, 8 * MINUTE])).toBeNull();
    });
  }

  it('announces nothing for a world that names no opening', () => {
    expect(
      readyWindow({ state: 'PROVISIONING', sessionId: null, startedAt: null }, [5 * MINUTE, 8 * MINUTE]),
    ).toBeNull();
  });
});
