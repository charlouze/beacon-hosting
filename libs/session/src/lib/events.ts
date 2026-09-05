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
   * The system took resources back. A null sessionId means no session claimed
   * them — destroying them still spends money, so it is still audited.
   */
  | { type: 'SessionReclaimed'; sessionId: SessionId | null; detail: string }
  /**
   * A detached volume nothing can be traced to. Nothing was destroyed and
   * nothing will be: this event is the whole action (§6). It always has a null
   * subject — a volume carries no tag, which is exactly the problem.
   */
  | { type: 'ResourceStranded'; sessionId: null; detail: string }
  | { type: 'CleanupFailed'; sessionId: SessionId | null; detail: string }
  | { type: 'ProvisioningFailed'; sessionId: SessionId; detail: string }
  | { type: 'SessionStopped'; sessionId: SessionId; detail: string };
