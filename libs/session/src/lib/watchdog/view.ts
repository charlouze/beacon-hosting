import type { HostedServer } from '../ports.js';
import type { Session } from '../session-aggregate.js';
import type { SessionId, SessionState } from '../session.js';
import type { SessionSettings } from '../settings.js';

/** server/current, as the watchdog reads it. */
export interface ServerRecord {
  /**
   * Null when the document says nothing this vocabulary recognises. The
   * watchdog then decides nothing from the record — but the tag-based
   * reclamation still runs, and it never needed the record anyway.
   */
  readonly state: SessionState | null;
  readonly sessionId: SessionId | null;
  /** When the current state began. Null on a record seeded before the field. */
  readonly stateSince: Date | null;
  /**
   * Whether any reserved field still holds something. A boolean and not the
   * fields themselves: §4 keeps the reserved fields out of the domain, and
   * naming them here would mean adding one the day the spec adds one — which
   * is exactly what happened to `joinInfo`. The adapter owns the list.
   */
  readonly hasReservedFacts: boolean;
}

export interface WatchdogView {
  readonly now: Date;
  /** Null when server/current does not exist yet. */
  readonly server: ServerRecord | null;
  readonly hosted: readonly HostedServer[];
  /** Sessions whose provisioning intent is written and not yet closed. */
  readonly openSessions: readonly SessionId[];
  /**
   * Volumes a previous pass already announced stranded. An input like any
   * other, so that deciding stays a pure function of the world as read: what
   * is stranded *now* is a state, and reading it belongs to whoever stores it.
   */
  readonly alreadyAnnounced: readonly string[];
  /**
   * The same document as `server`, read as the domain reads it. Two views and
   * not one, by design (§4): destroying needs no business rule and must work
   * on a record it cannot parse, while a deadline and a cost need the model.
   * Null when the document says nothing this vocabulary recognises.
   */
  readonly session: Session | null;
  /** From `config/settings`, so the bound is the deployed one, never a guess. */
  readonly settings: SessionSettings;
}

export interface WatchdogLimits {
  readonly provisioningTimeoutMs: number;
  readonly stoppingTimeoutMs: number;
  /**
   * §6: a deadline exceeded by more than two minutes. The grace is not
   * politeness — the watchdog passes every five minutes, and a deadline that
   * fell thirty seconds ago is a normal system, not a stuck one.
   */
  readonly deadlineGraceMs: number;
  /**
   * How long a pass may go without asking the provider anything, while the
   * record says nothing is open. Not a budget decision — §11 makes the started
   * hour due on each resource, so a stray reclaimed at thirty minutes costs
   * exactly what it would at five — but an ecological one: five api calls
   * every five minutes, 8 640 times a month, to find nothing.
   *
   * **Thirty minutes is a ceiling, not a preference.** At sixty, a single
   * missed pass pushes a stray into a second billed hour, and the property
   * that makes this safe stops holding.
   */
  readonly quietSweepIntervalMs: number;
}

/**
 * §6 of the spec. They live here rather than in config/settings because
 * nothing displays them and nobody tunes them; the day an admin does, they
 * move and this constant becomes the fallback.
 */
export const DEFAULT_LIMITS: WatchdogLimits = {
  provisioningTimeoutMs: 15 * 60_000,
  stoppingTimeoutMs: 10 * 60_000,
  deadlineGraceMs: 2 * 60_000,
  quietSweepIntervalMs: 30 * 60_000,
};
