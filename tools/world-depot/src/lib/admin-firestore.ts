import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

/**
 * The identity `adopt` writes with, and never a new secret (§8): the very
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
  const app = initializeApp({ credential: applicationDefault(), projectId }, `world-depot-${projectId}`);
  return getFirestore(app);
}
