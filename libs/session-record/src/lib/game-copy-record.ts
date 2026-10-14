import type { Game, GameVersion } from '@beacon/session';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { gameCopyDocPath } from './fields.js';

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
