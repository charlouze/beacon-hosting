import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { beforeEach, describe, it } from 'vitest';
import {
  ALICE,
  BOB,
  env,
  MALLORY,
  ROOT,
  as,
  given,
  useRulesEnvironment,
} from './harness.js';

useRulesEnvironment();

const completedSetups = (uid: string | null, game = 'enshrouded') =>
  doc(as(env, uid), 'completedSetups', game);

const KEPT = { setups: [{ sessionId: 's1', durationMs: 300_000 }] };

describe('completedSetups/{game}', () => {
  beforeEach(async () => {
    await given(env, 'completedSetups/enshrouded', KEPT);
  });

  // Durations and session ids, and nothing of a world: a member of any world
  // of that game announces a window drawn from all of them.
  it('is read by every member, whatever world they play in', async () => {
    await assertSucceeds(getDoc(completedSetups(ALICE)));
    await assertSucceeds(getDoc(completedSetups(BOB)));
    await assertSucceeds(getDoc(completedSetups(ROOT)));
  });

  it('is read as absent by a member, for a game that kept nothing yet', async () => {
    await assertSucceeds(getDoc(completedSetups(ALICE, 'sunkenland')));
  });

  it('is read by nobody who is not a member', async () => {
    await assertFails(getDoc(completedSetups(MALLORY)));
    await assertFails(getDoc(completedSetups(null)));
  });

  it('is written by no member, whatever the write', async () => {
    await assertFails(updateDoc(completedSetups(ALICE), { setups: [] }));
    await assertFails(setDoc(completedSetups(ALICE), { setups: [] }));
    await assertFails(deleteDoc(completedSetups(ALICE)));
  });

  it('is written by no admin either', async () => {
    await assertFails(updateDoc(completedSetups(ROOT), { setups: [] }));
    await assertFails(deleteDoc(completedSetups(ROOT)));
  });

  it('is created by no member for a game that kept nothing yet', async () => {
    await assertFails(setDoc(completedSetups(ALICE, 'sunkenland'), KEPT));
  });
});
