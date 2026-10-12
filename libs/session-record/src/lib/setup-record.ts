import {
  advanceSetup,
  firstSetupStep,
  type KeptSetupStep,
  type SessionId,
  type SetupAdvance,
  type SetupDeclaration,
  type SetupStepOrder,
  type WorldId,
} from '@beacon/session';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { keptSetupFrom, serverDocPath, setupDocPath } from './fields.js';

export interface SetupStore {
  /** Rewrites the whole document: nothing else ever erases the previous setup. */
  begin(sessionId: SessionId, order: SetupStepOrder, openedAt: Date): Promise<void>;
  /**
   * Applies what a game server declares to the kept step. Null when nothing
   * was applied: the world holds another session, the session is no longer
   * preparing, or no setup was begun for it.
   */
  advance(
    sessionId: SessionId,
    declared: SetupDeclaration,
    at: Date,
  ): Promise<SetupAdvance | null>;
}

export interface SetupStores {
  for(worldId: WorldId): SetupStore;
}

const stepFields = (kept: KeptSetupStep): Record<string, unknown> => ({
  step: kept.step,
  stepSince: Timestamp.fromDate(kept.since),
  activity: kept.activity,
  progress: kept.progress,
});

/**
 * A document of its own, beside `server/current` and never inside it: every
 * write to `server/current` wakes the state-change trigger, and a progress
 * arrives several times a minute.
 */
export function setupStores(db: Firestore): SetupStores {
  return {
    for(worldId: WorldId): SetupStore {
      const setupDoc = () => db.doc(setupDocPath(worldId));
      const serverDoc = () => db.doc(serverDocPath(worldId));

      return {
        async begin(sessionId, order, openedAt): Promise<void> {
          await setupDoc().set({
            sessionId,
            stepOrder: [...order],
            ...stepFields(firstSetupStep(openedAt)),
          });
        },

        async advance(sessionId, declared, at): Promise<SetupAdvance | null> {
          return db.runTransaction(async (transaction) => {
            const [server, setup] = await transaction.getAll(serverDoc(), setupDoc());
            const current = server.data() ?? {};
            if (current['sessionId'] !== sessionId) return null;
            if (current['state'] !== 'PROVISIONING') return null;

            const data = setup.data() ?? {};
            if (data['sessionId'] !== sessionId) return null;
            const kept = keptSetupFrom(data);
            if (kept === null) return null;

            const advance = advanceSetup(kept, declared, at);
            if (advance.changed !== null) {
              transaction.update(setupDoc(), stepFields(advance.kept));
            }
            return advance;
          });
        },
      };
    },
  };
}
