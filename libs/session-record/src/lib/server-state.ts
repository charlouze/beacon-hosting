import {
  type DomainEvent,
  type InstanceSize,
  type ServerRecord,
  type Session,
  type SessionId,
  type StateCorrection,
  type WorldId,
} from '@beacon/session';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import {
  EVENTS,
  RESERVED_FACTS,
  serverDocPath,
  sessionFrom,
  toDate,
  toState,
  TTL_DAYS,
  worldFrom,
  WORLDS,
  type JoinInfo,
} from './fields.js';

export interface ServerFacts {
  readonly ip: string;
  readonly joinInfo: JoinInfo;
  readonly instanceSize: InstanceSize;
  /** Provider references, as `open()` handed them back. */
  readonly references: { readonly instanceId: string; readonly ipId: string };
}

/**
 * What publishing a join point writes, as fields. Extracted from `publish` so
 * that the round trip can call the very function the writer calls: a test that
 * recopied this object by hand would only prove that the two copies agree with
 * each other.
 */
export function factsPatch(facts: ServerFacts): Record<string, unknown> {
  return {
    ip: facts.ip,
    joinInfo: facts.joinInfo,
    instanceSize: facts.instanceSize,
    instanceId: facts.references.instanceId,
    ipId: facts.references.ipId,
  };
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
 * The admin face of one world's session context. The client face comes with
 * the browser that needs it; both must map the same field names, which is why
 * the names live here and not at each call site.
 *
 * `worldId` is captured once rather than threaded through every call: it is
 * what this store is *for*, the way a repository is for one aggregate and not
 * asked which one on every method.
 */
export function serverStateStore(db: Firestore, worldId: WorldId): ServerStateStore {
  const serverDoc = () => db.doc(serverDocPath(worldId));

  return {
    async read(): Promise<ServerRecord | null> {
      const snapshot = await serverDoc().get();
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
      const snapshot = await serverDoc().get();
      if (!snapshot.exists) return null;
      const worldSnapshot = await db.doc(`${WORLDS}/${worldId}`).get();
      if (!worldSnapshot.exists) return null;
      // Players play no part in `sessionFrom` — it only reads `worldId` and
      // `game` off the world — so the subcollection is not worth a second
      // read here.
      const world = worldFrom(worldId, worldSnapshot.data() ?? {}, []);
      if (world === null) return null;
      return sessionFrom(snapshot.data() ?? {}, world);
    },

    async claimProvisioning(sessionId: SessionId, at: Date): Promise<boolean> {
      return db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(serverDoc());
        const data = snapshot.data() ?? {};
        // Three refusals and not one. Already claimed is the double delivery;
        // another session is a trigger that arrived after the world moved on;
        // another state is the same thing, seen from the other side.
        if ((data['provisionClaimedAt'] ?? null) !== null) return false;
        if (data['sessionId'] !== sessionId) return false;
        if (data['state'] !== 'PROVISIONING') return false;
        transaction.update(serverDoc(), {
          provisionClaimedAt: Timestamp.fromDate(at),
          // The one instant where the recorded failure stops being true. Every
          // other write leaves it, deliberately — "the last attempt failed" has
          // to stay readable until a next attempt answers for itself, and this
          // call *is* that next attempt. Not at publish: `announce()` may have
          // just filed a dns incident on this very session.
          lastError: null,
        });
        return true;
      });
    },

    async publish(facts: ServerFacts, at: Date): Promise<void> {
      await serverDoc().set(
        {
          state: 'RUNNING',
          stateSince: Timestamp.fromDate(at),
          ...factsPatch(facts),
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
        batch.set(serverDoc(), patch, { merge: true });
      }

      for (const event of correction.events) {
        batch.set(db.collection(EVENTS).doc(), eventDocument(event, at, worldId));
      }

      // One commit: §8 answers "state written but audit entry missing" with
      // atomicity, not with a retry.
      await batch.commit();
    },
  };
}

/**
 * The shape every audited event takes on the way into Firestore, whichever
 * store files it — one world's, or `systemEvents` for the events §4 keeps
 * outside any world.
 */
export function eventDocument(event: DomainEvent, at: Date, worldId: WorldId | null) {
  return {
    // Spread rather than an enumerated field list, so a figure like
    // SessionStopped's costEuros — or whatever the next event variant
    // carries — reaches Firestore without this function being taught about
    // it by hand. Enumerating once already dropped it silently: every stop
    // wrote a document with no cost to read back, and §11's monthly total
    // had nothing to sum.
    ...event,
    worldId,
    sessionId: event.sessionId ?? null,
    actor: { uid: 'system', name: 'system' },
    at: Timestamp.fromDate(at),
    expiresAt: Timestamp.fromDate(new Date(at.getTime() + TTL_DAYS * 86_400_000)),
  };
}
