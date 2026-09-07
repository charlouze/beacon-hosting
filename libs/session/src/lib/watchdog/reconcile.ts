import type { Deadline } from '../deadline.js';
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
  /**
   * Null leaves the recorded one. Set only when the watchdog brings a forged
   * deadline back to the bound (§6) — and it never moves `stateSince`, which
   * is what the stuck-state delays are measured on.
   */
  readonly deadline: Deadline | null;
}

const NOTHING: StateCorrection = {
  state: null,
  lastError: null,
  clearFacts: false,
  closeIntents: [],
  events: [],
  deadline: null,
};

interface ClosedMeaning {
  readonly event: (reclamation: Reclamation, costEuros: number) => DomainEvent;
  /** What server/current keeps once the state is back to IDLE. */
  readonly idleReason: string | null;
}

/**
 * What each reason means once its destruction succeeded. A table and not a
 * switch with a default: a reason added tomorrow must not compile until it has
 * an answer here. With a default, a stopping-timeout reclamation would file
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
    event: ({ sessionId, detail }, costEuros) => ({
      type: 'SessionStopped',
      sessionId,
      detail,
      costEuros,
    }),
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
  const clock = { now: () => view.now };
  // Zero when the document is unreadable, or when it reads as IDLE: an idle
  // Session carries no fields to cost, and `estimatedCost` throws rather than
  // guess — reachable now that a pass can follow a teardown seconds later,
  // record/current already IDLE and reserved facts already cleared.
  const costEuros =
    view.session !== null && view.session.state !== 'IDLE'
      ? view.session.estimatedCost(clock, view.settings)
      : 0;

  for (const outcome of outcomes) {
    const { sessionId } = outcome.reclamation;
    if (!outcome.closed) {
      events.push({ type: 'CleanupFailed', sessionId, detail: outcome.error });
      continue;
    }
    closeIntents.push(sessionId);
    events.push(CLOSED[outcome.reclamation.reason].event(outcome.reclamation, costEuros));
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
    return {
      state: 'FAILED',
      lastError: own.error,
      clearFacts: false,
      closeIntents,
      events,
      deadline: null,
    };
  }

  if (own !== undefined) {
    return {
      state: 'IDLE',
      lastError: CLOSED[own.reclamation.reason].idleReason,
      clearFacts: true,
      closeIntents,
      events,
      deadline: null,
    };
  }

  const stillHeld =
    record.sessionId !== null && view.hosted.some((s) => s.sessionId === record.sessionId);

  if (record.state === 'FAILED' && !stillHeld) {
    // Reachable only for a FAILED record naming no session: with one, the
    // failed-retry reclamation has already produced an outcome above.
    // lastError is left null, which keeps the recorded one — the interface
    // still has to say the previous attempt failed.
    return {
      state: 'IDLE',
      lastError: null,
      clearFacts: true,
      closeIntents,
      events,
      deadline: null,
    };
  }

  if (record.state === 'RUNNING' && !stillHeld && record.sessionId !== null) {
    events.push({
      type: 'SessionStopped',
      sessionId: record.sessionId,
      detail: 'the provider holds nothing for this session',
      costEuros,
    });
    return {
      state: 'IDLE',
      lastError: 'the machine disappeared at the provider',
      clearFacts: true,
      closeIntents: closing(closeIntents, record.sessionId),
      events,
      deadline: null,
    };
  }

  if (record.state === 'IDLE' && record.hasReservedFacts) {
    return {
      ...NOTHING,
      clearFacts: true,
      closeIntents: closing(closeIntents, record.sessionId),
      events,
    };
  }

  // Only here: a session about to be destroyed has nothing to clamp, and a
  // record already being corrected says what it becomes. This is the branch
  // where the session is alive and unremarkable — the only one where a forged
  // deadline is worth bringing back.
  const clamped = clamping(view);
  return { ...NOTHING, ...clamped, closeIntents, events: [...events, ...clamped.events] };
}

/**
 * Every route to IDLE closes the intent in the same breath, and these two are
 * routes to IDLE. Left open, the id comes back from `openSessions()` on every
 * later pass, and a resource tagged with it that surfaces afterwards is
 * reclaimed by nobody: `reclamations()` reads the open intent as a session
 * still being born and holds off, `sweepUnclaimed()` sees a session tag and
 * skips it. §4 hangs on this branch — no Scaleway resource outlives its
 * session — and a billed machine nothing will ever destroy is how it breaks.
 */
const closing = (closeIntents: readonly SessionId[], sessionId: SessionId | null): SessionId[] =>
  sessionId === null ? [...closeIntents] : [...closeIntents, sessionId];

/**
 * §6: `deadline - now` above the session duration is brought back to the
 * bound, and the gap is audited. Nothing shows it — §4 has the interface bound
 * on read, so the countdown never walks backwards under the players' eyes.
 */
function clamping(view: WatchdogView): { deadline: Deadline | null; events: DomainEvent[] } {
  const session = view.session;
  if (session === null || session.sessionId === null || session.state === 'IDLE') {
    return { deadline: null, events: [] };
  }
  const clock = { now: () => view.now };
  const clamped = session.deadline.clampedTo(clock, view.settings);
  if (clamped.equals(session.deadline)) return { deadline: null, events: [] };
  return {
    deadline: clamped,
    events: [
      {
        type: 'DeadlineClamped',
        sessionId: session.sessionId,
        detail: `brought back from ${session.deadline.auditHour()} to ${clamped.auditHour()}`,
      },
    ],
  };
}
