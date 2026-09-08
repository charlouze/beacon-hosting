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

const RESERVED = ['instanceId', 'ipId', 'ip', 'joinInfo', 'provisionClaimedAt', 'lastError'];

useRulesEnvironment();

/** A whole opening, as `openingFields` writes it, with a field or two changed. */
const opening = (uid: string, overrides: Record<string, unknown> = {}) =>
  updateDoc(doc(as(env, uid), 'server', 'current'), {
    state: 'PROVISIONING',
    stateSince: serverTimestamp(),
    startedAt: serverTimestamp(),
    startedBy: uid,
    sessionId: 's1',
    game: 'enshrouded',
    deadline: Timestamp.fromMillis(1_800_000_000_000),
    ...overrides,
  });

/**
 * What §5's `clearFacts` leaves behind. It nulls `RESERVED_FACTS` and nothing
 * else, so a document back to IDLE still names the session that just ended and
 * the player who opened it — which is the state the two tests below attack.
 */
const idleAfterASessionOfAlice = (): Promise<void> =>
  given(env, 'server/current', {
    state: 'IDLE',
    stateSince: null,
    sessionId: 's1',
    game: 'enshrouded',
    startedBy: ALICE,
    startedAt: null,
    deadline: null,
  });

describe('server/current', () => {
  it('is read by every member and by nobody else', async () => {
    await assertSucceeds(getDoc(doc(as(env, ALICE), 'server', 'current')));
    await assertFails(getDoc(doc(as(env, MALLORY), 'server', 'current')));
    await assertFails(getDoc(doc(as(env, null), 'server', 'current')));
  });

  // §5, and it is the trap that motivates the seed: `resource` is null on a
  // create, so a document a client could create bypasses every field-by-field
  // restriction at once — it would suffice to be born RUNNING with a made-up
  // ip. Tested for an admin too: this one is nobody's privilege.
  //
  // `remove` and not `clearFirestore`: wiping the base would take `members`
  // with it, and then this test would pass because nobody is a member — the
  // right result for the wrong reason, which is the failure mode a refusal
  // suite is worst at noticing.
  it('is never created by a client, member or admin', async () => {
    await remove(env, 'server/current');
    await assertFails(
      setDoc(doc(as(env, ALICE), 'server', 'current'), { state: 'RUNNING', ip: '1.2.3.4' }),
    );
    await assertFails(
      setDoc(doc(as(env, ROOT), 'server', 'current'), { state: 'RUNNING', ip: '1.2.3.4' }),
    );
  });

  it('is never deleted by a client', async () => {
    await assertFails(deleteDoc(doc(as(env, ROOT), 'server', 'current')));
  });

  // What an opening writes (§6 étape 1), through the record's own field list.
  it('accepts an opening a member signs with its own uid', async () => {
    await assertSucceeds(
      updateDoc(doc(as(env, ALICE), 'server', 'current'), {
        state: 'PROVISIONING',
        stateSince: serverTimestamp(),
        startedAt: serverTimestamp(),
        startedBy: ALICE,
        sessionId: 's1',
        game: 'enshrouded',
        deadline: Timestamp.fromMillis(1_800_000_000_000),
      }),
    );
  });

  // §7: the one field attached to a person. The resource is shared on
  // purpose — anyone may stop anyone's session — but nobody opens one in
  // someone else's name.
  it('refuses an opening signed with somebody else', async () => {
    await assertFails(
      updateDoc(doc(as(env, ALICE), 'server', 'current'), {
        state: 'PROVISIONING',
        stateSince: serverTimestamp(),
        startedAt: serverTimestamp(),
        startedBy: BOB,
        sessionId: 's1',
        game: 'enshrouded',
        deadline: Timestamp.fromMillis(1_800_000_000_000),
      }),
    );
  });

  // Backdating, refused without the rules knowing anything about the domain.
  // A literal instant is not `request.time`, whatever its value.
  it('refuses an instant the client chose itself', async () => {
    await assertFails(
      updateDoc(doc(as(env, ALICE), 'server', 'current'), {
        state: 'STOPPING',
        stateSince: Timestamp.fromMillis(1_700_000_000_000),
      }),
    );
  });

  it('accepts the two states that are intentions', async () => {
    await assertSucceeds(
      updateDoc(doc(as(env, ALICE), 'server', 'current'), {
        state: 'STOPPING',
        stateSince: serverTimestamp(),
      }),
    );
  });

  it('refuses the three states that are findings', async () => {
    for (const state of ['RUNNING', 'IDLE', 'FAILED']) {
      await assertFails(
        updateDoc(doc(as(env, ALICE), 'server', 'current'), {
          state,
          stateSince: serverTimestamp(),
        }),
      );
    }
  });

  it('refuses every reserved field, one by one', async () => {
    for (const field of RESERVED) {
      await assertFails(
        updateDoc(doc(as(env, ALICE), 'server', 'current'), { [field]: 'anything' }),
      );
    }
  });

  // The point of writing it whole: a legitimate write plus one reserved field
  // is not "the legitimate part goes through".
  it('sinks a legitimate write that smuggles a reserved field', async () => {
    await assertFails(
      updateDoc(doc(as(env, ALICE), 'server', 'current'), {
        state: 'STOPPING',
        stateSince: serverTimestamp(),
        ip: '51.15.42.7',
      }),
    );
  });

  it('refuses a field nobody declared', async () => {
    await assertFails(
      updateDoc(doc(as(env, ALICE), 'server', 'current'), { nonsense: true }),
    );
  });

  // §5: the template is an admin's. A member who does not write it inherits
  // the default the function applies.
  it('reserves the instance size to an admin', async () => {
    await assertFails(
      updateDoc(doc(as(env, ALICE), 'server', 'current'), { instanceSize: 'PRO2-M' }),
    );
    await assertSucceeds(
      updateDoc(doc(as(env, ROOT), 'server', 'current'), { instanceSize: 'PRO2-M' }),
    );
  });

  // The extension, and the reason `stateSince == request.time` is conditional.
  // Written unconditionally, this rule refuses every extension the product has.
  it('accepts an extension that writes the deadline alone', async () => {
    await assertSucceeds(
      updateDoc(doc(as(env, ALICE), 'server', 'current'), {
        deadline: Timestamp.fromMillis(1_800_003_600_000),
      }),
    );
  });

  it('refuses a visitor everything', async () => {
    await assertFails(
      updateDoc(doc(as(env, MALLORY), 'server', 'current'), {
        state: 'STOPPING',
        stateSince: serverTimestamp(),
      }),
    );
  });

  it('refuses a string past the bound', async () => {
    await assertFails(
      updateDoc(doc(as(env, ALICE), 'server', 'current'), { sessionId: 'x'.repeat(1025) }),
    );
  });

  // The one the field-by-field property is worth nothing without. `startedBy`
  // is the only field attached to a person, and the write that steals it is the
  // one that does not write it: the document is back to IDLE still carrying
  // Alice's name, Bob opens without signing, nothing about `startedBy` moves,
  // and the session is Alice's in the journal. §7 forbids exactly this.
  it('refuses an opening that inherits the previous player as its author', async () => {
    await idleAfterASessionOfAlice();
    await assertFails(
      updateDoc(doc(as(env, BOB), 'server', 'current'), {
        state: 'PROVISIONING',
        stateSince: serverTimestamp(),
        startedAt: serverTimestamp(),
        sessionId: 's2',
        game: 'sunkenland',
        deadline: Timestamp.fromMillis(1_800_000_000_000),
      }),
    );
  });

  // The other half of the same check, and what forbids writing it against the
  // affected keys: Alice opening a second session leaves her own name where it
  // already was. A rule demanding that `startedBy` *move* would refuse every
  // player their second evening.
  it('accepts an opening whose author was already the same player', async () => {
    await idleAfterASessionOfAlice();
    await assertSucceeds(
      updateDoc(doc(as(env, ALICE), 'server', 'current'), {
        state: 'PROVISIONING',
        stateSince: serverTimestamp(),
        startedAt: serverTimestamp(),
        sessionId: 's2',
        game: 'sunkenland',
        deadline: Timestamp.fromMillis(1_800_000_000_000),
      }),
    );
  });

  // The admin's variant of the same opening: `openingFields` appends
  // `instanceSize` when a template was chosen, so this write has to clear the
  // opening check and the one that reserves the field, in the same pass.
  it('accepts an admin opening that chooses a template', async () => {
    await assertSucceeds(opening(ROOT, { instanceSize: 'PRO2-M' }));
  });

  // §5: the save's `objectKey` carries the game, so a `game` rewritten while a
  // session runs files the pre-shutdown save under another world's prefix.
  // That is a world lost, not a label misread.
  it('refuses a session identity rewritten outside an opening', async () => {
    for (const write of [
      { game: 'sunkenland' },
      { sessionId: 's2' },
      { startedAt: serverTimestamp() },
      { startedBy: ALICE },
    ]) {
      await assertFails(updateDoc(doc(as(env, ALICE), 'server', 'current'), write));
    }
  });

  // The twin of `stateSince` above, which had a test where this one had none.
  it('refuses an opening that backdates its start', async () => {
    await assertFails(
      opening(ALICE, { startedAt: Timestamp.fromMillis(1_700_000_000_000) }),
    );
  });

  // The two writes the equality of `state` and `stateSince` exists to refuse,
  // neither of which anything else catches. Rewritten as a one-way implication
  // by a later hand, this suite stays green and the first of them works again.
  it('refuses an instant of state without the state it dates', async () => {
    await assertFails(
      updateDoc(doc(as(env, ALICE), 'server', 'current'), { stateSince: serverTimestamp() }),
    );
  });

  it('refuses a state without the instant it began', async () => {
    await assertFails(
      updateDoc(doc(as(env, ALICE), 'server', 'current'), { state: 'STOPPING' }),
    );
  });

  // `deadline` is the one field a client writes that is not a string, so
  // `bounded` never reaches it. Untyped, it takes anything, at any size.
  it('refuses a deadline that is not an instant', async () => {
    await assertFails(
      updateDoc(doc(as(env, ALICE), 'server', 'current'), { deadline: 'whenever' }),
    );
    await assertFails(
      updateDoc(doc(as(env, ALICE), 'server', 'current'), { deadline: 'x'.repeat(100_000) }),
    );
  });

  // Only the refusal was tested, and a rule written `< 1024` would have passed
  // it. Through a whole opening, because a `sessionId` on its own is refused
  // before its length is ever weighed — and the refusal comes first here so it
  // leaves the document untouched for the acceptance that follows.
  it('weighs the bound at both ends', async () => {
    await assertFails(opening(ALICE, { sessionId: 'x'.repeat(1025) }));
    await assertSucceeds(opening(ALICE, { sessionId: 'x'.repeat(1024) }));
  });
});
