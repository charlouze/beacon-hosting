import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * The identity a tool writes to Firestore with, and never a new secret (§8): the very
 * credential `gcloud auth application-default login` already left on this
 * machine. Against the emulator, nothing here changes — the sdk itself reads
 * `FIRESTORE_EMULATOR_HOST` and never asks the credential for a token.
 *
 * `BEACON_FIREBASE_PROJECT` has no default, for the reason `BEACON_SAVES_BUCKET`
 * has none in `bucket.ts`: this project has one Firebase project and no
 * staging, so a fallback could only fall back onto production.
 */
export function adminFirestore(env: Record<string, string | undefined>): Firestore {
  const projectId = env['BEACON_FIREBASE_PROJECT'];
  if (projectId === undefined || projectId === '') {
    throw new Error(
      'BEACON_FIREBASE_PROJECT is required: name the project, there is no default (production has no twin)',
    );
  }
  const app = initializeApp({ credential: applicationDefault(), projectId }, `admin-firestore-${projectId}`);
  return getFirestore(app);
}

/** Where `adminFirestore` takes its identity from, once it is proven to answer. */
export type AdminIdentity = 'emulator' | 'application-default';

/**
 * Asks Google for a token with the identity `adminFirestore` uses, so that a
 * missing or expired login stops a tool before it starts, and reads nothing of
 * the project. Against the emulator no token is ever asked, so none is here.
 */
export async function proveAdminIdentity(env: Record<string, string | undefined>): Promise<AdminIdentity> {
  if (env['FIRESTORE_EMULATOR_HOST'] !== undefined && env['FIRESTORE_EMULATOR_HOST'] !== '') return 'emulator';
  await applicationDefault().getAccessToken();
  return 'application-default';
}
