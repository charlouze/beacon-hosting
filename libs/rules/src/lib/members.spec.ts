import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { describe, it } from 'vitest';
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

/**
 * A membership enrolled from the Firebase console with no address recorded —
 * which §5 makes the only way in until the administration screen exists, the
 * first admin included. `email` and `steamId` are null rather than absent:
 * whoever types the document follows §5, and the subject fills its identifier
 * in afterwards.
 *
 * Nothing in this repository produces this literal, and nothing can: its
 * writer is a human in a console, above the rules. So it guards one side only,
 * and it is the side that matters — it fails when the *rules* stop accepting a
 * member the product enrols every time, which is the day that member can no
 * longer declare its steam id. The counterpart is prose, in §5 and in task 13
 * of the tranche 4 plan, which say what to type.
 */
const CONSOLE_ENROLLED_ADMIN = { role: 'admin', email: null, steamId: null };
const DANA = 'dana';

describe('members', () => {
  // §5: an admin, or the subject. Nobody else, and this is the collection
  // whose read is narrower than membership — what it protects is the email
  // addresses.
  it('lets the subject read its own document', async () => {
    await assertSucceeds(getDoc(doc(as(env, ALICE), 'members', ALICE)));
  });

  it('lets an admin read anyone', async () => {
    await assertSucceeds(getDoc(doc(as(env, ROOT), 'members', ALICE)));
  });

  it('refuses one member the document of another', async () => {
    await assertFails(getDoc(doc(as(env, ALICE), 'members', BOB)));
  });

  // The visitor's own read is allowed and comes back empty. It has to be:
  // that non-existence is exactly what tells the interface it is a visitor,
  // and a refusal there would be indistinguishable from a broken rule.
  it('lets a visitor read its own absent document', async () => {
    await assertSucceeds(getDoc(doc(as(env, MALLORY), 'members', MALLORY)));
  });

  it('refuses an anonymous read', async () => {
    await assertFails(getDoc(doc(as(env, null), 'members', ALICE)));
  });

  // The one that closes self-enrolment. PRODUCT.md: no free registration.
  it('refuses a visitor enrolling itself', async () => {
    await assertFails(
      setDoc(doc(as(env, MALLORY), 'members', MALLORY), { role: 'player' }),
    );
  });

  // §7, named: nobody grants themselves admin.
  it('refuses a member promoting itself', async () => {
    await assertFails(
      updateDoc(doc(as(env, ALICE), 'members', ALICE), { role: 'admin' }),
    );
  });

  it('lets the subject declare its own steam id', async () => {
    await assertSucceeds(
      updateDoc(doc(as(env, ALICE), 'members', ALICE), {
        steamId: '76561197965918116',
      }),
    );
  });

  // The whole write sinks, even though one half of it was legitimate. This is
  // the field-by-field property the tranche 0 probe measured.
  it('sinks a write that carries a steam id and a role together', async () => {
    await assertFails(
      updateDoc(doc(as(env, ALICE), 'members', ALICE), {
        steamId: '76561197965918116',
        role: 'admin',
      }),
    );
  });

  it("refuses one member writing another's steam id", async () => {
    await assertFails(
      updateDoc(doc(as(env, ALICE), 'members', BOB), {
        steamId: '76561197965918116',
      }),
    );
  });

  // §5, line 783: the subject, and nobody else — an admin included, and on the
  // create path as much as on the update one. Being allowed to manage
  // membership is not being allowed to declare someone's Steam identifier; the
  // member does that itself, afterwards. `steamId` being a legitimate key of
  // the document, only the ownership rule refuses these two.
  it("refuses an admin writing a member's steam id", async () => {
    await assertFails(
      setDoc(doc(as(env, ROOT), 'members', 'carol'), {
        role: 'player',
        email: 'carol@example.com',
        steamId: '76561197965918116',
      }),
    );
    await assertFails(
      updateDoc(doc(as(env, ROOT), 'members', BOB), {
        steamId: '76561197965918116',
      }),
    );
  });

  it('lets an admin add, promote and remove', async () => {
    await assertSucceeds(
      setDoc(doc(as(env, ROOT), 'members', 'carol'), {
        role: 'player',
        email: 'carol@example.com',
      }),
    );
    await assertSucceeds(
      updateDoc(doc(as(env, ROOT), 'members', BOB), { role: 'admin' }),
    );
    await assertSucceeds(deleteDoc(doc(as(env, ROOT), 'members', BOB)));
  });

  it('refuses a member adding or removing anyone', async () => {
    await assertFails(
      setDoc(doc(as(env, ALICE), 'members', 'carol'), { role: 'player' }),
    );
    await assertFails(deleteDoc(doc(as(env, ALICE), 'members', BOB)));
  });

  // The types are checked, the strings are bounded (§4). Not a format check:
  // §5 says a steam id is a public integer with nothing to usurp.
  it('refuses a role outside the two the model knows', async () => {
    await assertFails(
      setDoc(doc(as(env, ROOT), 'members', 'carol'), { role: 'owner' }),
    );
    await assertFails(
      updateDoc(doc(as(env, ROOT), 'members', BOB), { role: 'owner' }),
    );
  });

  // The keys of §5 and no others, on both paths, but by two different clauses.
  // On a create it is the admin's own predicate, narrower than the model. On an
  // update the foreign key has to be in the document already — nothing a client
  // writes can add one, since the ownership predicates would see it — so what
  // this pins is the only reachable use of the model's own `hasOnly`: a
  // document that drifted is frozen until someone cleans it up.
  it('refuses a field the model does not name', async () => {
    await assertFails(
      setDoc(doc(as(env, ROOT), 'members', 'carol'), {
        role: 'player',
        email: 'carol@example.com',
        nickname: 'carol',
      }),
    );

    await given(env, `members/${BOB}`, {
      role: 'player',
      email: 'bob@example.com',
      nickname: 'bob',
    });
    await assertFails(
      updateDoc(doc(as(env, ROOT), 'members', BOB), { role: 'admin' }),
    );
  });

  // An admin invites by address, so a member without one is not a member the
  // model knows. Same reason to test it: the constraint is invisible until a
  // refusal.
  it('refuses a member enrolled without an email', async () => {
    await assertFails(
      setDoc(doc(as(env, ROOT), 'members', 'carol'), { role: 'player' }),
    );
  });

  // The console is above the rules, so nothing refuses the document a human
  // types there until its subject tries to touch it. Declaring a steam id is
  // the whole chain that names an admin in the game, and the first admin —
  // enrolled that way, with no address — is the first to have to declare one.
  it('lets a member enrolled without an address declare its own steam id', async () => {
    await given(env, `members/${DANA}`, CONSOLE_ENROLLED_ADMIN);
    await assertSucceeds(
      updateDoc(doc(as(env, DANA), 'members', DANA), {
        steamId: '76561197965918116',
      }),
    );
  });

  // Same document, the other writer: `isValidMember` is evaluated on the
  // resulting document, which still carries those nulls whatever the admin
  // touches.
  it('lets an admin manage a document enrolled without an address', async () => {
    await given(env, `members/${DANA}`, CONSOLE_ENROLLED_ADMIN);
    await assertSucceeds(
      updateDoc(doc(as(env, ROOT), 'members', DANA), { role: 'player' }),
    );
    await assertSucceeds(
      updateDoc(doc(as(env, ROOT), 'members', DANA), { role: 'admin' }),
    );
  });

  // The null belongs to a console enrolment, and the console never comes
  // through `create` — it writes with the Admin SDK, above the rules. So the
  // opening stops at `update`, and "an admin invites by address" stays true
  // everywhere the rules actually govern enrolment. The second half is the
  // repair: that document is not frozen, an address can still be added later.
  it('refuses an admin enrolling with a null email', async () => {
    await assertFails(
      setDoc(doc(as(env, ROOT), 'members', 'carol'), {
        role: 'player',
        email: null,
      }),
    );

    await given(env, `members/${DANA}`, CONSOLE_ENROLLED_ADMIN);
    await assertSucceeds(
      updateDoc(doc(as(env, ROOT), 'members', DANA), {
        email: 'dana@example.com',
      }),
    );
  });

  // Accepting a null is not dropping the ceiling: the bound still applies to
  // every value that *is* a string, on both paths and on both fields.
  //
  // Three cells and not four — a steam id past the bound on a create is
  // refused before the bound is read, by the ownership rule that forbids an
  // admin writing one at all, which the test above already pins.
  it('refuses a string past the bound', async () => {
    await assertFails(
      updateDoc(doc(as(env, ALICE), 'members', ALICE), {
        steamId: 'x'.repeat(1025),
      }),
    );
    await assertFails(
      updateDoc(doc(as(env, ROOT), 'members', BOB), {
        email: 'x'.repeat(1025),
      }),
    );
    await assertFails(
      setDoc(doc(as(env, ROOT), 'members', 'carol'), {
        role: 'player',
        email: 'x'.repeat(1025),
      }),
    );
  });
});
