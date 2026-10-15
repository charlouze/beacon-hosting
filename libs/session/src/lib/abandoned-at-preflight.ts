import type { PreflightFailure } from './preflight.js';
import type { Session } from './session-aggregate.js';
import type { StateCorrection } from './watchdog/reconcile.js';

/**
 * What `server/current` becomes when a session's preflight check fails. Nothing
 * was created, so nothing is closed and no intent is open.
 */
export function abandonedAtPreflight(session: Session, failure: PreflightFailure): StateCorrection {
  const sessionId = session.sessionId;
  if (sessionId === null) throw new Error('a session without an id has no preflight check');
  const { events } = session.failPreflight(failure);
  return {
    state: 'IDLE',
    lastError: null,
    // What the claim set goes with it, or the next opening could not claim.
    clearFacts: true,
    clearLastError: false,
    closeIntents: [],
    events,
    deadline: null,
    abandonedSetup: { sessionId, cause: failure },
  };
}
