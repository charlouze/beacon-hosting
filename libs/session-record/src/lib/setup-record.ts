import {
  advanceSetup,
  firstSetupStep,
  type KeptSetup,
  type KeptSetupStep,
  type SessionId,
  type SetupAdvance,
  type SetupDeclaration,
  type SetupStepOrder,
  type WorldId,
} from '@beacon/session';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { keptSetupFrom, keptStepFrom, serverDocPath, setupDocPath } from './fields.js';

export interface SetupStore {
  /**
   * Keeps the first step from `since`, rewriting the whole document, only while
   * the world still holds this session preparing. False when it does not, and
   * then nothing is written.
   */
  begin(sessionId: SessionId, order: SetupStepOrder, since: Date): Promise<boolean>;
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
  /** What is kept, whichever session it belongs to. Null when the document holds no readable setup. */
  read(): Promise<KeptSetup | null>;
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
        async begin(sessionId, order, since): Promise<boolean> {
          return db.runTransaction(async (transaction) => {
            const server = (await transaction.get(serverDoc())).data() ?? {};
            if (server['sessionId'] !== sessionId) return false;
            if (server['state'] !== 'PROVISIONING') return false;
            transaction.set(setupDoc(), {
              sessionId,
              stepOrder: [...order],
              ...stepFields(firstSetupStep(since)),
            });
            return true;
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
            const kept = keptStepFrom(data);
            if (kept === null) return null;

            const advance = advanceSetup(kept, declared, at);
            if (advance.changed !== null) {
              transaction.update(setupDoc(), stepFields(advance.kept));
            }
            return advance;
          });
        },

        async read(): Promise<KeptSetup | null> {
          return keptSetupFrom((await setupDoc().get()).data() ?? {});
        },
      };
    },
  };
}
