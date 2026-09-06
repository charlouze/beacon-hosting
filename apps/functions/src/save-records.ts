import type { Save } from '@beacon/session';
import { createHash } from 'node:crypto';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';

export const SAVES = 'saves';

export interface SaveRecords {
  /** Idempotent: the same object key records once, however often it is told. */
  record(save: Save): Promise<void>;
}

/**
 * The metadata half of a save (§5). The bytes are in the bucket and no code of
 * this project can delete either one — the port has no delete, and this
 * collection outlives the objects it names on purpose: a document pointing at
 * a key the bucket has pruned still says something true, which is that this
 * save existed.
 */
export function saveRecords(db: Firestore): SaveRecords {
  return {
    async record(save: Save): Promise<void> {
      // The document id is the key's own digest, so the same object recorded
      // twice is the same document. A report is delivered by a machine on a
      // network; "twice" is ordinary, not exceptional.
      const id = createHash('sha256').update(save.objectKey).digest('hex').slice(0, 32);
      await db.doc(`${SAVES}/${id}`).set({
        createdAt: Timestamp.fromDate(save.createdAt),
        game: save.game,
        objectKey: save.objectKey,
        sizeBytes: save.sizeBytes,
        origin: save.origin,
      });
    },
  };
}
