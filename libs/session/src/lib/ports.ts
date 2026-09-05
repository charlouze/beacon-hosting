import type { SessionId } from './session.js';

export interface Clock {
  now(): Date;
}

/**
 * One game server as the provider holds it. How many resources that is — an
 * instance, an ip, sometimes a volume — depends on the size, and the domain
 * never counts them. Only the adapter does.
 */
export interface HostedServer {
  readonly sessionId: SessionId;
  /** Provider wording, for the audit trail only — never for a decision. */
  readonly summary: string;
}

/**
 * What a pass over the unclaimed found. Three lists and not one: destroying
 * spends money and must be auditable, reporting is an action in its own right,
 * and a failure on one resource must not erase what the previous one did.
 */
export interface UnclaimedSweep {
  /** Gone, in provider wording. Each entry is money that stopped being spent. */
  readonly destroyed: readonly string[];
  /**
   * Found, and deliberately left alone: volumes whose origin nothing proves.
   * §6 — a detached volume carries no tag of ours, and deleting someone else's
   * disk is not a mistake this component may make.
   */
  readonly stranded: readonly string[];
  /** One per resource that refused, so the pass can continue past it. */
  readonly errors: readonly string[];
}

export interface ServerHost {
  /** Every game server this system owns, one entry per session tag found. */
  list(): Promise<HostedServer[]>;

  /**
   * Destroy every resource tagged for this session, whatever it is and in
   * whatever order the provider requires. Idempotent: closing a session the
   * provider holds nothing for succeeds and does nothing — which is what lets
   * the watchdog ground a stuck state without first knowing whether anything
   * is left to destroy.
   *
   * It takes a session and not a list of resources on purpose. A crash between
   * creating a resource and recording its id would leave that resource
   * unfindable and billed; asking the provider by tag makes destruction depend
   * on no record of ours.
   */
  close(sessionId: SessionId): Promise<void>;

  /**
   * One pass over what this system owns but no session claims: destroy the
   * resources carrying the ownership tag and no session tag, report the
   * volumes nothing can be proven about, and survive a refusal on any of them.
   */
  sweepUnclaimed(): Promise<UnclaimedSweep>;
}
