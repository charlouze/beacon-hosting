import { readFileSync } from 'node:fs';
import {
  assertFails,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const RULES_PATH = new URL('../../../../firestore.rules', import.meta.url);

/**
 * Every collection the design names. The list is the test: a collection added
 * to the spec and forgotten here would be open on a database nothing else
 * guards until tranche 4.
 */
const DOCUMENTS = [
  'server/current',
  'config/settings',
  'events/whatever',
  'members/alice',
  'saves/whatever',
  'provisioning/sess1',
  'agentTokens/sess1',
  'health/watchdog',
];

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-beacon',
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  // Optional, because beforeAll can fail — emulator absent, port taken — and
  // then this hook throws on an undefined env, burying the real diagnosis
  // under a second error.
  await env?.cleanup();
});

describe('the database is closed until tranche 4', () => {
  // The control case. Without it, a harness talking to nothing would pass
  // every refusal below — the trap tranche 0 caught by running its suite
  // against `allow read, write: if false` first.
  it('still lets the admin path through, so the refusals below mean something', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'server', 'current'), { state: 'IDLE' });
    });
    await env.withSecurityRulesDisabled(async (context) => {
      const snapshot = await getDoc(doc(context.firestore(), 'server', 'current'));
      expect(snapshot.exists()).toBe(true);
    });
  });

  for (const path of DOCUMENTS) {
    const [collection, id] = path.split('/');

    it(`refuses an anonymous read of ${path}`, async () => {
      const db = env.unauthenticatedContext().firestore();
      await assertFails(getDoc(doc(db, collection, id)));
    });

    it(`refuses an authenticated read of ${path}`, async () => {
      const db = env.authenticatedContext('alice').firestore();
      await assertFails(getDoc(doc(db, collection, id)));
    });

    it(`refuses an authenticated write of ${path}`, async () => {
      const db = env.authenticatedContext('alice').firestore();
      await assertFails(setDoc(doc(db, collection, id), { anything: true }));
    });
  }

  it('refuses a collection nobody thought of', async () => {
    const db = env.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(db, 'something', 'new'), { anything: true }));
    await assertFails(getDoc(doc(db, 'something', 'new')));
  });
});
