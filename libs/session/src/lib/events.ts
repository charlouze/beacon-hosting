import type { SessionId } from './session.js';

export type ReclaimReason =
  /** Nothing open at the control plane explains these resources. */
  | 'no-open-session'
  | 'provisioning-timeout'
  | 'stopping-timeout'
  /** The record already says FAILED: try the destruction again. */
  | 'failed-retry'
  /** The closing time passed and nobody extended (§6). */
  | 'deadline-exceeded';

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
  /**
   * The dns record could not be pointed. §8: the session is **not**
   * interrupted — the join point already carries the raw address as its
   * fallback, and the first real session proved the fallback works. It is a
   * fact to file, not a reason to destroy a working machine.
   *
   * It exists because `ProvisioningFailed` was doing this job and lying about
   * it: a session that becomes RUNNING one second later did not fail to
   * provision, and a journal that says otherwise is read by a human at the one
   * moment they need it to be true.
   */
  | { type: 'DnsUpdateFailed'; sessionId: SessionId; detail: string }
  /**
   * The machine declared something the control plane can contradict. §6: the
   * address it reports is corroboration and is never followed — the function
   * points dns at the address it reserved itself, or a compromised vm would
   * aim the record wherever it liked. The disagreement is worth a line.
   */
  | { type: 'AgentContradicted'; sessionId: SessionId; detail: string }
  /**
   * §8, third defense: a save whose size falls under the floor is not
   * recorded, and the refusal is journalled. It is the last of the three lines
   * and the only one written in TypeScript — the real protection is on the
   * machine, in the companion that refuses to push it at all.
   */
  | { type: 'SaveRefused'; sessionId: SessionId; detail: string }
  /**
   * The machine reported `failed` outside PROVISIONING — a crashed game
   * process, a failed push, whatever it could not recover from on its own.
   * `ProvisioningFailed` is reserved for a provisioning that never became
   * RUNNING; a session already running did not fail to provision, and filing
   * it as one is the exact dishonesty `DnsUpdateFailed` exists to repair.
   */
  | { type: 'AgentReportedFailure'; sessionId: SessionId; detail: string }
  | {
      type: 'SessionStopped';
      sessionId: SessionId;
      detail: string;
      /**
       * §11: the one event that carries a figure, and what the month is
       * summed from. Zero when no readable session explains the stop — an
       * honest hole beats an invented number on the only thing this product
       * says about money.
       */
      costEuros: number;
    };
