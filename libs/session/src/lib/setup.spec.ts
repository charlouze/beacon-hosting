import { describe, expect, it } from 'vitest';
import {
  type AbandonedSetup,
  advanceSetup,
  firstSetupStep,
  isSetupProgress,
  isSetupStepOrder,
  type KeptSetup,
  type KeptSetupStep,
  markOfLastOpening,
  setupStepRank,
  shownSetup,
} from './setup.js';
import type { PreflightFailure } from './preflight.js';

const OPENED = new Date('2026-10-12T20:00:00Z');
const LATER = new Date('2026-10-12T20:02:00Z');

const kept = (parts: Partial<KeptSetupStep> = {}): KeptSetupStep => ({
  step: 'fetching-game',
  since: OPENED,
  activity: null,
  progress: null,
  ...parts,
});

describe('firstSetupStep', () => {
  it('starts on the waking step, from the instant it is given', () => {
    expect(firstSetupStep(LATER)).toEqual({
      step: 'waking',
      since: LATER,
      activity: null,
      progress: null,
    });
  });
});

describe('advanceSetup', () => {
  it('replaces the kept step by another one, from the instant it was declared', () => {
    const advance = advanceSetup(kept(), { step: 'starting-game' }, LATER);

    expect(advance).toEqual({
      kept: { step: 'starting-game', since: LATER, activity: null, progress: null },
      changed: 'step',
      left: { step: 'fetching-game', since: OPENED },
    });
  });

  // Nothing checks what a game server declares: a step that comes earlier in
  // the game's order replaces the kept one exactly as a later one does.
  it('follows a declaration that goes back to an earlier step', () => {
    const advance = advanceSetup(kept({ step: 'starting-game' }), { step: 'waking' }, LATER);

    expect(advance.kept).toEqual({ step: 'waking', since: LATER, activity: null, progress: null });
    expect(advance.changed).toBe('step');
    expect(advance.left).toEqual({ step: 'starting-game', since: OPENED });
  });

  it('drops the activity and the progress of the step it leaves', () => {
    const advance = advanceSetup(
      kept({ activity: 'downloading', progress: 80 }),
      { step: 'restoring-world' },
      LATER,
    );

    expect(advance.kept.activity).toBeNull();
    expect(advance.kept.progress).toBeNull();
  });

  it('changes nothing when the same step is declared twice', () => {
    const before = kept({ activity: 'downloading', progress: 40 });

    const advance = advanceSetup(
      before,
      { step: 'fetching-game', activity: 'downloading', progress: 40 },
      LATER,
    );

    expect(advance).toEqual({ kept: before, changed: null, left: null });
  });

  it('keeps the instant the step began when only its progress moves', () => {
    const advance = advanceSetup(
      kept({ activity: 'downloading', progress: 40 }),
      { step: 'fetching-game', activity: 'downloading', progress: 41 },
      LATER,
    );

    expect(advance.kept).toEqual(kept({ activity: 'downloading', progress: 41 }));
    expect(advance.changed).toBe('progress');
    expect(advance.left).toBeNull();
  });

  it('reports an activity that changes inside the same step', () => {
    const advance = advanceSetup(
      kept({ activity: 'downloading', progress: 100 }),
      { step: 'fetching-game', activity: 'unpacking' },
      LATER,
    );

    expect(advance.kept).toEqual(kept({ activity: 'unpacking', progress: null }));
    expect(advance.changed).toBe('activity');
    expect(advance.left).toBeNull();
  });
});

describe('isSetupProgress', () => {
  it('takes a whole percentage and nothing else', () => {
    expect(isSetupProgress(0)).toBe(true);
    expect(isSetupProgress(100)).toBe(true);
    expect(isSetupProgress(101)).toBe(false);
    expect(isSetupProgress(-1)).toBe(false);
    expect(isSetupProgress(41.5)).toBe(false);
    expect(isSetupProgress(Number.NaN)).toBe(false);
    expect(isSetupProgress('41')).toBe(false);
  });
});

describe('isSetupStepOrder', () => {
  it('takes the four steps once each, waking first and starting-game last', () => {
    expect(
      isSetupStepOrder(['waking', 'restoring-world', 'fetching-game', 'starting-game']),
    ).toBe(true);
    expect(
      isSetupStepOrder(['waking', 'fetching-game', 'restoring-world', 'starting-game']),
    ).toBe(true);
  });

  it('refuses an order that misses, repeats or misplaces a step', () => {
    expect(isSetupStepOrder(['waking', 'fetching-game', 'starting-game'])).toBe(false);
    expect(
      isSetupStepOrder(['waking', 'fetching-game', 'fetching-game', 'starting-game']),
    ).toBe(false);
    expect(
      isSetupStepOrder(['fetching-game', 'waking', 'restoring-world', 'starting-game']),
    ).toBe(false);
    expect(
      isSetupStepOrder(['waking', 'starting-game', 'restoring-world', 'fetching-game']),
    ).toBe(false);
    expect(isSetupStepOrder('waking')).toBe(false);
  });
});

describe('shownSetup', () => {
  const ORDER = ['waking', 'restoring-world', 'fetching-game', 'starting-game'] as const;
  const ABANDONED = new Date('2026-10-12T20:05:00Z');
  const PREPARING = { state: 'PROVISIONING', sessionId: 's1', startedAt: OPENED } as const;
  const OUT_OF_SERVICE = { ...PREPARING, state: 'IDLE' } as const;

  const keptFor = (sessionId: string): KeptSetup => ({
    sessionId,
    order: ORDER,
    step: kept({ since: LATER, activity: 'downloading', progress: 37 }),
  });

  const markOf = (sessionId: string, cause: PreflightFailure | null = null): AbandonedSetup => ({
    sessionId,
    at: ABANDONED,
    cause,
  });

  it('shows the kept step and the order of its game, while its own session prepares', () => {
    expect(shownSetup(PREPARING, null, keptFor('s1'))).toEqual({
      stage: 'step',
      step: { step: 'fetching-game', since: LATER, activity: 'downloading', progress: 37 },
      order: ORDER,
      abandonedAt: null,
    });
  });

  it('shows the preflight check since the opening while no step is kept', () => {
    expect(shownSetup(PREPARING, null, null)).toEqual({
      stage: 'preflight',
      since: OPENED,
      abandonedAt: null,
      failure: null,
    });
  });

  // Nothing erases what a setup left: the next session finds the previous one
  // there until its own is begun.
  it('shows the preflight check when what is kept belongs to another session', () => {
    expect(shownSetup(PREPARING, null, keptFor('s0'))).toEqual({
      stage: 'preflight',
      since: OPENED,
      abandonedAt: null,
      failure: null,
    });
  });

  // The mark of the setup before is erased when the next one is claimed, not
  // when it is opened: a session that prepares is never shown as abandoned.
  it('shows a session that prepares as under way, whatever mark is left', () => {
    expect(shownSetup(PREPARING, markOf('s0'), keptFor('s1'))?.abandonedAt).toBeNull();
    expect(shownSetup(PREPARING, markOf('s1'), keptFor('s1'))?.abandonedAt).toBeNull();
  });

  for (const state of ['IDLE', 'RUNNING', 'STOPPING', 'FAILED'] as const) {
    it(`shows nothing of a session that is ${state} and abandoned no setup`, () => {
      expect(shownSetup({ ...PREPARING, state }, null, keptFor('s1'))).toBeNull();
    });
  }

  it('shows the step an abandoned setup stopped at, and the instant it was abandoned', () => {
    expect(shownSetup(OUT_OF_SERVICE, markOf('s1'), keptFor('s1'))).toEqual({
      stage: 'step',
      step: { step: 'fetching-game', since: LATER, activity: 'downloading', progress: 37 },
      order: ORDER,
      abandonedAt: ABANDONED,
    });
  });

  it('shows it too while what is left of the session is not cleared', () => {
    expect(
      shownSetup({ ...PREPARING, state: 'FAILED' }, markOf('s1'), keptFor('s1'))?.abandonedAt,
    ).toEqual(ABANDONED);
  });

  it('shows the preflight check as where an abandoned setup stopped, when no step was kept for it', () => {
    const stopped = { stage: 'preflight', since: OPENED, abandonedAt: ABANDONED, failure: null };
    expect(shownSetup(OUT_OF_SERVICE, markOf('s1'), keptFor('s0'))).toEqual(stopped);
    expect(shownSetup(OUT_OF_SERVICE, markOf('s1'), null)).toEqual(stopped);
  });

  it('shows why the preflight check failed, when the mark of the abandon says it', () => {
    expect(shownSetup(OUT_OF_SERVICE, markOf('s1', 'copy-behind'), null)).toEqual({
      stage: 'preflight',
      since: OPENED,
      abandonedAt: ABANDONED,
      failure: 'copy-behind',
    });
    expect(shownSetup(OUT_OF_SERVICE, markOf('s1', 'version-unreadable'), null)).toEqual({
      stage: 'preflight',
      since: OPENED,
      abandonedAt: ABANDONED,
      failure: 'version-unreadable',
    });
  });

  it('shows no failure for a preflight check abandoned without a cause, nor for one under way', () => {
    expect(shownSetup(OUT_OF_SERVICE, markOf('s1'), null)).toMatchObject({ failure: null });
    expect(shownSetup(PREPARING, markOf('s0', 'copy-behind'), null)).toMatchObject({ failure: null });
  });

  // A session opened then stopped before it was claimed leaves the mark of
  // the session before it: that mark no longer names the last one opened.
  it('shows nothing when the mark names another session than the last one opened', () => {
    expect(shownSetup(OUT_OF_SERVICE, markOf('s0'), keptFor('s0'))).toBeNull();
    expect(shownSetup(OUT_OF_SERVICE, markOf('s0'), keptFor('s1'))).toBeNull();
  });

  it('shows nothing of a world that names no opening', () => {
    expect(shownSetup({ ...PREPARING, startedAt: null }, null, keptFor('s1'))).toBeNull();
    expect(shownSetup({ ...PREPARING, sessionId: null }, null, null)).toBeNull();
    expect(shownSetup({ ...OUT_OF_SERVICE, sessionId: null }, markOf('s1'), null)).toBeNull();
  });
});

describe('setupStepRank', () => {
  const step = kept({ step: 'fetching-game' });

  it('reads the rank of a step in the order of its game, from one', () => {
    expect(
      setupStepRank({
        stage: 'step',
        step,
        order: ['waking', 'restoring-world', 'fetching-game', 'starting-game'],
        abandonedAt: null,
      }),
    ).toBe(3);
    expect(
      setupStepRank({
        stage: 'step',
        step,
        order: ['waking', 'fetching-game', 'restoring-world', 'starting-game'],
        abandonedAt: null,
      }),
    ).toBe(2);
  });

  it('ranks the last step fourth', () => {
    expect(
      setupStepRank({
        stage: 'step',
        step: kept({ step: 'starting-game' }),
        order: ['waking', 'fetching-game', 'restoring-world', 'starting-game'],
        abandonedAt: null,
      }),
    ).toBe(4);
  });
});

describe('markOfLastOpening', () => {
  const AT = new Date('2026-10-15T20:14:00Z');
  const mark: AbandonedSetup = { sessionId: 's1', at: AT, cause: 'copy-behind' };
  const opening = (state: 'IDLE' | 'PROVISIONING', sessionId: string) => ({ state, sessionId, startedAt: AT });

  it('is the mark of the last session opened, once it no longer prepares', () => {
    expect(markOfLastOpening(opening('IDLE', 's1'), mark)).toBe(mark);
  });

  it('is none while the last session opened prepares', () => {
    expect(markOfLastOpening(opening('PROVISIONING', 's1'), mark)).toBeNull();
  });

  // A session stopped before it was claimed leaves the mark of the session before it.
  it('is none when the mark names another session', () => {
    expect(markOfLastOpening(opening('IDLE', 's2'), mark)).toBeNull();
  });

  it('is none when there is no mark', () => {
    expect(markOfLastOpening(opening('IDLE', 's1'), null)).toBeNull();
  });
});
