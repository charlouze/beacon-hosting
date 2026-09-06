import {
  type DomainEvent,
  type InstanceSize,
  type ServerRecord,
  type Session,
  type SessionId,
  type StateCorrection,
} from '@beacon/session';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import {
  EVENTS,
  RESERVED_FACTS,
  SERVER_DOC,
  sessionFrom,
  toDate,
  toState,
  TTL_DAYS,
  type JoinInfo,
} from './fields.js';

export interface ServerFacts {
  readonly ip: string;
  readonly joinInfo: JoinInfo;
  readonly instanceSize: InstanceSize;
  /** Provider references, as `open()` handed them back. */
  readonly references: { readonly instanceId: string; readonly ipId: string };
}

export interface ServerStateStore {
  read(): Promise<ServerRecord | null>;
  /** The same document, as the domain reads it. Null when it is unreadable. */
  readSession(): Promise<Session | null>;
  /**
   * §6 étape 3. True when this call is the one that claimed it — and only the
   * caller that gets true may spend money.
   */
  claimProvisioning(sessionId: SessionId, at: Date): Promise<boolean>;
  /** The machine exists and its join point is published: this is RUNNING (§4). */
  publish(facts: ServerFacts, at: Date): Promise<void>;
  /** `at` comes from the pass, so one pass stamps everything with one instant. */
  apply(correction: StateCorrection, at: Date): Promise<void>;
}

/**
 * The admin face of the session context's state. The client face comes with
 * the browser that needs it; both must map the same field names, which is why
 * the names live here and not at each call site.
 */
export function serverStateStore(db: Firestore): ServerStateStore {
  return {
    async read(): Promise<ServerRecord | null> {
      const snapshot = await db.doc(SERVER_DOC).get();
      if (!snapshot.exists) return null;
      const data = snapshot.data() ?? {};
      return {
        state: toState(data['state']),
        sessionId: (data['sessionId'] as string | undefined) ?? null,
        stateSince: toDate(data['stateSince']),
        hasReservedFacts: RESERVED_FACTS.some((field) => (data[field] ?? null) !== null),
      };
    },

    async readSession(): Promise<Session | null> {
      const snapshot = await db.doc(SERVER_DOC).get();
      return snapshot.exists ? sessionFrom(snapshot.data() ?? {}) : null;
    },

    async claimProvisioning(sessionId: SessionId, at: Date): Promise<boolean> {
      return db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(db.doc(SERVER_DOC));
        const data = snapshot.data() ?? {};
        // Three refusals and not one. Already claimed is the double delivery;
        // another session is a trigger that arrived after the world moved on;
        // another state is the same thing, seen from the other side.
        if ((data['provisionClaimedAt'] ?? null) !== null) return false;
        if (data['sessionId'] !== sessionId) return false;
        if (data['state'] !== 'PROVISIONING') return false;
        transaction.update(db.doc(SERVER_DOC), {
          provisionClaimedAt: Timestamp.fromDate(at),
        });
        return true;
      });
    },

    async publish(facts: ServerFacts, at: Date): Promise<void> {
      await db.doc(SERVER_DOC).set(
        {
          state: 'RUNNING',
          stateSince: Timestamp.fromDate(at),
          ip: facts.ip,
          joinInfo: facts.joinInfo,
          instanceSize: facts.instanceSize,
          instanceId: facts.references.instanceId,
          ipId: facts.references.ipId,
        },
        { merge: true },
      );
    },

    async apply(correction: StateCorrection, at: Date): Promise<void> {
      const batch = db.batch();
      const patch: Record<string, unknown> = {};

      if (correction.state !== null) {
        patch['state'] = correction.state;
        // The state and the instant it began travel together, always. Writing
        // one without the other is how "STOPPING for 10 minutes" stops being
        // answerable.
        patch['stateSince'] = Timestamp.fromDate(at);
      }
      if (correction.lastError !== null) {
        // Only a string replaces it. Null means "leave the recorded one", not
        // "clear it": the interface has to keep saying that the previous
        // attempt failed until a next attempt answers for itself.
        patch['lastError'] = correction.lastError;
      }
      if (correction.clearFacts) {
        for (const field of RESERVED_FACTS) {
          patch[field] = null;
        }
      }
      if (correction.deadline !== null) {
        // The deadline alone. `stateSince` stays where it is: the state did
        // not change, and the delays of §6 are measured on it.
        patch['deadline'] = Timestamp.fromDate(correction.deadline.at);
      }
      if (Object.keys(patch).length > 0) {
        batch.set(db.doc(SERVER_DOC), patch, { merge: true });
      }

      for (const event of correction.events) {
        batch.set(db.collection(EVENTS).doc(), eventDocument(event, at));
      }

      // One commit: §8 answers "state written but audit entry missing" with
      // atomicity, not with a retry.
      await batch.commit();
    },
  };
}

function eventDocument(event: DomainEvent, at: Date) {
  return {
    type: event.type,
    sessionId: event.sessionId ?? null,
    detail: event.detail,
    actor: { uid: 'system', name: 'system' },
    at: Timestamp.fromDate(at),
    expiresAt: Timestamp.fromDate(new Date(at.getTime() + TTL_DAYS * 86_400_000)),
  };
}
