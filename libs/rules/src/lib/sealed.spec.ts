import { assertFails } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { describe, it } from 'vitest';
import { ALICE, env, MALLORY, ROOT, as, useRulesEnvironment } from './harness.js';

const SEALED = ['saves/s1', 'provisioning/sess1', 'agentTokens/sess1', 'health/watchdog'];

useRulesEnvironment();

describe('what leaves the functions never', () => {
  for (const path of SEALED) {
    const [collection, id] = path.split('/');

    // §5: nobody, outside the functions. Tested for the admin too — this is
    // not a privilege, it is a boundary. The Admin SDK is above the rules by
    // construction, so the functions lose nothing.
    it(`refuses ${path} to every client`, async () => {
      for (const uid of [ROOT, ALICE, MALLORY, null]) {
        await assertFails(getDoc(doc(as(env, uid), collection, id)));
        await assertFails(setDoc(doc(as(env, uid), collection, id), { anything: true }));
      }
    });
  }

  // The default deny, and the reason the file ends with it.
  it('refuses a collection nobody thought of', async () => {
    await assertFails(getDoc(doc(as(env, ROOT), 'something', 'new')));
    await assertFails(setDoc(doc(as(env, ROOT), 'something', 'new'), { anything: true }));
  });

  // `server/current` is named, `server/anything-else` is not. A `match` on the
  // collection instead of the document would have opened this one silently.
  it('refuses a second document in the server collection', async () => {
    await assertFails(setDoc(doc(as(env, ALICE), 'server', 'other'), { state: 'IDLE' }));
    await assertFails(getDoc(doc(as(env, ALICE), 'server', 'other')));
  });

  it('refuses a second document in the config collection', async () => {
    await assertFails(setDoc(doc(as(env, ROOT), 'config', 'other'), { anything: true }));
  });
});
