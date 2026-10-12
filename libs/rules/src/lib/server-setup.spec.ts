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

const setup = (uid: string | null) => doc(as(env, uid), 'worlds', 'w1', 'server', 'setup');

const KEPT = {
  sessionId: 's1',
  stepOrder: ['waking', 'restoring-world', 'fetching-game', 'starting-game'],
  step: 'fetching-game',
  stepSince: null,
  activity: null,
  progress: null,
};

describe('worlds/{worldId}/server/setup', () => {
  beforeEach(async () => {
    await given(env, 'worlds/w1/server/setup', KEPT);
  });

  it('is read by a member of its world', async () => {
    await assertSucceeds(getDoc(setup(ALICE)));
  });

  it('is read by an admin who never joined the world', async () => {
    await assertSucceeds(getDoc(setup(ROOT)));
  });

  it('is read by nobody outside its world', async () => {
    await assertFails(getDoc(setup(BOB)));
    await assertFails(getDoc(setup(MALLORY)));
    await assertFails(getDoc(setup(null)));
  });

  it('is written by no member, whatever the write', async () => {
    await assertFails(updateDoc(setup(ALICE), { step: 'starting-game' }));
    await assertFails(setDoc(setup(ALICE), { ...KEPT, progress: 100 }));
    await assertFails(deleteDoc(setup(ALICE)));
  });

  it('is written by no admin either', async () => {
    await assertFails(updateDoc(setup(ROOT), { step: 'starting-game' }));
    await assertFails(deleteDoc(setup(ROOT)));
  });

  it('is created by no member on a world that holds none yet', async () => {
    await assertFails(setDoc(doc(as(env, BOB), 'worlds', 'w2', 'server', 'setup'), KEPT));
  });
});
