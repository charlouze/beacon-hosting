import type { Actor } from './session-aggregate.js';
import type { DomainEvent } from './events.js';
import type { Game } from './game.js';

export type WorldId = string;

const WORLD_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** 1 à 32 caractères, minuscules, chiffres et tirets, ni en tête ni en queue. */
export function isWorldId(value: unknown): value is WorldId {
  return (
    typeof value === 'string' && value.length <= 32 && WORLD_ID_PATTERN.test(value)
  );
}

/**
 * The name descends into a file `docker compose` reads (§6, F), and
 * `renderCloudInit` will refuse a `$` regardless — this only refuses the
 * empty and the overlong, because knowing a compose file exists is not the
 * domain's business.
 */
export const MAX_WORLD_NAME = 64;

export interface WorldFields {
  readonly worldId: WorldId;
  readonly game: Game;
  readonly name: string;
  readonly inviteCode: string;
  /** uids. */
  readonly players: readonly string[];
}

/** A decision, and the facts it wants written down. Never one without the other. */
export interface WorldDecision {
  readonly world: World;
  readonly events: readonly DomainEvent[];
}

/**
 * A world as the domain holds it: what a group shares across the sessions it
 * opens on it, and nothing about any session itself (§4). `server/current`
 * below it is what carries the one-session-at-a-time cardinality — not an
 * invariant of this class.
 */
export class World {
  private constructor(private readonly fields: WorldFields) {}

  static from(fields: WorldFields): World {
    if (!isWorldId(fields.worldId)) {
      throw new Error(`invalid worldId: ${JSON.stringify(fields.worldId)}`);
    }
    if (fields.name.length === 0 || fields.name.length > MAX_WORLD_NAME) {
      throw new Error(
        `invalid name: must be 1 to ${MAX_WORLD_NAME} characters, got ${fields.name.length}`,
      );
    }
    // Copied, because a caller keeps the array it passed and an array a caller
    // can mutate is not a value object's — same rule as `Save.of` on the date.
    return new World({ ...fields, players: [...fields.players] });
  }

  get worldId(): WorldId {
    return this.fields.worldId;
  }

  get game(): Game {
    return this.fields.game;
  }

  get name(): string {
    return this.fields.name;
  }

  get inviteCode(): string {
    return this.fields.inviteCode;
  }

  get players(): readonly string[] {
    return this.fields.players;
  }

  hasPlayer(uid: string): boolean {
    return this.fields.players.includes(uid);
  }

  join(uid: string, code: string, actor: Actor): WorldDecision {
    if (code !== this.fields.inviteCode) {
      throw new Error('wrong invite code');
    }
    if (this.hasPlayer(uid)) {
      throw new Error(`${uid} is already a player`);
    }
    return {
      world: new World({ ...this.fields, players: [...this.fields.players, uid] }),
      events: [{ type: 'PlayerJoined', sessionId: null, detail: `${actor.name} joined` }],
    };
  }

  leave(uid: string, actor: Actor): WorldDecision {
    if (!this.hasPlayer(uid)) {
      throw new Error(`${uid} is not a player`);
    }
    return {
      world: new World({
        ...this.fields,
        players: this.fields.players.filter((player) => player !== uid),
      }),
      events: [{ type: 'PlayerLeft', sessionId: null, detail: `${actor.name} left` }],
    };
  }

  rename(name: string, actor: Actor): WorldDecision {
    if (name.length === 0 || name.length > MAX_WORLD_NAME) {
      throw new Error(
        `invalid name: must be 1 to ${MAX_WORLD_NAME} characters, got ${name.length}`,
      );
    }
    return {
      world: new World({ ...this.fields, name }),
      events: [
        { type: 'WorldRenamed', sessionId: null, detail: `${actor.name} renamed it to ${name}` },
      ],
    };
  }

  /**
   * Takes the code rather than drawing it: randomness is a port in fact, and
   * it lives with the caller (`crypto.randomUUID()` in the browser,
   * `randomBytes` in the tool).
   */
  regenerateInvite(code: string, actor: Actor): WorldDecision {
    void actor;
    return {
      world: new World({ ...this.fields, inviteCode: code }),
      events: [],
    };
  }
}
