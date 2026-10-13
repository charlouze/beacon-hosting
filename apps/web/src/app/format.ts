import {
  SETUP_STEPS,
  setupStepRank,
  type Game,
  type SessionState,
  type SetupActivity,
  type SetupStep,
  type ShownSetup,
  type World,
} from '@beacon/session';

/**
 * How the screen renders what it is given. Pure functions, no Angular, and no
 * reading of `Date.now()`: each one is handed the instant it needs, which is
 * what lets every test of this screen run on an injected clock rather than on
 * the wall clock.
 */

/**
 * How long a machine takes to answer, measured and not guessed: 4 min 49 s
 * then 7 min 58 s on the same size in the same zone, an hour apart
 * (`probe/RESULTS.md`, §S). Its own conclusion is written as a constraint —
 * a single announced hour would be three minutes wrong one time in two, and an
 * hour contradicted releases nobody.
 *
 * It lives here and not in `config/settings` on purpose: an admin who could
 * change it would be editing a measurement. The day real evenings narrow the
 * window, this line is the one that moves — and two sessions are not enough to
 * narrow it.
 */
export const BOOT_WINDOW_MS: readonly [number, number] = [300_000, 480_000];

const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * Two pieces and not one string: only the seconds are red, and a component
 * that had to slice text apart to colour it would be doing typography with
 * `substring`.
 */
export function splitCountdown(remainingMs: number): {
  hoursMinutes: string;
  seconds: string;
} {
  // Zero and never a negative: a deadline that has passed has no evening left
  // to count, and a countdown that walks past zero says the opposite.
  const total = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  // The hours are not padded: this is a duration, not a clock face.
  return { hoursMinutes: `${hours}:${pad(minutes)}`, seconds: `:${pad(total % 60)}` };
}

/**
 * A game's name as it is written on its own box. The code carries the
 * lowercase token the document holds; nobody writes their game that way.
 */
export function gameLabel(game: Game): string {
  return game.charAt(0).toUpperCase() + game.slice(1);
}

/** `HH:MM`, in the reader's own zone — a departure hour is read where it is read. */
export function hourLabel(instant: Date): string {
  return `${pad(instant.getHours())}:${pad(instant.getMinutes())}`;
}

/** Two decimals always: €0.1 is not a price, and money that ragged stops lining up. */
export function euroLabel(euros: number): string {
  return `€${euros.toFixed(2)}`;
}

/** The two hours between which the server should answer, opened from `stateSince`. */
export function readyWindow(stateSince: Date): { from: string; to: string } {
  const [earliest, latest] = BOOT_WINDOW_MS;
  return {
    from: hourLabel(new Date(stateSince.getTime() + earliest)),
    to: hourLabel(new Date(stateSince.getTime() + latest)),
  };
}

/**
 * The four steps of a setup, in the board's own words. A record and not a
 * switch: a step added to the domain without its words here does not compile.
 */
export function stepLabel(step: SetupStep): string {
  const steps: Record<SetupStep, string> = {
    waking: 'Waking the server',
    'fetching-game': 'Getting the game',
    'restoring-world': 'Bringing your world back',
    'starting-game': 'Starting the game',
  };
  return steps[step];
}

export function activityLabel(activity: SetupActivity): string {
  const activities: Record<SetupActivity, string> = {
    downloading: 'Downloading',
    unpacking: 'Unpacking',
  };
  return activities[activity];
}

/** Where an abandoned setup stopped, in the board's own words. */
export interface StoppedAt {
  readonly at: string;
  readonly rank: number;
  readonly total: number;
  readonly name: string;
}

/**
 * Null for a setup under way and for none at all. The step alone: what it was
 * doing when it stopped, and how far it had got, is not where it stopped.
 */
export function stoppedAt(shown: ShownSetup | null): StoppedAt | null {
  if (shown === null || shown.abandonedAt === null) return null;
  return {
    at: hourLabel(shown.abandonedAt),
    rank: setupStepRank(shown),
    total: SETUP_STEPS.length,
    name: stepLabel(shown.step.step),
  };
}

export type Tone = 'live' | 'off' | 'warn';

export type Announced = { readonly label: string; readonly tone: Tone };

export function stateLabel(state: SessionState | 'unreadable'): Announced {
  const states: Record<SessionState | 'unreadable', Announced> = {
    IDLE: { label: 'Out of service', tone: 'off' },
    PROVISIONING: { label: 'Preparing', tone: 'off' },
    RUNNING: { label: 'In service', tone: 'live' },
    STOPPING: { label: 'Closing', tone: 'off' },
    FAILED: { label: 'Not cleared', tone: 'warn' },
    unreadable: { label: 'Unknown', tone: 'warn' },
  };
  return states[state];
}

export function inviteLink(origin: string, world: World): string {
  return `${origin}/join/${world.worldId}/${world.inviteCode}`;
}
