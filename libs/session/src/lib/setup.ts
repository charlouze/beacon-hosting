import type { Session } from './session-aggregate.js';
import type { SessionId } from './session.js';

/**
 * What a session goes through between its opening and its coming into
 * service. The first step starts at the opening and the last one is the game
 * starting; the order of the two others depends on the game.
 */
export const SETUP_STEPS = ['waking', 'fetching-game', 'restoring-world', 'starting-game'] as const;

export type SetupStep = (typeof SETUP_STEPS)[number];

export function isSetupStep(value: unknown): value is SetupStep {
  return SETUP_STEPS.includes(value as SetupStep);
}

/**
 * What a game server does inside a step. One closed list for every game: a
 * game uses the activities that suit it, and a new one is a value added here.
 */
export const SETUP_ACTIVITIES = ['downloading', 'unpacking'] as const;

export type SetupActivity = (typeof SETUP_ACTIVITIES)[number];

export function isSetupActivity(value: unknown): value is SetupActivity {
  return SETUP_ACTIVITIES.includes(value as SetupActivity);
}

/** The share already done of the current activity, or of the step when it has none: a whole percentage. */
export type SetupProgress = number;

export function isSetupProgress(value: unknown): value is SetupProgress {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100;
}

/** The four steps in the order one game goes through them. */
export type SetupStepOrder = readonly SetupStep[];

export function isSetupStepOrder(value: unknown): value is SetupStepOrder {
  if (!Array.isArray(value) || value.length !== SETUP_STEPS.length) return false;
  if (!SETUP_STEPS.every((step) => value.includes(step))) return false;
  return value[0] === 'waking' && value[value.length - 1] === 'starting-game';
}

/** What a game server says of its own setup. Nothing checks it. */
export interface SetupDeclaration {
  readonly step: SetupStep;
  readonly activity?: SetupActivity;
  readonly progress?: SetupProgress;
}

/** The step the control plane holds for a session, and the instant it began. */
export interface KeptSetupStep {
  readonly step: SetupStep;
  readonly since: Date;
  readonly activity: SetupActivity | null;
  readonly progress: SetupProgress | null;
}

export type SetupChange = 'step' | 'activity' | 'progress';

export interface SetupAdvance {
  readonly kept: KeptSetupStep;
  /** The coarsest thing that moved, or null when the declaration repeats what is kept. */
  readonly changed: SetupChange | null;
  /** The step that was left and the instant it had begun, when the step changed. */
  readonly left: { readonly step: SetupStep; readonly since: Date } | null;
}

export function firstSetupStep(openedAt: Date): KeptSetupStep {
  return { step: SETUP_STEPS[0], since: openedAt, activity: null, progress: null };
}

/**
 * What a declaration makes of the kept step. Another step replaces it from
 * `at`, whether it comes before or after it in the game's order; the same
 * step keeps its instant and takes the declared activity and progress.
 */
export function advanceSetup(
  kept: KeptSetupStep,
  declared: SetupDeclaration,
  at: Date,
): SetupAdvance {
  const activity = declared.activity ?? null;
  const progress = declared.progress ?? null;

  if (declared.step !== kept.step) {
    return {
      kept: { step: declared.step, since: at, activity, progress },
      changed: 'step',
      left: { step: kept.step, since: kept.since },
    };
  }

  return {
    kept: { ...kept, activity, progress },
    changed: changeWithinStep(kept, activity, progress),
    left: null,
  };
}

function changeWithinStep(
  kept: KeptSetupStep,
  activity: SetupActivity | null,
  progress: SetupProgress | null,
): SetupChange | null {
  if (activity !== kept.activity) return 'activity';
  if (progress !== kept.progress) return 'progress';
  return null;
}

/** What the control plane keeps of one session's setup: whose it is, the order of its game, and the step it is on. */
export interface KeptSetup {
  readonly sessionId: SessionId;
  readonly order: SetupStepOrder;
  readonly step: KeptSetupStep;
}

/** What the screen shows of a setup. No order until the game's own is known. */
export interface ShownSetup {
  readonly step: KeptSetupStep;
  readonly order: SetupStepOrder | null;
}

/**
 * What the screen shows of a session's setup, and null outside the
 * preparation. What is kept counts only when it belongs to this session:
 * nothing erases it, so the next session finds the previous one's there until
 * its own is begun, and shows the first step since its opening meanwhile.
 */
export function shownSetup(
  session: Pick<Session, 'state' | 'sessionId' | 'startedAt'>,
  kept: KeptSetup | null,
): ShownSetup | null {
  if (session.state !== 'PROVISIONING') return null;
  if (session.sessionId === null || session.startedAt === null) return null;
  if (kept !== null && kept.sessionId === session.sessionId) {
    return { step: kept.step, order: kept.order };
  }
  return { step: firstSetupStep(session.startedAt), order: null };
}

/** The rank of the shown step in the order of its game, from one. */
export function setupStepRank(shown: ShownSetup): number {
  // No order is shown with the first step only, whatever the game.
  return shown.order === null ? 1 : shown.order.indexOf(shown.step.step) + 1;
}
