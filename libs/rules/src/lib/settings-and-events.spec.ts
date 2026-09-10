import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import { describe, it } from 'vitest';
import {
  ALICE,
  BOB,
  env,
  MALLORY,
  ROOT,
  as,
  given,
  remove,
  useRulesEnvironment,
} from './harness.js';

const EVENT = () => ({
  type: 'SessionStarted',
  sessionId: 's1',
  detail: 'enshrouded',
  actor: { uid: ALICE, name: 'Alice' },
  at: serverTimestamp(),
  expiresAt: Timestamp.fromMillis(1_800_000_000_000),
});

useRulesEnvironment();

describe('config/settings', () => {
  // Every member reads it: the front needs it to compute a closing time (§5).
  it('is read by every member and by nobody else', async () => {
    await assertSucceeds(getDoc(doc(as(env, ALICE), 'config', 'settings')));
    await assertFails(getDoc(doc(as(env, MALLORY), 'config', 'settings')));
    await assertFails(getDoc(doc(as(env, null), 'config', 'settings')));
  });

  it('is written by an admin and by no other member', async () => {
    await assertSucceeds(
      updateDoc(doc(as(env, ROOT), 'config', 'settings'), { sessionDurationMs: 7_200_000 }),
    );
    await assertFails(
      updateDoc(doc(as(env, ALICE), 'config', 'settings'), { sessionDurationMs: 7_200_000 }),
    );
  });

  // §4: an admin who could write this one would redirect where the game
  // machines report their state — a harder consequence than the drift
  // `rulesVersion` guards, and the reason both are subtracted together.
  it('refuses even an admin the endpoint the deployment stamps', async () => {
    await assertFails(
      updateDoc(doc(as(env, ROOT), 'config', 'settings'), {
        agentEndpoint: 'https://attacker.invalid/report',
      }),
    );
    await assertFails(
      updateDoc(doc(as(env, ROOT), 'config', 'settings'), {
        sessionDurationMs: 7_200_000,
        agentEndpoint: 'https://attacker.invalid/report',
      }),
    );
  });

  // §4: written by the deployment at every merge. An admin who edited it by
  // hand would desynchronise every open tab without knowing.
  it('refuses even an admin the version the deployment stamps', async () => {
    await assertFails(
      updateDoc(doc(as(env, ROOT), 'config', 'settings'), { rulesVersion: 'forged' }),
    );
    await assertFails(
      updateDoc(doc(as(env, ROOT), 'config', 'settings'), {
        sessionDurationMs: 7_200_000,
        rulesVersion: 'forged',
      }),
    );
  });

  // `remove` and not `clearFirestore`, for the reason server-current.spec.ts
  // gives: a wiped `members` would make this pass without proving anything.
  it('is never created nor deleted by a client', async () => {
    await assertFails(deleteDoc(doc(as(env, ROOT), 'config', 'settings')));
    await remove(env, 'config/settings');
    await assertFails(
      setDoc(doc(as(env, ROOT), 'config', 'settings'), { sessionDurationMs: 7_200_000 }),
    );
  });
});

describe('events', () => {
  it('is read by every member and by nobody else', async () => {
    await assertSucceeds(getDoc(doc(as(env, ALICE), 'events', 'e1')));
    await assertFails(getDoc(doc(as(env, MALLORY), 'events', 'e1')));
    await assertFails(getDoc(doc(as(env, null), 'events', 'e1')));
  });

  it('is created by a member who signs it with its own uid', async () => {
    await assertSucceeds(setDoc(doc(as(env, ALICE), 'events', 'e1'), EVENT()));
  });

  // §7: the audit would be worth nothing if one could sign another's name.
  it('refuses an entry signed with somebody else', async () => {
    await assertFails(
      setDoc(doc(as(env, ALICE), 'events', 'e1'), {
        ...EVENT(),
        actor: { uid: BOB, name: 'Bob' },
      }),
    );
  });

  it('refuses a visitor an entry', async () => {
    await assertFails(
      setDoc(doc(as(env, MALLORY), 'events', 'e1'), {
        ...EVENT(),
        actor: { uid: MALLORY, name: 'Mallory' },
      }),
    );
  });

  // A journal one can rewrite is not a journal.
  it('is never modified nor deleted, by anyone', async () => {
    await given(env, 'events/e1', { ...EVENT(), at: Timestamp.fromMillis(1_700_000_000_000) });
    await assertFails(updateDoc(doc(as(env, ALICE), 'events', 'e1'), { detail: 'other' }));
    await assertFails(deleteDoc(doc(as(env, ALICE), 'events', 'e1')));
    await assertFails(updateDoc(doc(as(env, ROOT), 'events', 'e1'), { detail: 'other' }));
    await assertFails(deleteDoc(doc(as(env, ROOT), 'events', 'e1')));
  });

  // The bound is the answer to §5's resource exhaustion: the most open
  // collection of the system is also a way to inflate the bill.
  it('refuses a string past the bound', async () => {
    await assertFails(
      setDoc(doc(as(env, ALICE), 'events', 'e1'), { ...EVENT(), detail: 'x'.repeat(1025) }),
    );
    await assertFails(
      setDoc(doc(as(env, ALICE), 'events', 'e1'), { ...EVENT(), type: 'x'.repeat(1025) }),
    );
    await assertFails(
      setDoc(doc(as(env, ALICE), 'events', 'e1'), { ...EVENT(), sessionId: 'x'.repeat(1025) }),
    );
    await assertFails(
      setDoc(doc(as(env, ALICE), 'events', 'e1'), {
        ...EVENT(),
        actor: { uid: ALICE, name: 'x'.repeat(1025) },
      }),
    );
  });

  // The bound is inclusive, and nothing else in the suite would notice a `<`
  // written where `bounded()` has a `<=` — every other string it carries is
  // far from the ceiling.
  it('accepts a string of exactly the bound', async () => {
    await assertSucceeds(
      setDoc(doc(as(env, ALICE), 'events', 'e1'), { ...EVENT(), detail: 'x'.repeat(1024) }),
    );
  });

  it('refuses an entry with no actor at all', async () => {
    const { actor, ...withoutActor } = EVENT();
    await assertFails(setDoc(doc(as(env, ALICE), 'events', 'e1'), withoutActor));
  });
});
