import type { DomainEvent, ReclaimReason } from '../events.js';
import type { UnclaimedSweep } from '../ports.js';
import type { SessionId, SessionState } from '../session.js';
import type { Reclamation } from './reclamations.js';
import type { WatchdogView } from './view.js';

export type ReclaimOutcome =
  | { readonly reclamation: Reclamation; readonly closed: true }
  | { readonly reclamation: Reclamation; readonly closed: false; readonly error: string };

export interface StateCorrection {
  /** Null leaves server/current's state alone. */
  readonly state: SessionState | null;
  /**
   * Null leaves the recorded one alone; it never clears it. A previous failure
   * has to stay visible until something replaces it — the interface says "the
   * last attempt failed", and only a next attempt can answer that.
   */
  readonly lastError: string | null;
  /**
   * Whether every reserved field but `lastError` must be emptied — §6 says
   * "les champs réservés sont remis à vide", and it means all of them. Which
   * fields those are is the adapter's business, not the domain's.
   */
  readonly clearFacts: boolean;
  /** Sessions whose provisioning intent must be closed. */
  readonly closeIntents: readonly SessionId[];
  readonly events: readonly DomainEvent[];
}

const NOTHING: StateCorrection = {
  state: null,
  lastError: null,
  clearFacts: false,
  closeIntents: [],
  events: [],
};

interface ClosedMeaning {
  readonly event: (reclamation: Reclamation) => DomainEvent;
  /** What server/current keeps once the state is back to IDLE. */
  readonly idleReason: string | null;
}

/**
 * What each reason means once its destruction succeeded. A table and not a
 * switch with a default: a reason added tomorrow must not compile until it has
 * an answer here. With a default, a deadline-exceeded reclamation would file
 * itself as SessionReclaimed and lose the session cost §11 hangs on it, and
 * nothing at all would say so.
 */
const CLOSED: Record<ReclaimReason, ClosedMeaning> = {
  'no-open-session': {
    event: ({ sessionId, detail }) => ({ type: 'SessionReclaimed', sessionId, detail }),
    idleReason: null,
  },
  'failed-retry': {
    event: ({ sessionId, detail }) => ({ type: 'SessionReclaimed', sessionId, detail }),
    idleReason: null,
  },
  'provisioning-timeout': {
    event: ({ sessionId, detail }) => ({ type: 'ProvisioningFailed', sessionId, detail }),
    idleReason: 'provisioning did not finish in time',
  },
  'stopping-timeout': {
    // The session did end, just without its agent saying so. Tranche 2 adds
    // the estimated cost this event carries in §11; there is no tariff yet.
    event: ({ sessionId, detail }) => ({ type: 'SessionStopped', sessionId, detail }),
    idleReason: 'stopped without the agent reporting',
  },
};

/**
 * What server/current must become, once the destructions have been tried.
 *
 * It never concludes from `view.hosted` alone that a machine survives: that
 * listing predates the closes, so a session still in it may be gone. Survival
 * is `hosted` for a session nothing was tried on.
 */
export function reconcile(
  view: WatchdogView,
  outcomes: readonly ReclaimOutcome[],
  sweep: UnclaimedSweep,
): StateCorrection {
  const events: DomainEvent[] = [];
  const closeIntents: SessionId[] = [];

  for (const outcome of outcomes) {
    const { sessionId } = outcome.reclamation;
    if (!outcome.closed) {
      events.push({ type: 'CleanupFailed', sessionId, detail: outcome.error });
      continue;
    }
    closeIntents.push(sessionId);
    events.push(CLOSED[outcome.reclamation.reason].event(outcome.reclamation));
  }

  // Destroyed, failed and stranded are three independent facts, not a
  // three-way choice: a sweep that destroyed one resource and was refused on
  // the next has to say both, or the money that stopped being spent is never
  // audited anywhere.
  for (const error of sweep.errors) {
    events.push({ type: 'CleanupFailed', sessionId: null, detail: error });
  }
  if (sweep.destroyed.length > 0) {
    events.push({ type: 'SessionReclaimed', sessionId: null, detail: sweep.destroyed.join(', ') });
  }
  // Only what has just appeared. Nothing destroys a stranded volume, so it
  // comes back in every sweep; §4 makes an event a fact in the past, and a
  // fact that repeats itself every five minutes drowns the journal §11 reads.
  const alreadyAnnounced = new Set(view.alreadyAnnounced);
  for (const detail of sweep.stranded) {
    if (alreadyAnnounced.has(detail)) continue;
    events.push({ type: 'ResourceStranded', sessionId: null, detail });
  }

  const record = view.server;
  if (record === null) {
    return { ...NOTHING, closeIntents, events };
  }

  const own = outcomes.find((o) => o.reclamation.sessionId === record.sessionId);

  if (own !== undefined && !own.closed) {
    // The one case FAILED exists for: a cleanup we could not guarantee. The
    // facts stay so the next pass still knows what it was looking at.
    //
    // Never from IDLE, though: §5 draws no arrow there, and a record that
    // already holds nothing has nothing to add to the event above.
    if (record.state === 'IDLE') return { ...NOTHING, closeIntents, events };
    return { state: 'FAILED', lastError: own.error, clearFacts: false, closeIntents, events };
  }

  if (own !== undefined) {
    return {
      state: 'IDLE',
      lastError: CLOSED[own.reclamation.reason].idleReason,
      clearFacts: true,
      closeIntents,
      events,
    };
  }

  const stillHeld =
    record.sessionId !== null && view.hosted.some((s) => s.sessionId === record.sessionId);

  if (record.state === 'FAILED' && !stillHeld) {
    // Reachable only for a FAILED record naming no session: with one, the
    // failed-retry reclamation has already produced an outcome above.
    // lastError is left null, which keeps the recorded one — the interface
    // still has to say the previous attempt failed.
    return { state: 'IDLE', lastError: null, clearFacts: true, closeIntents, events };
  }

  if (record.state === 'RUNNING' && !stillHeld && record.sessionId !== null) {
    events.push({
      type: 'SessionStopped',
      sessionId: record.sessionId,
      detail: 'the provider holds nothing for this session',
    });
    return {
      state: 'IDLE',
      lastError: 'the machine disappeared at the provider',
      clearFacts: true,
      closeIntents,
      events,
    };
  }

  if (record.state === 'IDLE' && record.hasReservedFacts) {
    return { ...NOTHING, clearFacts: true, closeIntents, events };
  }

  return { ...NOTHING, closeIntents, events };
}
