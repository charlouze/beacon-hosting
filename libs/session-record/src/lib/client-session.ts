import {
  DEFAULT_SETTINGS,
  Session,
  type Actor,
  type Game,
  type SessionSettings,
} from '@beacon/session';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';
import {
  EVENTS,
  openingFields,
  rulesVersionFrom,
  sessionFrom,
  settingsFrom,
  SERVER_DOC,
  SETTINGS_DOC,
  TTL_DAYS,
} from './fields.js';

export interface OpenRequest {
  readonly sessionId: string;
  readonly game: Game;
  readonly actor: Actor;
}

/**
 * The browser's face of the session context. It owns the connection on
 * purpose: `apps/web` must not import a Firestore sdk nor name a document
 * field (§4), and the only way to keep that true is for this module to be the
 * one that calls `getFirestore`.
 */
export interface ClientSessionRecord {
  watch(onSession: (session: Session | null) => void): () => void;
  watchSettings(onSettings: (settings: SessionSettings) => void): () => void;
  /**
   * Calls back at most once, when the deployed rules version stops matching
   * the one this bundle was compiled against. A tab left open since yesterday
   * runs yesterday's rules against today's `config/settings` and today's
   * watchdog (§4), and the symptom is a button that works then evaporates.
   *
   * An unstamped deployment — null — is not a drift: a freshly seeded base has
   * never been stamped, and reloading on it would loop on first boot.
   */
  watchVersionDrift(compiled: string, onDrift: () => void): () => void;
  open(request: OpenRequest): Promise<void>;
  extend(actor: Actor): Promise<void>;
  requestStop(actor: Actor): Promise<void>;
}

export function clientSessionRecord(
  db: Firestore,
  clock = { now: () => new Date() },
): ClientSessionRecord {
  const server = () => doc(db, SERVER_DOC);

  /**
   * The settings as they were last read, kept current by one listener and one
   * only. Every decision needs them, and a second subscription would let two
   * copies of the same document disagree for as long as one of them lags.
   */
  let settings: SessionSettings = DEFAULT_SETTINGS;
  const settingsListeners = new Set<(settings: SessionSettings) => void>();

  /**
   * The deployment's stamp, carried by the same document and kept current by
   * the same listener: a second subscription on `config/settings` would be a
   * second copy of it, free to lag behind the first.
   */
  let deployedVersion: string | null = null;
  const versionListeners = new Set<(deployed: string | null) => void>();

  onSnapshot(doc(db, SETTINGS_DOC), (snapshot) => {
    const data = snapshot.data() ?? {};
    settings = settingsFrom(data);
    deployedVersion = rulesVersionFrom(data);
    for (const listener of settingsListeners) listener(settings);
    for (const listener of versionListeners) listener(deployedVersion);
  });

  const eventFor = (session: Session, event: { type: string; detail: string }, actor: Actor) => ({
    type: event.type,
    sessionId: session.sessionId,
    detail: event.detail,
    actor,
    at: serverTimestamp(),
    expiresAt: Timestamp.fromDate(new Date(clock.now().getTime() + TTL_DAYS * 86_400_000)),
  });

  /** Read, decide, write the patch and its audit line in one batch. */
  async function write(
    actor: Actor,
    decide: (session: Session) => {
      session: Session;
      events: readonly { type: string; detail: string }[];
    },
    patch: (session: Session) => Record<string, unknown>,
  ): Promise<void> {
    const snapshot = await getDoc(server());
    const current = sessionFrom(snapshot.data() ?? {});
    if (current === null) throw new Error('server/current is unreadable');

    // The domain refuses before anything is written: an extension outside the
    // window must leave no audit line behind, or the journal records gestures
    // that never happened.
    const decided = decide(current);

    const batch = writeBatch(db);
    batch.set(server(), patch(decided.session), { merge: true });
    for (const event of decided.events) {
      batch.set(doc(collection(db, EVENTS)), eventFor(decided.session, event, actor));
    }
    // §8: the state and its audit entry leave in the same batched write, so
    // atomically. A retry is not an answer to "written but unaudited".
    await batch.commit();
  }

  return {
    watch(onSession) {
      return onSnapshot(server(), (snapshot) => onSession(sessionFrom(snapshot.data() ?? {})));
    },

    watchSettings(onSettings) {
      settingsListeners.add(onSettings);
      onSettings(settings);
      return () => settingsListeners.delete(onSettings);
    },

    watchVersionDrift(compiled, onDrift) {
      const listener = (deployed: string | null): void => {
        if (deployed === null || deployed === compiled) return;
        // Firestore delivers a snapshot per write, and one reload per snapshot
        // would race the reload itself. The listener leaves before it calls.
        versionListeners.delete(listener);
        onDrift();
      };
      versionListeners.add(listener);
      listener(deployedVersion);
      return () => versionListeners.delete(listener);
    },

    /**
     * §6 étape 1. Reading the state and writing in the same transaction is the
     * whole lock against two people clicking at once: the second transaction
     * replays its read, sees PROVISIONING and gives up.
     */
    async open(request: OpenRequest): Promise<void> {
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(server());
        const current = sessionFrom(snapshot.data() ?? {});
        if (current === null) throw new Error('server/current is unreadable');
        if (current.state !== 'IDLE') {
          throw new Error(`cannot open a session while server/current is ${current.state}`);
        }
        const opened = Session.opening(request, clock, settings);
        transaction.set(server(), openingFields(opened.session, serverTimestamp()), {
          merge: true,
        });
        for (const event of opened.events) {
          transaction.set(
            doc(collection(db, EVENTS)),
            eventFor(opened.session, event, request.actor),
          );
        }
      });
    },

    /**
     * A batched write and not a transaction, deliberately (§6): two people
     * extending in the same second write the same value, and the session gains
     * one hour rather than two. Extending is a collective act on a shared
     * resource, not a counter each person increments.
     */
    extend(actor: Actor): Promise<void> {
      return write(
        actor,
        (session) => session.extend(actor, clock, settings),
        (session) => ({ deadline: Timestamp.fromDate(session.deadline.at) }),
      );
    },

    requestStop(actor: Actor): Promise<void> {
      return write(
        actor,
        (session) => session.requestStop(actor, clock),
        () => ({ state: 'STOPPING', stateSince: serverTimestamp() }),
      );
    },
  };
}
