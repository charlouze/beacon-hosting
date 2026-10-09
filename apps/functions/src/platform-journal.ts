import type { SessionId } from '@beacon/session';
import { sanitizeLastError } from './sanitize-last-error.js';

/** Where `apps/functions` received the failure it journals. */
export type FailureSource =
  | 'watchdog.close'
  | 'watchdog.sweep'
  | 'provisioning.setup'
  | 'provisioning.cleanup'
  | 'agentReport.dns'
  | 'agentReport.save'
  | 'agentReport.cleanup'
  | 'agentReport.machine';

export interface JournalledFailure {
  readonly source: FailureSource;
  /** Null when no session explains the failure, as in a sweep. */
  readonly sessionId: SessionId | null;
  /** The failure as it was received: nothing bounded, nothing masked. */
  readonly error: string;
}

/**
 * The platform's own log, which only the operator reads. It is the one place
 * that keeps a failure whole: an event detail and `lastError` are read by
 * members, and what a provider or a game server answers can carry what the
 * system entrusted to it.
 */
export interface PlatformJournal {
  failure(entry: JournalledFailure): void;
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
