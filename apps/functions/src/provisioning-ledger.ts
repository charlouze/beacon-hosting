import type { SessionId } from '@beacon/session';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';

export const PROVISIONING = 'provisioning';

export interface ProvisioningIntent {
  readonly tag: string;
  readonly instanceSize: string;
}

export interface ProvisionedFacts {
  readonly instanceId: string;
  readonly ipId: string;
  /** Not a reference — what a human reads first when something must be found. */
  readonly ip: string;
}

/** What a pass can read back: the facts, plus the size actually provisioned. */
export interface RecordedProvisioning extends ProvisionedFacts {
  readonly instanceSize: string;
}

export interface ProvisioningLedger {
  /** Sessions whose intent to create was written and never closed. */
  openSessions(): Promise<SessionId[]>;
  /**
   * §6 étape 4: written **before** any call to the provider. Without it, a
   * crash between the call and recording the instance id leaves a billed
   * machine nobody knows exists.
   *
   * A strict create: a sessionId already seen fails the transaction, which is
   * what closes the reuse of an id drawn by a browser (§5).
   */
  open(sessionId: SessionId, intent: ProvisioningIntent, at: Date): Promise<void>;
  /** What the provider answered, once it has (§5): the two ids and the address. */
  record(sessionId: SessionId, facts: ProvisionedFacts): Promise<void>;
  /**
   * What was actually created for this session. §6 étape 7: the function
   * publishes the address **it** reserved, read from here — never the one the
   * machine declares.
   */
  read(sessionId: SessionId): Promise<RecordedProvisioning | null>;
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

    async open(sessionId: SessionId, intent: ProvisioningIntent, at: Date): Promise<void> {
      await db.doc(`${PROVISIONING}/${sessionId}`).create({
        tag: intent.tag,
        intendedAt: Timestamp.fromDate(at),
        instanceSize: intent.instanceSize,
        // Null from creation, never absent: "the open intents" is an equality
        // query, and Firestore does not query the absence of a field. An
        // intent created without it is invisible to the watchdog, which then
        // destroys the machine mid-provisioning.
        closedAt: null,
      });
    },

    async record(sessionId: SessionId, facts: ProvisionedFacts): Promise<void> {
      await db.doc(`${PROVISIONING}/${sessionId}`).set({ ...facts }, { merge: true });
    },

    async read(sessionId: SessionId): Promise<RecordedProvisioning | null> {
      const snapshot = await db.doc(`${PROVISIONING}/${sessionId}`).get();
      if (!snapshot.exists) return null;
      const data = snapshot.data() ?? {};
      const { instanceId, ipId, ip, instanceSize } = data;
      // All four or nothing. A partial intent means the provider answered and
      // the crash came in between; publishing RUNNING from half of it would put
      // a join point on screen that points at nothing.
      if (
        typeof instanceId !== 'string' ||
        typeof ipId !== 'string' ||
        typeof ip !== 'string' ||
        typeof instanceSize !== 'string'
      ) {
        return null;
      }
      return { instanceId, ipId, ip, instanceSize };
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
