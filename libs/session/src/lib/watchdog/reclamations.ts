import type { ReclaimReason } from '../events.js';
import type { Session } from '../session-aggregate.js';
import type { SessionId } from '../session.js';
import type { WatchdogLimits, WatchdogView } from './view.js';

export interface Reclamation {
  readonly sessionId: SessionId;
  readonly reason: ReclaimReason;
  /** What the provider said it holds, for the audit trail. */
  readonly detail: string;
}

/**
 * A session whose closing time has passed. §6: a deadline finishes a
 * session, it does not seize its resources — the watchdog's whole answer is
 * to write STOPPING, and the clean shutdown of §6 carries the rest.
 */
export interface Expiration {
  readonly sessionId: SessionId;
  readonly detail: string;
}

export interface WatchdogDecision {
  /** What must be destroyed, and why. */
  readonly destroy: readonly Reclamation[];
  /** What must be asked to stop, its closing time behind it. */
  readonly expired: readonly Expiration[];
}

/**
 * What the watchdog must do about the world it just read. Pure: it decides
 * from what the provider declares and what the control plane recorded, and
 * never from an id it kept.
 *
 * One parcours, one return, two named lists — never a single list a flag
 * would have to be read to tell apart. A session never appears in both:
 * destroying and asking to stop are different verbs, and the caller must not
 * have to interpret which one it received.
 */
export function reclamations(view: WatchdogView, limits: WatchdogLimits): WatchdogDecision {
  const open = new Set(view.openSessions);
  const bySession = new Map<SessionId, Reclamation>();

  for (const server of view.hosted) {
    if (!open.has(server.sessionId)) {
      bySession.set(server.sessionId, {
        sessionId: server.sessionId,
        reason: 'no-open-session',
        detail: server.summary,
      });
    }
  }

  const expired: Expiration[] = [];
  const sessionId = view.server?.sessionId;
  const expiring = expiredSession(view, limits);

  if (sessionId != null && expiring !== null) {
    // Overwrites whatever the loop above set for the same id: a session past
    // its own closing time is finished, not unexplained, and it cannot owe
    // both verbs at once.
    //
    // The trade this is the other half of: a hosted session whose intent is
    // already closed and whose deadline has passed is asked to stop rather
    // than destroyed on sight, so it can go on billing for as long as
    // `stoppingTimeoutMs` after the grace — up to about fifteen minutes on
    // the defaults, not the whole life of a stray. What buys that wait is a
    // save: STOPPING is what makes `pre-shutdown` mean anything (§6 étape
    // 2-3), and destroying here instead would end the session on whatever
    // the last cadence push happened to catch. The stopping-timeout net in
    // `stuckReason` is what bounds the wait: an agent that never reports is
    // still reaped, at that ceiling, exactly as any other stuck STOPPING is.
    bySession.delete(sessionId);
    expired.push({ sessionId, detail: `closing time was ${expiring.deadline.auditHour()}` });
  } else {
    // A stuck state overwrites the entry above when both apply: the narrower
    // reason reads better in the audit, and it is the one that decides what
    // server/current becomes.
    //
    // It is emitted whether or not the provider holds anything. §6 asks for
    // "destruction, then IDLE", and the "then" is the part a session with no
    // resources still needs: close() is idempotent, so the cost of asking is
    // two reads, and the benefit is a state that stops being stuck forever.
    const stuck = stuckReason(view, limits);
    if (stuck !== null && sessionId != null) {
      const held = view.hosted.find((server) => server.sessionId === sessionId);
      bySession.set(sessionId, {
        sessionId,
        reason: stuck,
        detail: held?.summary ?? NOTHING_HELD,
      });
    }
  }

  return { destroy: [...bySession.values()], expired };
}

const NOTHING_HELD = 'the provider holds nothing for this session';

/**
 * RUNNING at both ends, and the closing time passed by more than the grace
 * (§6). Checked ahead of `stuckReason` because a RUNNING session past its
 * deadline is not stuck — it is finished, and the audit must say so with the
 * right word.
 */
function expiredSession(view: WatchdogView, limits: WatchdogLimits): Session | null {
  const session = view.session;
  if (view.server?.state !== 'RUNNING' || session === null || session.state !== 'RUNNING') {
    return null;
  }
  return session.deadline.isPastBy({ now: () => view.now }, limits.deadlineGraceMs)
    ? session
    : null;
}

function stuckReason(view: WatchdogView, limits: WatchdogLimits): ReclaimReason | null {
  const record = view.server;
  if (record === null) return null;
  if (record.state === 'FAILED') return 'failed-retry';
  if (record.stateSince === null) return null;

  const elapsed = view.now.getTime() - record.stateSince.getTime();
  if (record.state === 'PROVISIONING' && elapsed > limits.provisioningTimeoutMs) {
    return 'provisioning-timeout';
  }
  if (record.state === 'STOPPING' && elapsed > limits.stoppingTimeoutMs) {
    return 'stopping-timeout';
  }
  return null;
}
