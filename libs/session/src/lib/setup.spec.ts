import { describe, expect, it } from 'vitest';
import {
  advanceSetup,
  firstSetupStep,
  isSetupProgress,
  isSetupStepOrder,
  type KeptSetupStep,
} from './setup.js';

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
  it('starts on the waking step, at the opening of the session', () => {
    expect(firstSetupStep(OPENED)).toEqual({
      step: 'waking',
      since: OPENED,
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
