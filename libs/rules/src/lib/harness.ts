import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, setDoc, type DocumentData } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach } from 'vitest';

const RULES_PATH = new URL('../../../../firestore.rules', import.meta.url);

/**
 * Not the `Firestore` of `firebase/firestore`: `@firebase/rules-unit-testing`
 * carries its own copy of the SDK types, and the two only look alike — naming
 * the app's type here is a compile error, not a widening.
 */
type TestFirestore = ReturnType<RulesTestContext['firestore']>;

/**
 * The cast every rules suite shares. `MALLORY` is authenticated and absent
 * from `members`: the visitor, who holds a valid Firebase token and nothing
 * else, and against whom most of the refusals are written.
 */
export const ROOT = 'root';
export const ALICE = 'alice';
export const BOB = 'bob';
export const MALLORY = 'mallory';

export const rulesEnvironment = (): Promise<RulesTestEnvironment> =>
  initializeTestEnvironment({
    projectId: 'demo-beacon',
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });

/**
 * The environment of the file being run. It is an ES module live binding: a
 * suite reads it as a plain value, and sees what `useRulesEnvironment` put
 * there.
 */
export let env: RulesTestEnvironment;

export const as = (
  env: RulesTestEnvironment,
  uid: string | null,
): TestFirestore =>
  (uid === null
    ? env.unauthenticatedContext()
    : env.authenticatedContext(uid)
  ).firestore();

export const given = (
  env: RulesTestEnvironment,
  path: string,
  data: DocumentData,
): Promise<void> =>
  env.withSecurityRulesDisabled((context) =>
    setDoc(doc(context.firestore(), path), data),
  );

export const remove = (
  env: RulesTestEnvironment,
  path: string,
): Promise<void> =>
  env.withSecurityRulesDisabled((context) =>
    deleteDoc(doc(context.firestore(), path)),
  );

/**
 * The two documents §5 says are seeded at deployment and never created by a
 * client, plus the three members the suites act as.
 *
 * Their fields are present and null rather than filled: §9 forbids a date or a
 * duration in a rules test, and the rules never read a value here — they are
 * security, not business. What matters is that the keys exist, because a field
 * that is absent does not read the same way in a diff as one that is null.
 */
const seed = async (): Promise<void> => {
  await given(env, `members/${ROOT}`, {
    role: 'admin',
    email: 'root@example.com',
  });
  await given(env, `members/${ALICE}`, {
    role: 'player',
    email: 'alice@example.com',
  });
  await given(env, `members/${BOB}`, {
    role: 'player',
    email: 'bob@example.com',
  });
  await given(env, 'server/current', {
    state: 'IDLE',
    stateSince: null,
    sessionId: null,
    startedBy: null,
    startedAt: null,
    deadline: null,
    game: null,
    instanceId: null,
    ipId: null,
    ip: null,
    joinInfo: null,
    provisionClaimedAt: null,
    lastError: null,
  });
  await given(env, 'config/settings', {
    sessionDurationMs: null,
    extensionStepMs: null,
    extensionWindowMs: null,
    defaultInstanceSize: null,
    tariffPerHour: null,
    rulesVersion: null,
    agentEndpoint: null,
  });
};

/**
 * Call once at the top of a rules suite, above its `describe`. Without it
 * `env` stays undefined and the first test says so loudly.
 */
export const useRulesEnvironment = (): void => {
  beforeAll(async () => {
    env = await rulesEnvironment();
  });

  afterAll(async () => {
    // Optional, because beforeAll can fail — emulator absent, port taken — and
    // then this hook throws on an undefined env, burying the real diagnosis
    // under a second error.
    await env?.cleanup();
  });

  beforeEach(async () => {
    await env.clearFirestore();
    await seed();
  });
};
