import {
  DEFAULT_SETTINGS,
  Session,
  World,
  type Actor,
  type SessionSettings,
  type WorldId,
} from '@beacon/session';
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
  type Firestore,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  displayedFactsFrom,
  EVENTS,
  openingFields,
  playerDocument,
  PLAYERS,
  rulesVersionFrom,
  serverDocPath,
  sessionFrom,
  settingsFrom,
  SETTINGS_DOC,
  toDate,
  TTL_DAYS,
  worldFrom,
  WORLDS,
  type DisplayedFacts,
} from './fields.js';

export type { DisplayedFacts };

export interface OpenRequest {
  readonly worldId: WorldId;
  readonly sessionId: string;
  readonly actor: Actor;
}

/**
 * One snapshot of a world's `server/current`, as the screen needs it: what the
 * domain reads, the three facts §4 says are displayed, and the instant the
 * current state began.
 *
 * `stateSince` travels with them and is not a catch-all. The boot screen
 * announces a window computed from the instant the state began, and the
 * aggregate does not carry that field — `startedAt` is the session's opening,
 * which is the same instant today and will not be the day one state precedes
 * another. The admin face already reads it; this is the same translation
 * offered to the second transport.
 */
export interface ServerView {
  readonly session: Session;
  readonly facts: DisplayedFacts;
  readonly stateSince: Date | null;
}

/**
 * A world and the session context it holds, published together (T8). The
 * screen never sees a world without its state, the same discipline `watch`
 * once held for a session and its facts on a single document — except a world
 * and its `server/current` are two documents, so this is two subscriptions
 * merged into one publication rather than one.
 *
 * `server` is null when the world's `server/current` is unreadable — a
 * document with no session on it is not this member's problem to interpret.
 */
export interface WorldSummary {
  readonly world: World;
  readonly server: ServerView | null;
}

/**
 * The browser's face of the session context. It owns the connection on
 * purpose: `apps/web` must not import a Firestore sdk nor name a document
 * field (§4), and the only way to keep that true is for this module to be the
 * one that calls `getFirestore`.
 */
export interface ClientSessionRecord {
  /**
   * §8: a collection group query on `players` where `uid == uid`, then one
   * subscription per world found — three or four, never thirty, which is why
   * one per world is the honest shape and not a scaling concern.
   */
  watchMyWorlds(uid: string, onWorlds: (worlds: readonly WorldSummary[]) => void): () => void;
  /** One world, and its session context, as one publication (see `WorldSummary`). */
  watchWorld(worldId: WorldId, onView: (view: WorldSummary | null) => void): () => void;
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
  /**
   * The rule alone says yes or no (T9): it compares `code` to the world's own
   * `inviteCode` with a `get()`, which is why a first joiner — not yet a
   * player, and so unable to read the world at all — never has to read it
   * first. A refusal surfaces as a domain error naming the invite code, not
   * as Firestore's own `permission-denied`.
   */
  join(worldId: WorldId, code: string, actor: Actor): Promise<void>;
  leave(worldId: WorldId, actor: Actor): Promise<void>;
  rename(worldId: WorldId, name: string, actor: Actor): Promise<void>;
  /** The code is drawn here — the only randomness this module holds. */
  regenerateInvite(worldId: WorldId, actor: Actor): Promise<void>;
  open(request: OpenRequest): Promise<void>;
  extend(worldId: WorldId, actor: Actor): Promise<void>;
  requestStop(worldId: WorldId, actor: Actor): Promise<void>;
}

export function clientSessionRecord(
  db: Firestore,
  clock = { now: () => new Date() },
): ClientSessionRecord {
  const worldDoc = (worldId: WorldId) => doc(db, WORLDS, worldId);
  const playerDoc = (worldId: WorldId, uid: string) => doc(db, WORLDS, worldId, PLAYERS, uid);
  const playersCollection = (worldId: WorldId) => collection(db, WORLDS, worldId, PLAYERS);
  const serverDoc = (worldId: WorldId) => doc(db, serverDocPath(worldId));

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

  const eventBase = (event: { type: string; detail: string }, actor: Actor) => ({
    type: event.type,
    detail: event.detail,
    actor,
    at: serverTimestamp(),
    expiresAt: Timestamp.fromDate(new Date(clock.now().getTime() + TTL_DAYS * 86_400_000)),
  });

  /** A session-carried event: `worldId` and `sessionId` come from the session itself. */
  const eventFor = (session: Session, event: { type: string; detail: string }, actor: Actor) => ({
    ...eventBase(event, actor),
    worldId: session.worldId,
    sessionId: session.sessionId,
  });

  /**
   * A world-carried event: `join`, `leave`, `rename` open no session at all.
   * `sessionId` is left off rather than written `null`: the rule's
   * `bounded()` only ever accepts a string, so a `null` key present in the
   * document is refused where an absent one reads back the same `null` on
   * the way out (`event.sessionId ?? null` in `eventDocument`).
   */
  const eventForWorld = (
    worldId: WorldId,
    event: { type: string; detail: string },
    actor: Actor,
  ) => ({
    ...eventBase(event, actor),
    worldId,
  });

  /**
   * The world as the domain needs it, players included: `join`, `leave`,
   * `rename` and `regenerateInvite` all decide from the whole roster, not from
   * one member's presence in it.
   */
  async function readWorld(worldId: WorldId): Promise<World> {
    const [snapshot, players] = await Promise.all([
      getDoc(worldDoc(worldId)),
      getDocs(playersCollection(worldId)),
    ]);
    const world = worldFrom(
      worldId,
      snapshot.data() ?? {},
      players.docs.map((entry) => entry.id),
    );
    if (world === null) throw new Error(`world ${worldId} is unreadable`);
    return world;
  }

  /** A world and its session context, from one subscription on each document. */
  function watchWorldSummary(
    worldId: WorldId,
    onSummary: (summary: WorldSummary | null) => void,
  ): Unsubscribe {
    let worldData: Record<string, unknown> | null | undefined;
    let serverData: Record<string, unknown> | undefined;
    let playerUids: readonly string[] | undefined;
    let publishing = Promise.resolve();

    const publish = (): void => {
      // Serialised: a slow read for one snapshot must not overtake the
      // publication of the snapshot that followed it. Chained with `.catch`
      // rather than left to reject: a denied read must not permanently stop
      // every publication that follows it on this subscription.
      publishing = publishing
        .then(async () => {
          if (worldData === undefined || serverData === undefined || playerUids === undefined) {
            return;
          }
          if (worldData === null) {
            onSummary(null);
            return;
          }
          const world = worldFrom(worldId, worldData, playerUids);
          if (world === null) {
            onSummary(null);
            return;
          }
          const session = sessionFrom(serverData, world);
          onSummary({
            world,
            server:
              session === null
                ? null
                : {
                    session,
                    facts: displayedFactsFrom(serverData),
                    stateSince: toDate(serverData['stateSince']),
                  },
          });
        })
        .catch(() => {
          onSummary(null);
        });
    };

    // A rules refusal completes the stream rather than rejecting a promise —
    // handled here the same way as an unreadable document, so that a world
    // T9's rules start hiding from some members does not stall the other two
    // listeners' publications for ever.
    const unsubWorld = onSnapshot(
      worldDoc(worldId),
      (snapshot) => {
        worldData = snapshot.exists() ? (snapshot.data() ?? {}) : null;
        publish();
      },
      () => {
        worldData = null;
        publish();
      },
    );
    const unsubServer = onSnapshot(
      serverDoc(worldId),
      (snapshot) => {
        serverData = snapshot.data() ?? {};
        publish();
      },
      () => {
        serverData = {};
        publish();
      },
    );
    // A third listener rather than `getDocs` per publication: join and leave
    // write no field on `worlds/{worldId}` or `server/current`, so without its
    // own subscription the roster this publishes would never move.
    const unsubPlayers = onSnapshot(
      playersCollection(worldId),
      (snapshot) => {
        playerUids = snapshot.docs.map((entry) => entry.id);
        publish();
      },
      () => {
        playerUids = [];
        publish();
      },
    );

    return () => {
      unsubWorld();
      unsubServer();
      unsubPlayers();
    };
  }

  /** Read, decide, write the patch and its audit line in one batch. */
  async function write(
    worldId: WorldId,
    actor: Actor,
    decide: (session: Session) => {
      session: Session;
      events: readonly { type: string; detail: string }[];
    },
    patch: (session: Session) => Record<string, unknown>,
  ): Promise<void> {
    const world = await readWorld(worldId);
    const snapshot = await getDoc(serverDoc(worldId));
    const current = sessionFrom(snapshot.data() ?? {}, world);
    if (current === null) throw new Error('server/current is unreadable');

    // The domain refuses before anything is written: an extension outside the
    // window must leave no audit line behind, or the journal records gestures
    // that never happened.
    const decided = decide(current);

    const batch = writeBatch(db);
    batch.set(serverDoc(worldId), patch(decided.session), { merge: true });
    for (const event of decided.events) {
      batch.set(doc(collection(db, EVENTS)), eventFor(decided.session, event, actor));
    }
    // §8: the state and its audit entry leave in the same batched write, so
    // atomically. A retry is not an answer to "written but unaudited".
    await batch.commit();
  }

  return {
    watchMyWorlds(uid, onWorlds) {
      const playersQuery = query(collectionGroup(db, PLAYERS), where('uid', '==', uid));
      const summaries = new Map<WorldId, WorldSummary>();
      // Distinct from `summaries`: a world whose summary is null (unreadable,
      // or malformed) has still reported. Counting `summaries.size` against it
      // would hold the gate below forever the day one world in the list can
      // never publish — and the other worlds would never be shown either.
      const reported = new Set<WorldId>();
      let worldIds: readonly WorldId[] = [];
      let stopWorlds: Unsubscribe[] = [];

      const publish = (): void => {
        // Wait until every world found by the last query has reported once —
        // otherwise the first publication would show fewer worlds than the
        // query already found, which is not "not yet loaded", it is wrong.
        if (reported.size < worldIds.length) return;
        onWorlds(worldIds.flatMap((worldId) => summaries.get(worldId) ?? []));
      };

      const stopGroup = onSnapshot(playersQuery, (snapshot) => {
        for (const stop of stopWorlds.splice(0)) stop();
        summaries.clear();
        reported.clear();
        const found = new Set<WorldId>();
        for (const entry of snapshot.docs) {
          const worldId = entry.ref.parent.parent?.id;
          if (worldId !== undefined) found.add(worldId);
        }
        worldIds = [...found];
        stopWorlds = worldIds.map((worldId) =>
          watchWorldSummary(worldId, (summary) => {
            reported.add(worldId);
            if (summary === null) summaries.delete(worldId);
            else summaries.set(worldId, summary);
            publish();
          }),
        );
        publish();
      });

      return () => {
        stopGroup();
        for (const stop of stopWorlds.splice(0)) stop();
      };
    },

    watchWorld(worldId, onView) {
      return watchWorldSummary(worldId, onView);
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

    async join(worldId, code, actor) {
      // T9 moved the code check into the rule itself — a `get()` on the world,
      // compared against `request.resource.data.code` — precisely so a first
      // joiner, who by definition is not yet a player, never has to read a
      // world it cannot see. The rule refuses the write, not the domain.
      const batch = writeBatch(db);
      batch.set(playerDoc(worldId, actor.uid), playerDocument(actor.uid, code, serverTimestamp()));
      batch.set(
        doc(collection(db, EVENTS)),
        eventForWorld(worldId, { type: 'PlayerJoined', detail: `${actor.name} joined` }, actor),
      );
      try {
        await batch.commit();
      } catch (error) {
        // The rejection the sdk actually throws here is a `FirebaseError`,
        // not the narrower `FirestoreError` its own types promise for this
        // call — `.code` is the one property both shapes carry, so that is
        // what this checks rather than an `instanceof` that would miss it.
        if ((error as { code?: string }).code === 'permission-denied') {
          throw new Error('wrong invite code');
        }
        throw error;
      }
    },

    async leave(worldId, actor) {
      const world = await readWorld(worldId);
      const decided = world.leave(actor.uid, actor);
      const batch = writeBatch(db);
      batch.delete(playerDoc(worldId, actor.uid));
      for (const event of decided.events) {
        batch.set(doc(collection(db, EVENTS)), eventForWorld(worldId, event, actor));
      }
      await batch.commit();
    },

    async rename(worldId, name, actor) {
      const world = await readWorld(worldId);
      const decided = world.rename(name, actor);
      const batch = writeBatch(db);
      batch.set(worldDoc(worldId), { name: decided.world.name }, { merge: true });
      for (const event of decided.events) {
        batch.set(doc(collection(db, EVENTS)), eventForWorld(worldId, event, actor));
      }
      await batch.commit();
    },

    async regenerateInvite(worldId, actor) {
      const world = await readWorld(worldId);
      const code = crypto.randomUUID();
      const decided = world.regenerateInvite(code, actor);
      const batch = writeBatch(db);
      batch.set(worldDoc(worldId), { inviteCode: decided.world.inviteCode }, { merge: true });
      for (const event of decided.events) {
        batch.set(doc(collection(db, EVENTS)), eventForWorld(worldId, event, actor));
      }
      await batch.commit();
    },

    /**
     * §6 étape 1. The world is read in the same transaction as `server/current`
     * so `Session.opening` can refuse "not a player" before anything is
     * written, and so the double-click lock is unchanged: the second
     * transaction replays its read, sees PROVISIONING and gives up.
     *
     * Only the actor's own player document is read, never the whole roster:
     * `Session.opening` only asks `hasPlayer` of the one uid opening, and a
     * transaction's `get` takes a document, never a query.
     */
    async open(request: OpenRequest): Promise<void> {
      const { worldId } = request;
      await runTransaction(db, async (transaction) => {
        const [worldSnapshot, playerSnapshot, serverSnapshot] = await Promise.all([
          transaction.get(worldDoc(worldId)),
          transaction.get(playerDoc(worldId, request.actor.uid)),
          transaction.get(serverDoc(worldId)),
        ]);
        const world = worldFrom(
          worldId,
          worldSnapshot.data() ?? {},
          playerSnapshot.exists() ? [request.actor.uid] : [],
        );
        if (world === null) throw new Error(`world ${worldId} is unreadable`);

        const current = sessionFrom(serverSnapshot.data() ?? {}, world);
        if (current === null) throw new Error('server/current is unreadable');
        if (current.state !== 'IDLE') {
          throw new Error(`cannot open a session while server/current is ${current.state}`);
        }

        const opened = Session.opening(
          { sessionId: request.sessionId, world, actor: request.actor },
          clock,
          settings,
        );
        transaction.set(serverDoc(worldId), openingFields(opened.session, serverTimestamp()), {
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
    extend(worldId: WorldId, actor: Actor): Promise<void> {
      return write(
        worldId,
        actor,
        (session) => session.extend(actor, clock, settings),
        (session) => ({ deadline: Timestamp.fromDate(session.deadline.at) }),
      );
    },

    requestStop(worldId: WorldId, actor: Actor): Promise<void> {
      return write(
        worldId,
        actor,
        (session) => session.requestStop(actor, clock),
        () => ({ state: 'STOPPING', stateSince: serverTimestamp() }),
      );
    },
  };
}
