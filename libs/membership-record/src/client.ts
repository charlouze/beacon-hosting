import type { FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';
import { clientMembershipRecord, type ClientMembershipRecord } from './lib/client-membership.js';
import { firebaseIdentity } from './lib/firebase-identity.js';

export * from './lib/viewer.js';
export * from './lib/client-membership.js';

/**
 * The Auth emulator's default port. `ConnectOptions` names the Firestore one
 * because that is the only port a caller has ever had a reason to move; a
 * second knob would be a setting nobody turns.
 */
const AUTH_EMULATOR_PORT = 9099;

export interface ConnectOptions {
  readonly app: FirebaseApp;
  /** Set in development. The emulator is this project's preproduction (§10). */
  readonly emulator?: { readonly host: string; readonly port: number };
}

/**
 * The one call `apps/web` makes. It exists so that no screen ever imports a
 * Firebase sdk: the closure of §4 says `apps/web` does not, and signing in
 * lives here rather than in the app for exactly that reason — the `Actor` of
 * every event comes from the Google profile, and building it in a screen would
 * put the Auth sdk back where the closure forbids it.
 */
export function connectMembershipRecord(options: ConnectOptions): ClientMembershipRecord {
  const db = getFirestore(options.app);
  const auth = getAuth(options.app);
  if (options.emulator) {
    connectFirestoreEmulator(db, options.emulator.host, options.emulator.port);
    connectAuthEmulator(auth, `http://${options.emulator.host}:${AUTH_EMULATOR_PORT}`);
  }
  return clientMembershipRecord(db, firebaseIdentity(auth));
}
