import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collectionGroup, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import { describe, it } from 'vitest';
import { ALICE, BOB, env, MALLORY, ROOT, as, given, useRulesEnvironment } from './harness.js';

useRulesEnvironment();

const world = (uid: string | null) => doc(as(env, uid), 'worlds', 'w1');
const player = (uid: string | null, who: string) => doc(as(env, uid), 'worlds', 'w1', 'players', who);
const server = (uid: string | null) => doc(as(env, uid), 'worlds', 'w1', 'server', 'current');
const joining = (who: string, code: string) => ({ uid: who, joinedAt: serverTimestamp(), code });

// A world named by its id, for the isolation suite below — `world`, `player`
// and `server` above stay pinned to `w1` for every other suite in this file.
const worldNamed = (uid: string | null, worldId: string) => doc(as(env, uid), 'worlds', worldId);
const playerOf = (uid: string | null, worldId: string, who: string) =>
  doc(as(env, uid), 'worlds', worldId, 'players', who);
const serverOf = (uid: string | null, worldId: string) => doc(as(env, uid), 'worlds', worldId, 'server', 'current');

describe('worlds/{worldId}', () => {
  it('is read by its players and by an admin, and by nobody else', async () => {
    await assertSucceeds(getDoc(world(ALICE)));
    await assertSucceeds(getDoc(world(ROOT)));
    await assertFails(getDoc(world(BOB)));
    await assertFails(getDoc(world(MALLORY)));
    await assertFails(getDoc(world(null)));
  });

  it('is never created nor deleted by a client, admin included', async () => {
    await assertFails(setDoc(doc(as(env, ROOT), 'worlds', 'w3'), { game: 'enshrouded', name: 'x', inviteCode: 'c' }));
    await assertFails(deleteDoc(world(ROOT)));
  });

  it('lets a player rename and reinvite, and touch nothing else', async () => {
    await assertSucceeds(updateDoc(world(ALICE), { name: 'Les bras cassés' }));
    await assertSucceeds(updateDoc(world(ALICE), { inviteCode: 'n3w' }));
    await assertFails(updateDoc(world(ALICE), { game: 'sunkenland' }));
    await assertFails(updateDoc(world(ALICE), { createdAt: serverTimestamp() }));
    await assertFails(updateDoc(world(ALICE), { name: 'x'.repeat(1025) }));
    await assertFails(updateDoc(world(ALICE), { name: 'x'.repeat(65) }));
    await assertFails(updateDoc(world(ALICE), { name: '' }));
  });

  it('refuses a member who is not a player, even a harmless rename', async () => {
    await assertFails(updateDoc(world(BOB), { name: 'Les autres' }));
  });

  it('lets an admin touch everything but the game', async () => {
    await assertSucceeds(updateDoc(world(ROOT), { name: 'Renamed by root' }));
    await assertFails(updateDoc(world(ROOT), { game: 'sunkenland' }));
    await assertFails(updateDoc(world(ROOT), { name: 'x'.repeat(65) }));
    await assertFails(updateDoc(world(ROOT), { name: '' }));
  });
});

describe('worlds/{worldId}/players/{uid}', () => {
  it('lets a member in with the right code, under their own uid only', async () => {
    await assertSucceeds(setDoc(player(BOB, BOB), joining(BOB, 'c0de')));
  });

  it('refuses a wrong code, a visitor, and inscribing somebody else', async () => {
    await assertFails(setDoc(player(BOB, BOB), joining(BOB, 'nope')));
    await assertFails(setDoc(player(MALLORY, MALLORY), joining(MALLORY, 'c0de')));
    await assertFails(setDoc(player(ALICE, BOB), joining(BOB, 'c0de')));
    await assertFails(setDoc(player(BOB, BOB), joining(ALICE, 'c0de')));
  });

  it('refuses a player document with an extra field, or a chosen instant', async () => {
    await assertFails(setDoc(player(BOB, BOB), { ...joining(BOB, 'c0de'), role: 'admin' }));
    await assertFails(setDoc(player(BOB, BOB), { uid: BOB, code: 'c0de', joinedAt: new Date(0) }));
  });

  it('is never updated', async () => {
    await assertFails(updateDoc(player(ALICE, ALICE), { code: 'other' }));
    await assertFails(updateDoc(player(ROOT, ALICE), { code: 'other' }));
  });

  it('is deleted by its subject or by an admin, and by nobody else', async () => {
    await assertFails(deleteDoc(player(BOB, ALICE)));
    await assertSucceeds(deleteDoc(player(ROOT, ALICE)));
    await given(env, 'worlds/w1/players/alice', { uid: ALICE, joinedAt: null, code: null });
    await assertSucceeds(deleteDoc(player(ALICE, ALICE)));
  });

  it('is read by the players of the world and an admin', async () => {
    await assertSucceeds(getDoc(player(ALICE, ALICE)));
    await assertSucceeds(getDoc(player(ROOT, ALICE)));
    await assertFails(getDoc(player(BOB, ALICE)));
  });

  // « Mes mondes » : la seule requête de groupe de collection du système.
  it('answers "my worlds" to its subject, and refuses the query for anyone else', async () => {
    const mine = query(collectionGroup(as(env, ALICE), 'players'), where('uid', '==', ALICE));
    await assertSucceeds(getDocs(mine));
    const theirs = query(collectionGroup(as(env, BOB), 'players'), where('uid', '==', ALICE));
    await assertFails(getDocs(theirs));
    await assertFails(getDocs(collectionGroup(as(env, ALICE), 'players')));
  });
});

describe('worlds/{worldId}/server/current', () => {
  it('is read and driven by the players of the world, and by nobody else', async () => {
    await assertSucceeds(getDoc(server(ALICE)));
    await assertFails(getDoc(server(BOB)));
    await assertSucceeds(updateDoc(server(ALICE), { state: 'STOPPING', stateSince: serverTimestamp() }));
    await assertFails(updateDoc(server(BOB), { state: 'STOPPING', stateSince: serverTimestamp() }));
  });

  it('opens without a game, and refuses one', async () => {
    await assertSucceeds(
      updateDoc(server(ALICE), {
        state: 'PROVISIONING', stateSince: serverTimestamp(), startedAt: serverTimestamp(),
        startedBy: ALICE, sessionId: 's1', deadline: new Date(1_800_000_000_000),
      }),
    );
    await assertFails(updateDoc(server(ALICE), { game: 'enshrouded' }));
  });

  it('is never created, by a client of any rank', async () => {
    await assertFails(setDoc(doc(as(env, ROOT), 'worlds', 'w1', 'server', 'other'), { state: 'IDLE' }));
    await assertFails(setDoc(doc(as(env, ALICE), 'worlds', 'w9', 'server', 'current'), { state: 'RUNNING', ip: '1.2.3.4' }));
  });
});

// `isPlayerOf(worldId)` is what stands between a player of one world and
// every other one's roster and session — a version that ignored its argument
// and hardcoded `w1` would pass every test above (they never vary the world)
// while leaving `w2` wide open to `w1`'s players, and reciprocally.
describe('isolation between worlds', () => {
  it('refuses a player of w1 everything on w2', async () => {
    await assertFails(getDoc(worldNamed(ALICE, 'w2')));
    await assertFails(updateDoc(worldNamed(ALICE, 'w2'), { name: 'stolen' }));

    await assertFails(getDoc(playerOf(ALICE, 'w2', BOB)));
    await assertFails(deleteDoc(playerOf(ALICE, 'w2', BOB)));

    await assertFails(getDoc(serverOf(ALICE, 'w2')));
    await assertFails(
      updateDoc(serverOf(ALICE, 'w2'), { state: 'STOPPING', stateSince: serverTimestamp() }),
    );
  });

  it('refuses a player of w2 everything on w1', async () => {
    await assertFails(getDoc(worldNamed(BOB, 'w1')));
    await assertFails(updateDoc(worldNamed(BOB, 'w1'), { name: 'stolen' }));

    await assertFails(getDoc(playerOf(BOB, 'w1', ALICE)));
    await assertFails(deleteDoc(playerOf(BOB, 'w1', ALICE)));

    await assertFails(getDoc(serverOf(BOB, 'w1')));
    await assertFails(
      updateDoc(serverOf(BOB, 'w1'), { state: 'STOPPING', stateSince: serverTimestamp() }),
    );
  });
});
