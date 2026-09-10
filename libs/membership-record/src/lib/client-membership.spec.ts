import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { readFileSync } from 'node:fs';
import { deleteApp, initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  setDoc,
  setLogLevel,
  type Firestore,
} from 'firebase/firestore';
import {
  clientMembershipRecord,
  type ClientMembershipRecord,
  type IdentitySource,
} from './client-membership.js';
import type { Identity, Viewer } from './viewer.js';

// The record keeps its listener on `members/{uid}` open for as long as the
// identity is signed in — a browser tab owns it until it closes. Deleting a
// test's client app while that listener is attached makes the sdk log an
// "Uncaught Error in snapshot listener: ... Firestore shutting down": a
// teardown artefact of this suite, not a defect. Silencing the sdk's own
// logger, here only, keeps the output pristine.
setLogLevel('silent');

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-beacon',
    firestore: {
      rules: readFileSync(new URL('../../../../firestore.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

/**
 * The port's double. A Google popup does not open in a runner, which is the
 * whole reason `IdentitySource` exists: here the test itself says who is at
 * the keyboard, and `emit` is the only thing production has no equivalent of.
 */
function identityDouble(): IdentitySource & { emit(identity: Identity | null): void } {
  const subscribers = new Set<(identity: Identity | null) => void>();
  return {
    watch(on) {
      subscribers.add(on);
      return () => {
        subscribers.delete(on);
      };
    },
    signIn: async () => undefined,
    signOut: async () => undefined,
    emit(identity) {
      for (const subscriber of subscribers) subscriber(identity);
    },
  };
}

const clientApps: FirebaseApp[] = [];

function connection(options?: { readonly mockUserToken: 'owner' }): Firestore {
  const app = initializeApp({ projectId: 'demo-beacon' }, `client-${clientApps.length}`);
  clientApps.push(app);
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080, options);
  return db;
}

/**
 * A connection where the "owner" mock token bypasses the rules — the same
 * bypass `env.withSecurityRulesDisabled` uses internally, minus its lifecycle:
 * that helper tears its context down the instant its callback returns, so a
 * `record` built inside it and used after, as every test here does, fails with
 * "the client has already been terminated".
 *
 * §9: what is under test is the translation, not the authorisation. The
 * refusals have their own suites, and they are tasks 2 to 5.
 */
const ownerConnection = (): Firestore => connection({ mockUserToken: 'owner' });

/** Subject to the rules, and signed in to nothing — refused by any version of
 *  `firestore.rules`, which is all the one test that uses it needs. */
const unauthenticatedConnection = (): Firestore => connection();

let db: Firestore;
let identity: ReturnType<typeof identityDouble>;
let record: ClientMembershipRecord;

beforeEach(async () => {
  await env.clearFirestore();
  db = ownerConnection();
  identity = identityDouble();
  record = clientMembershipRecord(db, identity);
});

afterEach(async () => {
  await Promise.all(clientApps.splice(0).map((app) => deleteApp(app)));
});

const given = (path: string, data: Record<string, unknown>): Promise<void> =>
  setDoc(doc(db, path), data);

const read = async (path: string): Promise<Record<string, unknown> | null> =>
  (await getDoc(doc(db, path))).data() ?? null;

/**
 * Both channels of a subscription, side by side. A refused read must never
 * reach a screen disguised as a viewer, so no test here may watch one without
 * watching the other.
 */
function watch(subject: ClientMembershipRecord): { seen: Viewer[]; failures: Error[] } {
  const seen: Viewer[] = [];
  const failures: Error[] = [];
  subject.watchViewer(
    (viewer) => seen.push(viewer),
    (error) => failures.push(error),
  );
  return { seen, failures };
}

describe('the client face of the membership record', () => {
  // A signed-in identity with a document is a member, and the record says so
  // without the caller ever naming a collection.
  it('turns an identity and its document into a member', async () => {
    await given('members/alice', { role: 'admin', email: 'alice@example.com' });
    const { seen } = watch(record);

    identity.emit({ uid: 'alice', name: 'Alice' });

    await vi.waitFor(() => expect(seen.at(-1)?.kind).toBe('member'));
    expect(seen.at(-1)).toEqual({
      kind: 'member',
      member: { uid: 'alice', name: 'Alice', role: 'admin', steamId: null },
    });
  });

  // The whole point of the visitor case: the document is absent, the read is
  // allowed anyway (a subject may read its own), and nothing hangs.
  it('turns an identity with no document into a visitor', async () => {
    const { seen } = watch(record);

    identity.emit({ uid: 'mallory', name: 'Mallory' });

    await vi.waitFor(() =>
      expect(seen.at(-1)).toEqual({
        kind: 'visitor',
        identity: { uid: 'mallory', name: 'Mallory' },
      }),
    );
  });

  // Signing out is not "the document went away": it is a different state, and
  // the screen of tranche 5 shows a different thing for each.
  it('goes back to signed out when the identity goes away', async () => {
    await given('members/alice', { role: 'player' });
    const { seen } = watch(record);
    identity.emit({ uid: 'alice', name: 'Alice' });
    await vi.waitFor(() => expect(seen.at(-1)?.kind).toBe('member'));

    identity.emit(null);

    await vi.waitFor(() => expect(seen.at(-1)).toEqual({ kind: 'signed-out' }));
  });

  // And the listener is detached, not merely ignored: a read left running on
  // `members/{uid}` after a sign-out is one the rules refuse, retried for as
  // long as the tab stays open. A write that moves nothing is the proof —
  // this connection would echo it locally before the server even acknowledged
  // it, so a still-attached listener could not stay quiet through the await.
  it('stops reading the document once the identity is gone', async () => {
    await given('members/alice', { role: 'player' });
    const { seen } = watch(record);
    identity.emit({ uid: 'alice', name: 'Alice' });
    await vi.waitFor(() => expect(seen.at(-1)?.kind).toBe('member'));
    identity.emit(null);
    await vi.waitFor(() => expect(seen.at(-1)).toEqual({ kind: 'signed-out' }));
    const published = seen.length;

    await given('members/alice', { role: 'admin' });

    expect(seen).toHaveLength(published);
    expect(seen.at(-1)).toEqual({ kind: 'signed-out' });
  });

  // Live, because a role revoked in the console must take effect without a
  // reload — that is the §5 argument for keeping the role in a document rather
  // than in a custom claim.
  it('follows the document while it changes', async () => {
    await given('members/alice', { role: 'player' });
    const { seen } = watch(record);
    identity.emit({ uid: 'alice', name: 'Alice' });
    await vi.waitFor(() => expect(seen.at(-1)?.kind).toBe('member'));

    await given('members/alice', { role: 'admin' });

    await vi.waitFor(() => expect(seen.at(-1)).toMatchObject({ member: { role: 'admin' } }));
  });

  // A refused read ends the listener: nothing further will ever be published,
  // so a record that swallowed the error would leave a signed-in person facing
  // a sign-in button forever. The caller is told instead, and the viewer is
  // left alone rather than guessing — the rules let a subject read its own
  // document, so a refusal says the read broke, not that the reader is a
  // visitor.
  it('hands a refused read to the caller rather than falling silent', async () => {
    const refused = clientMembershipRecord(unauthenticatedConnection(), identity);
    const { seen, failures } = watch(refused);

    identity.emit({ uid: 'alice', name: 'Alice' });

    await vi.waitFor(() => expect(failures).toHaveLength(1));
    // The code, not the message: the emulator answers with its rules trace —
    // "false for 'get' @ L6" — which moves every time the rules gain a line.
    expect((failures[0] as { readonly code?: string }).code).toBe('permission-denied');
    expect(seen.at(-1)).toEqual({ kind: 'signed-out' });
  });

  // §5: the one write a member makes on its own document. The record writes the
  // field alone, because the rules refuse the whole write if it touches
  // anything else — and that refusal is task 2's test, not this one's.
  it('declares a steam id without touching anything else', async () => {
    await given('members/alice', { role: 'player', email: 'alice@example.com' });
    identity.emit({ uid: 'alice', name: 'Alice' });

    await record.declareSteamId('76561197965918116');

    const stored = (await read('members/alice')) as Record<string, unknown>;
    expect(stored).toEqual({
      role: 'player',
      email: 'alice@example.com',
      steamId: '76561197965918116',
    });
  });

  // Nothing to write it on. Failing loudly beats writing `members/undefined`.
  it('refuses to declare a steam id while nobody is signed in', async () => {
    await expect(record.declareSteamId('76561197965918116')).rejects.toThrow();
  });
});
