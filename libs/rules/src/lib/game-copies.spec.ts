import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { beforeEach, describe, it } from 'vitest';
import { ALICE, BOB, env, MALLORY, ROOT, as, given, useRulesEnvironment } from './harness.js';

useRulesEnvironment();

const gameCopy = (uid: string | null, game = 'sunkenland') => doc(as(env, uid), 'gameCopies', game);

const RECORDED = { depositedVersion: '25700000', publishedVersion: '25746735' };

describe('gameCopies/{game}', () => {
  beforeEach(async () => {
    await given(env, 'gameCopies/sunkenland', RECORDED);
  });

  // Two public versions and two instants: the screen of any world of that
  // game says from them whether the game waits for its copy.
  it('is read by every user, whatever world they play in', async () => {
    await assertSucceeds(getDoc(gameCopy(ALICE)));
    await assertSucceeds(getDoc(gameCopy(BOB)));
    await assertSucceeds(getDoc(gameCopy(ROOT)));
  });

  it('is read as absent by a user, for a game that keeps no copy', async () => {
    await assertSucceeds(getDoc(gameCopy(ALICE, 'enshrouded')));
  });

  it('is read by nobody who is not a user', async () => {
    await assertFails(getDoc(gameCopy(MALLORY)));
    await assertFails(getDoc(gameCopy(null)));
  });

  it('is written by no user, whatever the write', async () => {
    await assertFails(updateDoc(gameCopy(ALICE), { depositedVersion: '25746735' }));
    await assertFails(setDoc(gameCopy(ALICE), RECORDED));
    await assertFails(deleteDoc(gameCopy(ALICE)));
  });

  it('is written by no admin either', async () => {
    await assertFails(updateDoc(gameCopy(ROOT), { publishedVersion: '25700000' }));
    await assertFails(deleteDoc(gameCopy(ROOT)));
  });

  it('is created by no user for a game that keeps no copy', async () => {
    await assertFails(setDoc(gameCopy(ALICE, 'enshrouded'), RECORDED));
  });
});
