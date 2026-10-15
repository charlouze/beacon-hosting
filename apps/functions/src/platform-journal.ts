import type { Game, SessionId, SetupActivity, SetupStep, WorldId } from '@beacon/session';
import { sanitizeLastError } from './sanitize-last-error.js';

/** Where `apps/functions` received the failure it journals. */
export type FailureSource =
  | 'watchdog.close'
  | 'watchdog.sweep'
  | 'provisioning.setup'
  | 'provisioning.begin'
  | 'provisioning.preflight'
  | 'provisioning.recordPublished'
  | 'provisioning.cleanup'
  | 'agentReport.dns'
  | 'agentReport.save'
  | 'agentReport.cleanup'
  | 'agentReport.machine'
  | 'agentReport.setup'
  | 'agentReport.completedSetup';

export interface JournalledFailure {
  readonly source: FailureSource;
  /** Null when no session explains the failure, as in a sweep. */
  readonly sessionId: SessionId | null;
  /** The failure as it was received: nothing bounded, nothing masked. */
  readonly error: string;
  /**
   * The step a setup had reached when its game server declared it could not
   * finish, and null when none is kept for its session. Absent on every other
   * failure.
   */
  readonly step?: SetupStep | null;
  /**
   * The last lines the game printed, as the game server sent them. This
   * journal is the one place they are written.
   */
  readonly gameLog?: string;
}

/** A setup that moved to another step, or to another activity inside its step. */
export interface JournalledSetupChange {
  readonly sessionId: SessionId;
  readonly worldId: WorldId;
  readonly game: Game;
  readonly step: SetupStep;
  readonly activity: SetupActivity | null;
  /** The step that was left and the time spent in it. Null when only the activity moved. */
  readonly left: { readonly step: SetupStep; readonly elapsedMs: number } | null;
}

/** The fields a report carried and the frontier discarded, by name and never by value. */
export interface JournalledDiscard {
  readonly sessionId: SessionId;
  readonly fields: readonly string[];
}

/**
 * The platform's own log, which only the operator reads. It is the one place
 * that keeps a failure whole: an event detail and `lastError` are read by
 * members, and what a provider or a game server answers can carry what the
 * system entrusted to it.
 */
export interface PlatformJournal {
  failure(entry: JournalledFailure): void;
  setupChanged(entry: JournalledSetupChange): void;
  discarded(entry: JournalledDiscard): void;
}

/**
 * The gate every failure crosses before it reaches the domain or a document:
 * the whole text goes to the platform journal, and what comes back is what a
 * member may read. Called where the failure is received, so that no path
 * downstream can copy the original.
 */
export function expunged(
  journal: PlatformJournal,
  source: FailureSource,
  sessionId: SessionId | null,
  cause: unknown,
): string {
  const error = String(cause);
  journal.failure({ source, sessionId, error });
  return sanitizeLastError(error);
}
