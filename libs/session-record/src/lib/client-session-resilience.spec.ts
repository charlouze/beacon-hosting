import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { deleteApp as deleteAdminApp, initializeApp, type App } from 'firebase-admin/app';
import { deleteApp, initializeApp as initializeClientApp, type FirebaseApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  getFirestore as getClientFirestore,
  setLogLevel,
} from 'firebase/firestore';
import { World } from '@beacon/session';
import { clientSessionRecord, type WorldSummary } from './client-session.js';
import { idleServerDocument, playerDocument, serverDocPath, worldDocument } from './fields.js';

// A refused listener logs a permission denial on teardown, the same artefact
// `authorised-writes.spec.ts` silences for the same reason.
setLogLevel('silent');

/**
 * Its own project and its own, deliberately minimal rules — not
 * `firestore.rules`. What this file pins is `client-session.ts`'s own
 * resilience to a refused read on one of `watchWorldSummary`'s three
 * listeners, a question distinct from what a real deployment allows, which is
 * `authorised-writes.spec.ts`'s job. `players` is refused unconditionally so
 * the point never depends on who is a member of what.
 */
const PROJECT_ID = 'demo-beacon-resilience';
const RULES = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /worlds/{worldId} {
      allow read: if true;
      match /server/current {
        allow read: if true;
      }
      match /players/{uid} {
        allow read: if false;
      }
    }
  }
}
`;

const WORLD_ID = 'les-copains';
const NOW = new Date('2026-09-15T20:00:00Z');
const WORLD = World.from({
  worldId: WORLD_ID,
  game: 'enshrouded',
  name: 'Les copains',
  inviteCode: 'c0de',
  players: ['alice'],
});

let env: RulesTestEnvironment;
let adminApp: App;

beforeAll(async () => {
  adminApp = initializeApp({ projectId: PROJECT_ID }, 'client-session-resilience-spec');
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: { rules: RULES, host: '127.0.0.1', port: 8080 },
  });
});

afterAll(async () => {
  await deleteAdminApp(adminApp);
  await env?.cleanup();
});

const admin = () => getFirestore(adminApp);

beforeEach(async () => {
  await admin().doc(`worlds/${WORLD_ID}`).set(worldDocument(WORLD, NOW));
  await admin()
    .doc(`worlds/${WORLD_ID}/players/alice`)
    .set(playerDocument('alice', WORLD.inviteCode, Timestamp.fromDate(NOW)));
  await admin().doc(serverDocPath(WORLD_ID)).set(idleServerDocument(NOW));
});

const clients: FirebaseApp[] = [];

function recordAsAlice() {
  const app = initializeClientApp({ projectId: PROJECT_ID }, `resilience-${clients.length}`);
  clients.push(app);
  const db = getClientFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080, { mockUserToken: { sub: 'alice' } });
  return clientSessionRecord(db);
}

describe('a roster read the rules refuse', () => {
  it('does not stop the world and server from still publishing, nor from publishing again', async () => {
    const seen: (WorldSummary | null)[] = [];
    const unsubscribe = recordAsAlice().watchWorld(WORLD_ID, (view) => seen.push(view));

    // The players listener's very first attempt is refused. Left unhandled,
    // that used to leave `watchWorldSummary` waiting for a roster that will
    // never come — the bug this file is here to keep fixed.
    await vi.waitFor(() => expect(seen.some((v) => v !== null)).toBe(true));
    expect(seen.at(-1)?.world.name).toBe('Les copains');
    expect(seen.at(-1)?.server?.session.state).toBe('IDLE');

    // A later write on a listener that *is* readable must still reach a new
    // publication — proof the chain was never poisoned by the earlier refusal.
    await admin()
      .doc(serverDocPath(WORLD_ID))
      .update({
        state: 'PROVISIONING',
        stateSince: Timestamp.fromDate(NOW),
        sessionId: 's1',
        startedBy: 'alice',
        startedAt: Timestamp.fromDate(NOW),
        deadline: Timestamp.fromDate(new Date(NOW.getTime() + 3_600_000)),
      });
    await vi.waitFor(() => expect(seen.at(-1)?.server?.session.state).toBe('PROVISIONING'));

    unsubscribe();
    await Promise.all(clients.splice(0).map((app) => deleteApp(app)));
  });
});
