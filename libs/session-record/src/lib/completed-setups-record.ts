import { keepCompletedSetup, type CompletedSetup, type Game } from '@beacon/session';
import type { Firestore } from 'firebase-admin/firestore';
import {
  completedSetupsDocPath,
  completedSetupsDocument,
  completedSetupsFrom,
} from './fields.js';

export interface CompletedSetupStore {
  /**
   * Keeps a setup that came into service among the last of its game. A
   * session already kept is kept once.
   */
  keep(game: Game, completed: CompletedSetup): Promise<void>;
}

/**
 * One document per game and none per world: the ready window of a session is
 * drawn from every world of its game.
 */
export function completedSetupStore(db: Firestore): CompletedSetupStore {
  return {
    async keep(game, completed): Promise<void> {
      const setupsDoc = db.doc(completedSetupsDocPath(game));
      // A transaction: two `ready` reports of one session can race, and the
      // second must read what the first kept.
      await db.runTransaction(async (transaction) => {
        const kept = completedSetupsFrom((await transaction.get(setupsDoc)).data() ?? {});
        const next = keepCompletedSetup(kept, completed);
        if (next === null) return;
        transaction.set(setupsDoc, completedSetupsDocument(next));
      });
    },
  };
}
