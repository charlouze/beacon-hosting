import type { SessionId } from '@beacon/session';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';

export const PROVISIONING = 'provisioning';

export interface ProvisioningLedger {
  /** Sessions whose intent to create was written and never closed. */
  openSessions(): Promise<SessionId[]>;
  close(sessionId: SessionId, at: Date): Promise<void>;
}

export function provisioningLedger(db: Firestore): ProvisioningLedger {
  return {
    async openSessions(): Promise<SessionId[]> {
      // An equality, so Firestore's automatic index serves it. This is why the
      // document carries closedAt: null from creation: "field absent" is not
      // a query, and scanning the collection every five minutes would grow
      // without bound.
      const snapshot = await db.collection(PROVISIONING).where('closedAt', '==', null).get();
      return snapshot.docs.map((doc) => doc.id);
    },

    async close(sessionId: SessionId, at: Date): Promise<void> {
      // Stamped, never deleted: that is what tells "session ended properly"
      // apart from "resource nobody ever heard of". The update fails silently
      // on a document the watchdog never saw, which is the ordinary case when
      // it reclaims something older than the ledger.
      const doc = db.doc(`${PROVISIONING}/${sessionId}`);
      const snapshot = await doc.get();
      if (!snapshot.exists) return;
      await doc.update({ closedAt: Timestamp.fromDate(at) });
    },
  };
}
