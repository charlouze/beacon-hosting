import type { Session } from './session-aggregate.js';
import type { StateCorrection } from './watchdog/reconcile.js';

/**
 * What `server/current` becomes when a session closed before any server ends.
 * The Function and the watchdog both write it, and it is written here once.
 */
export function endedWithoutServer(session: Session): StateCorrection {
  const { events } = session.endWithoutServer();
  return {
    state: 'IDLE',
    lastError: null,
    // What the claim set goes with it, or the next opening could not claim.
    clearFacts: true,
    clearLastError: true,
    closeIntents: [],
    events,
    deadline: null,
    abandonedSetup: null,
  };
}
