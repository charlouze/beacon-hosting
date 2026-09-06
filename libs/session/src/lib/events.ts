import type { SessionId } from './session.js';

export type ReclaimReason =
  /** Nothing open at the control plane explains these resources. */
  | 'no-open-session'
  | 'provisioning-timeout'
  | 'stopping-timeout'
  /** The record already says FAILED: try the destruction again. */
  | 'failed-retry';

export type DomainEvent =
  /**
   * Written by the browser, in the same write as the passage to PROVISIONING.
   * It is the only place that keeps the display name of whoever opened the
   * evening: `members` is read by admins only (§5), so the audit trail is
   * where a name may travel.
   */
  | { type: 'SessionStarted'; sessionId: SessionId; detail: string }
  | { type: 'SessionExtended'; sessionId: SessionId; detail: string }
  /**
   * Written by the browser in the same write as STOPPING. It is the only
   * record of *who* cut the evening — without it, ending someone else's
   * session would be the one anonymous gesture of the system (§4).
   */
  | { type: 'SessionStopRequested'; sessionId: SessionId; detail: string }
  /**
   * A deadline was forged past the bound and brought back (§6). It is audited
   * and never shown: the interface already clamps on read, so the countdown
   * does not walk backwards under the players' eyes (§4).
   */
  | { type: 'DeadlineClamped'; sessionId: SessionId; detail: string }
  /**
   * The system took resources back. A null sessionId means no session claimed
   * them — destroying them still spends money, so it is still audited.
   */
  | { type: 'SessionReclaimed'; sessionId: SessionId | null; detail: string }
  /**
   * A detached volume nothing can be traced to. Nothing was destroyed and
   * nothing will be: announcing is the whole action (§6), and it happens once,
   * when the volume appears — what is stranded now is a state, and it is
   * `health/watchdog` that holds it. It always has a null subject — a volume
   * carries no tag, which is exactly the problem.
   */
  | { type: 'ResourceStranded'; sessionId: null; detail: string }
  | { type: 'CleanupFailed'; sessionId: SessionId | null; detail: string }
  | { type: 'ProvisioningFailed'; sessionId: SessionId; detail: string }
  | { type: 'SessionStopped'; sessionId: SessionId; detail: string };
