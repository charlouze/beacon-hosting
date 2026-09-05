import {
  SESSION_STATES,
  type DomainEvent,
  type ServerRecord,
  type SessionState,
  type StateCorrection,
} from '@beacon/session';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';

export const SERVER_DOC = 'server/current';
export const EVENTS = 'events';

const TTL_DAYS = 400;

/**
 * The reserved fields of §5, minus `lastError`. This list is the one place in
 * the repository that knows them, and it is why `ServerRecord` carries a
 * boolean rather than the fields themselves: the day the spec adds a reserved
 * field — as it just did with `joinInfo` — only this line changes.
 *
 * `provisionClaimedAt` belongs here and its absence would be the worst bug of
 * the tranche: it is the provisioning claim lock (§6, étape 3), and one that
 * survived a return to IDLE would make the Function abandon every session
 * that follows, forever.
 */
const RESERVED_FACTS = ['instanceId', 'ipId', 'ip', 'joinInfo', 'provisionClaimedAt'] as const;

export interface ServerStateStore {
  read(): Promise<ServerRecord | null>;
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

/**
 * Null rather than a guess. This is the frontier: what crosses it must be a
 * state the domain named, or nothing at all. Defaulting to IDLE would hand the
 * component that destroys a fact nobody wrote.
 */
function toState(value: unknown): SessionState | null {
  return SESSION_STATES.includes(value as SessionState) ? (value as SessionState) : null;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Timestamp) return value.toDate();
  if (value instanceof Date) return value;
  return null;
}
