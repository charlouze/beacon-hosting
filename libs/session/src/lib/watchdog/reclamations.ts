import type { ReclaimReason } from '../events.js';
import type { SessionId } from '../session.js';
import type { WatchdogLimits, WatchdogView } from './view.js';

export interface Reclamation {
  readonly sessionId: SessionId;
  readonly reason: ReclaimReason;
  /** What the provider said it holds, for the audit trail. */
  readonly detail: string;
}

/**
 * What must be destroyed, and why. Pure: it decides from what the provider
 * declares and what the control plane recorded, and never from an id it kept.
 */
export function reclamations(view: WatchdogView, limits: WatchdogLimits): Reclamation[] {
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

  // A stuck state overwrites the entry above when both apply: the narrower
  // reason reads better in the audit, and it is the one that decides what
  // server/current becomes.
  //
  // It is emitted whether or not the provider holds anything. §6 asks for
  // "destruction, then IDLE", and the "then" is the part a session with no
  // resources still needs: close() is idempotent, so the cost of asking is two
  // reads, and the benefit is a state that stops being stuck forever.
  const stuck = stuckReason(view, limits);
  const sessionId = view.server?.sessionId;
  if (stuck !== null && sessionId != null) {
    const held = view.hosted.find((server) => server.sessionId === sessionId);
    bySession.set(sessionId, {
      sessionId,
      reason: stuck,
      detail: held?.summary ?? NOTHING_HELD,
    });
  }

  return [...bySession.values()];
}

const NOTHING_HELD = 'the provider holds nothing for this session';

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
