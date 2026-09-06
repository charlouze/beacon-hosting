import type { Game } from './game.js';
import type { SessionId } from './session.js';
import type { InstanceSize } from './settings.js';

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

export interface OpenServerRequest {
  readonly sessionId: SessionId;
  readonly game: Game;
  readonly size: InstanceSize;
  /**
   * What the machine runs at first boot, rendered by the game catalogue. An
   * opaque payload: the domain carries it and never reads it, exactly as it
   * carries a join point. Naming its format here would put cloud-init — a
   * provider's word — inside a model that talks about sessions.
   */
  readonly bootstrap: string;
}

export interface OpenedServer {
  /** The machine's public address. What a dns record points at, when one does. */
  readonly address: string;
  /** The size actually provisioned, which the default may have decided. */
  readonly size: InstanceSize;
  /**
   * Provider references, written down for the audit and **never read to
   * decide** (§4). Destruction asks the provider by tag, so it depends on no
   * record of ours: a crash between creating a resource and recording its id
   * must not make that resource unfindable and billed.
   *
   * Tranche 1 left this as a decision to take deliberately — "making the port
   * yield provider identifiers must be argued against §4, not adopted out of
   * convenience". It is taken here, and named rather than opaque. A
   * `Record<string, string>` would keep the two words out of this file at the
   * price of an invariant nothing checks: the adapter and the record would
   * agree on two strings through a runtime whitelist, and a typo would be
   * caught, at best, by a test written for the occasion. Two named fields cost
   * two provider words in a type the aggregate never sees, and the compiler
   * keeps both ends honest.
   */
  readonly references: {
    readonly instanceId: string;
    readonly ipId: string;
  };
}

export interface ServerHost {
  /**
   * Open one game server for this session, and answer where it is. Whatever
   * that costs at the provider — an instance and an ip, or an instance, an ip
   * and a volume — is the adapter's business (§4).
   *
   * Not idempotent, and it must not pretend to be: a second call would create
   * a second billed machine. What guards against a double call is the
   * transactional claim of §6, one layer up.
   */
  open(request: OpenServerRequest): Promise<OpenedServer>;

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
