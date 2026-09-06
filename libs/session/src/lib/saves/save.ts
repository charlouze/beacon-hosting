import type { Game } from '../game.js';

/**
 * How a save came to exist. `auto` is the companion's regular push, `manual` a
 * deposit made by hand, `pre-shutdown` the last one of an evening — and the
 * distinction is not cosmetic: the bucket's lifecycle rules prune them at
 * different ages, so the origin travels in the object key (§5).
 */
export const SAVE_ORIGINS = ['auto', 'manual', 'pre-shutdown'] as const;

export type SaveOrigin = (typeof SAVE_ORIGINS)[number];

/**
 * Under this, an archive is not a world. An empty zip is 22 bytes; the smallest
 * real world tranche 0 measured is 31 374. A kibibyte sits an order of
 * magnitude above the first and an order below the second, which is the widest
 * margin the two measurements allow on both sides.
 */
export const SAVE_FLOOR_BYTES = 1024;

/**
 * §8, and it is asked twice: by the companion before it pushes, and by
 * `agentReport` before it records. A predicate and not only a throwing factory,
 * because the first caller must decide *not to act* — acting and catching would
 * mean the suspect archive already left the machine.
 */
export function isPlausibleSaveSize(sizeBytes: number): boolean {
  return sizeBytes >= SAVE_FLOOR_BYTES;
}

export interface SaveFields {
  readonly createdAt: Date;
  readonly game: Game;
  /** Where it lives in the bucket. Built by the adapter, never by the domain. */
  readonly objectKey: string;
  readonly sizeBytes: number;
  readonly origin: SaveOrigin;
}

/**
 * One state of a game world, deposited in object storage. A value object: it
 * carries metadata and nothing else, and the §4 says why `saves` is a support
 * module of `session` rather than a context of its own — no term changes meaning
 * across the line, and the golden rule is enforced on the machine, not here.
 *
 * Its constructor is the floor. There is no way to hold a `Save` that names an
 * implausible archive, which is what makes the third defense a property rather
 * than a call someone has to remember to make.
 */
export class Save {
  private constructor(private readonly fields: SaveFields) {}

  static of(fields: SaveFields): Save {
    if (!isPlausibleSaveSize(fields.sizeBytes)) {
      throw new Error(
        `refusing a save of ${fields.sizeBytes} bytes: the floor is ${SAVE_FLOOR_BYTES}`,
      );
    }
    // Copied, because a Date is mutable and the caller keeps a reference to the
    // one it passed in. A value object a caller can move is not one.
    return new Save({ ...fields, createdAt: new Date(fields.createdAt.getTime()) });
  }

  get createdAt(): Date {
    return new Date(this.fields.createdAt.getTime());
  }

  get game(): Game {
    return this.fields.game;
  }

  get objectKey(): string {
    return this.fields.objectKey;
  }

  get sizeBytes(): number {
    return this.fields.sizeBytes;
  }

  get origin(): SaveOrigin {
    return this.fields.origin;
  }
}
