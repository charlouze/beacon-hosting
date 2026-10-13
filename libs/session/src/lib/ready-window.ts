import type { SessionId } from './session.js';
import type { LastOpening } from './setup.js';

/** How many of a game's last completed setups the ready window is drawn from. */
export const READY_WINDOW_SETUPS = 5;

/** A setup that came into service, and how long it took since the opening of its session. */
export interface CompletedSetup {
  readonly sessionId: SessionId;
  readonly durationMs: number;
}

/** The two instants between which the server should become joinable. */
export interface ReadyWindow {
  readonly from: Date;
  readonly to: Date;
}

const MINUTE_MS = 60_000;

export function completedSetup(sessionId: SessionId, openedAt: Date, at: Date): CompletedSetup {
  return { sessionId, durationMs: at.getTime() - openedAt.getTime() };
}

/**
 * What a game keeps once one more setup completes, oldest first. Null when
 * that session is already kept: its setup completed once.
 */
export function keepCompletedSetup(
  kept: readonly CompletedSetup[],
  completed: CompletedSetup,
): readonly CompletedSetup[] | null {
  if (kept.some((setup) => setup.sessionId === completed.sessionId)) return null;
  return [...kept, completed].slice(-READY_WINDOW_SETUPS);
}

/**
 * The ready window of a session that prepares, from the durations its game
 * kept, oldest first. Null out of a setup, and while the game counts fewer
 * than two completed: one duration is an hour, not a window.
 */
export function readyWindow(
  opening: LastOpening,
  durationsMs: readonly number[],
): ReadyWindow | null {
  if (opening.state !== 'PROVISIONING' || opening.startedAt === null) return null;

  const last = durationsMs.slice(-READY_WINDOW_SETUPS);
  if (last.length < 2) return null;

  const opened = opening.startedAt.getTime();
  const from = opened + Math.min(...last);
  const to = opened + Math.max(...last);
  // Two hours written to the minute: in the same one they would read as a
  // single hour, which a window never is.
  const sameMinute = Math.floor(from / MINUTE_MS) === Math.floor(to / MINUTE_MS);
  return { from: new Date(from), to: new Date(sameMinute ? to + MINUTE_MS : to) };
}
