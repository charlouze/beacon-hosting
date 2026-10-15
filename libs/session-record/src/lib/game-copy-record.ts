import type { Game, GameCopy, GameVersion } from '@beacon/session';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { gameCopyDocPath, gameCopyFrom } from './fields.js';

export interface GameCopyRecord {
  /** Rejects when the record of the copy cannot be read. Writes nothing. */
  reach(game: Game): Promise<void>;
  /**
   * Records the version a verified deposit put in place, at the time of the
   * Firestore server. Leaves every other field of the document as it is: the
   * version read from the publisher is written by someone else.
   */
  recordDeposit(game: Game, version: GameVersion): Promise<void>;
}

export function gameCopyRecord(db: Firestore): GameCopyRecord {
  return {
    async reach(game): Promise<void> {
      await db.doc(gameCopyDocPath(game)).get();
    },

    async recordDeposit(game, version): Promise<void> {
      await db
        .doc(gameCopyDocPath(game))
        .set({ depositedVersion: version, depositedAt: FieldValue.serverTimestamp() }, { merge: true });
    },
  };
}

/** The face of `gameCopies/{game}` the Functions use. */
export interface GameCopyStore {
  /** The copy the last recorded deposit put in place, or null when none is. Rejects when the document cannot be read. */
  read(game: Game): Promise<GameCopy | null>;
  /**
   * Records the version read from the publisher, at the time of the Firestore
   * server. Leaves every other field of the document as it is: the deposit is
   * written by the tool.
   */
  recordPublished(game: Game, version: GameVersion): Promise<void>;
}

export function gameCopyStore(db: Firestore): GameCopyStore {
  return {
    async read(game): Promise<GameCopy | null> {
      const snapshot = await db.doc(gameCopyDocPath(game)).get();
      return gameCopyFrom(snapshot.data() ?? {});
    },

    async recordPublished(game, version): Promise<void> {
      await db
        .doc(gameCopyDocPath(game))
        .set({ publishedVersion: version, publishedReadAt: FieldValue.serverTimestamp() }, { merge: true });
    },
  };
}
