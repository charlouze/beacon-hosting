import { type DomainEvent, type World, type WorldId } from '@beacon/session';
import type { Firestore } from 'firebase-admin/firestore';
import {
  EVENTS,
  idleServerDocument,
  PLAYERS,
  serverDocPath,
  worldDocument,
  worldFrom,
  WORLDS,
} from './fields.js';
import { eventDocument, serverStateStore, type ServerStateStore } from './server-state.js';

/**
 * Every world's session state, one at a time. `for` is the everyday door —
 * a Function knows the one world it is reacting to — and `all` is the
 * watchdog's, which has none in particular: it exists to find every world
 * that owns a `server/current` at all.
 */
export interface WorldStateStores {
  for(worldId: WorldId): ServerStateStore;
  /** Every world with a `server/current`, in no particular order. */
  all(): Promise<readonly WorldId[]>;
}

export function worldStateStores(db: Firestore): WorldStateStores {
  return {
    for(worldId: WorldId): ServerStateStore {
      return serverStateStore(db, worldId);
    },

    async all(): Promise<readonly WorldId[]> {
      // A collection group query: `server` is the one collection name a
      // world and its `current` document share, so it is the only thing this
      // query can ask for. `current` is filtered here rather than assumed,
      // because the group has no other name to tell a stray document apart.
      const snapshot = await db.collectionGroup('server').get();
      const worldIds = new Set<WorldId>();
      for (const doc of snapshot.docs) {
        if (doc.id !== 'current') continue;
        const worldId = doc.ref.parent.parent?.id;
        if (worldId !== undefined) worldIds.add(worldId);
      }
      return [...worldIds];
    },
  };
}

/**
 * The face that brings a world into existence, and reads it back with the
 * players it holds — the one fact `worldFrom` cannot get from the world
 * document alone, because §4 keeps `players` a subcollection.
 */
export interface AdminWorldRecord {
  read(worldId: WorldId): Promise<World | null>;
  /**
   * Strict: a world that already exists fails the whole write, the same
   * refusal `provisioning/{sessionId}` gives a session already open. A world
   * is born once, with its `server/current` already IDLE — never in two
   * separate writes that could observe each other half-done.
   */
  create(world: World, at: Date): Promise<void>;
}

export function adminWorldRecord(db: Firestore): AdminWorldRecord {
  return {
    async read(worldId: WorldId): Promise<World | null> {
      const worldRef = db.doc(`${WORLDS}/${worldId}`);
      const [snapshot, players] = await Promise.all([
        worldRef.get(),
        worldRef.collection(PLAYERS).get(),
      ]);
      if (!snapshot.exists) return null;
      const playerUids = players.docs.map((doc) => doc.id);
      return worldFrom(worldId, snapshot.data() ?? {}, playerUids);
    },

    async create(world: World, at: Date): Promise<void> {
      const batch = db.batch();
      // `create`, not `set`: the precondition that fails the whole batch when
      // the world already exists.
      batch.create(db.doc(`${WORLDS}/${world.worldId}`), worldDocument(world, at));
      batch.set(db.doc(serverDocPath(world.worldId)), idleServerDocument(at));
      await batch.commit();
    },
  };
}

export interface SystemEvents {
  /** Files with no world at all — §4's `sweepEvents` output (T4). */
  file(events: readonly DomainEvent[], at: Date): Promise<void>;
}

export function systemEvents(db: Firestore): SystemEvents {
  return {
    async file(events: readonly DomainEvent[], at: Date): Promise<void> {
      const batch = db.batch();
      for (const event of events) {
        batch.set(db.collection(EVENTS).doc(), eventDocument(event, at, null));
      }
      await batch.commit();
    },
  };
}
