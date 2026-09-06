import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';
import { clientSessionRecord, type ClientSessionRecord } from './lib/client-session.js';

export * from './lib/client-session.js';

export interface ConnectOptions {
  readonly app: FirebaseApp;
  /** Set in development. The emulator is this project's preproduction (§10). */
  readonly emulator?: { readonly host: string; readonly port: number };
}

/**
 * The one call `apps/web` makes. It exists so that no screen ever imports a
 * Firestore sdk: the closure of §4 says `apps/web` does not, and a convenience
 * that made it call `getFirestore` itself would break it on its first line.
 */
export function connectSessionRecord(options: ConnectOptions): ClientSessionRecord {
  const db = getFirestore(options.app);
  if (options.emulator) {
    connectFirestoreEmulator(db, options.emulator.host, options.emulator.port);
  }
  return clientSessionRecord(db);
}
