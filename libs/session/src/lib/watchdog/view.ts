import type { HostedServer } from '../ports.js';
import type { SessionId, SessionState } from '../session.js';

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
}

export interface WatchdogLimits {
  readonly provisioningTimeoutMs: number;
  readonly stoppingTimeoutMs: number;
}

/**
 * §6 of the spec. They live here rather than in config/settings because
 * nothing displays them and nobody tunes them; the day an admin does, they
 * move and this constant becomes the fallback.
 */
export const DEFAULT_LIMITS: WatchdogLimits = {
  provisioningTimeoutMs: 15 * 60_000,
  stoppingTimeoutMs: 10 * 60_000,
};
