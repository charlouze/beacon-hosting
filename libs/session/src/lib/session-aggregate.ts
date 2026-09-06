import { Deadline } from './deadline.js';
import type { DomainEvent } from './events.js';
import type { Game } from './game.js';
import type { Clock } from './ports.js';
import type { SessionId, SessionState } from './session.js';
import type { InstanceSize, SessionSettings } from './settings.js';

/** Who acts. The name travels because a journal of uids does not read (§5). */
export interface Actor {
  readonly uid: string;
  readonly name: string;
}

/**
 * A session as the domain holds it. The reserved facts of §5 are absent by
 * construction — `instanceId`, `ipId`, `ip`, `provisionClaimedAt`,
 * `lastError` are infrastructure, and only the watchdog confronts them with
 * what `ServerHost` declares.
 *
 * `hasJoinInfo` and not the join point itself: the domain knows whether it
 * exists — that is what `RUNNING` means (§4) — and never what it contains.
 */
export interface SessionFields {
  readonly state: SessionState;
  readonly sessionId: SessionId;
  readonly game: Game;
  readonly startedBy: string;
  readonly startedAt: Date;
  readonly deadline: Deadline;
  /**
   * Null until something records one. §5 reserves this field to an admin, so
   * an ordinary member's opening must not write it at all — the function
   * applies the default from `config/settings` and publishes the size that was
   * actually provisioned. Falling back to a compiled constant here would let
   * the bundle's idea of the default quietly win over the deployed one.
   */
  readonly instanceSize: InstanceSize | null;
  readonly hasJoinInfo: boolean;
}

/** A decision, and the facts it wants written down. Never one without the other. */
export interface SessionDecision {
  readonly session: Session;
  readonly events: readonly DomainEvent[];
}

export interface OpeningRequest {
  readonly sessionId: SessionId;
  readonly game: Game;
  readonly actor: Actor;
  /** Admin only; the function applies the default when it is absent (§5). */
  readonly instanceSize?: InstanceSize;
}

/**
 * The aggregate root, and the only door into the model (§4).
 *
 * It is a shared decision core and not a guard: the browser runs it to know
 * what to offer, the functions for what they decide alone, the watchdog to
 * see what drifted. Which is why every refusal here is a `throw` and not a
 * silent correction — a caller that ignores `canExtend` has a bug, and the
 * real barrier against a forged write is the watchdog, five minutes later.
 */
export class Session {
  private constructor(private readonly fields: SessionFields | null) {}

  /** No session: `server/current` seeded as IDLE, with everything null. */
  static idle(): Session {
    return new Session(null);
  }

  static from(fields: SessionFields): Session {
    return new Session(fields);
  }

  static opening(
    request: OpeningRequest,
    clock: Clock,
    settings: SessionSettings,
  ): SessionDecision {
    const session = new Session({
      state: 'PROVISIONING',
      sessionId: request.sessionId,
      game: request.game,
      startedBy: request.actor.uid,
      startedAt: clock.now(),
      deadline: Deadline.opening(clock, settings),
      // Only what was asked for. An absent size is an ordinary member opening
      // a session, and §5 says the field is not theirs to write.
      instanceSize: request.instanceSize ?? null,
      hasJoinInfo: false,
    });
    return {
      session,
      events: [
        {
          type: 'SessionStarted',
          sessionId: request.sessionId,
          detail: `${request.actor.name} opened ${request.game}`,
        },
      ],
    };
  }

  get state(): SessionState {
    return this.fields?.state ?? 'IDLE';
  }

  get sessionId(): SessionId | null {
    return this.fields?.sessionId ?? null;
  }

  get game(): Game | null {
    return this.fields?.game ?? null;
  }

  get startedBy(): string {
    return this.required().startedBy;
  }

  get instanceSize(): InstanceSize | null {
    return this.fields?.instanceSize ?? null;
  }

  get deadline(): Deadline {
    return this.required().deadline;
  }

  canExtend(clock: Clock, settings: SessionSettings): boolean {
    return (
      this.fields !== null &&
      this.fields.state === 'RUNNING' &&
      this.fields.deadline.isWithinExtensionWindow(clock, settings)
    );
  }

  extend(actor: Actor, clock: Clock, settings: SessionSettings): SessionDecision {
    const fields = this.required();
    if (!this.canExtend(clock, settings)) {
      throw new Error(
        `cannot extend a ${fields.state} session outside its extension window`,
      );
    }
    const deadline = fields.deadline.extended(settings);
    return {
      session: new Session({ ...fields, deadline }),
      events: [
        {
          type: 'SessionExtended',
          sessionId: fields.sessionId,
          detail: `${actor.name} extended to ${hourOf(deadline)}`,
        },
      ],
    };
  }

  canRequestStop(): boolean {
    return this.fields?.state === 'RUNNING' || this.fields?.state === 'PROVISIONING';
  }

  requestStop(actor: Actor, clock: Clock): SessionDecision {
    const fields = this.required();
    if (!this.canRequestStop()) {
      throw new Error(`cannot stop a ${fields.state} session`);
    }
    // `clock` is taken and not used to compute: the instant of the passage is
    // `stateSince`, and it is `request.time` at the record's frontier (§5) so
    // that no client can backdate it. Taking it here keeps every decision of
    // this class a function of the same clock, which is what the tests pin.
    void clock;
    return {
      session: new Session({ ...fields, state: 'STOPPING' }),
      events: [
        {
          type: 'SessionStopRequested',
          sessionId: fields.sessionId,
          detail: `${actor.name} asked to stop`,
        },
      ],
    };
  }

  /**
   * The bound applied on read. Without it a forged deadline, once the watchdog
   * brings it back, would make the countdown jump backwards on a screen whose
   * whole principle is that the closing time is an announced fact (§4).
   */
  displayedDeadline(clock: Clock, settings: SessionSettings): Deadline {
    return this.required().deadline.clampedTo(clock, settings);
  }

  /**
   * §11: the started hour is due, and each resource carries its own 60-minute
   * minimum — so a rate already sums instance, disk and ip. An unknown size
   * charges zero rather than guessing: a made-up figure on the only number
   * this product shows about money would be worse than none.
   */
  estimatedCost(clock: Clock, settings: SessionSettings): number {
    const fields = this.required();
    if (fields.instanceSize === null) return 0;
    const rate = settings.tariffPerHour[fields.instanceSize];
    if (rate === undefined) return 0;
    const elapsedMs = clock.now().getTime() - fields.startedAt.getTime();
    const billedHours = Math.max(1, Math.ceil(elapsedMs / 3_600_000));
    return Math.round(billedHours * rate * 100) / 100;
  }

  private required(): SessionFields {
    if (this.fields === null) {
      throw new Error('no session is open: server/current is IDLE');
    }
    return this.fields;
  }
}

/** `HH:MM UTC`, for an audit line a human reads. */
function hourOf(deadline: Deadline): string {
  return `${deadline.at.toISOString().slice(11, 16)} UTC`;
}
