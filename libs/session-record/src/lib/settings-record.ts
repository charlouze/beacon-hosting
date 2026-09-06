import type { SessionSettings } from '@beacon/session';
import type { Firestore } from 'firebase-admin/firestore';
import { settingsFrom, SETTINGS_DOC } from './fields.js';

export interface SettingsStore {
  read(): Promise<SessionSettings>;
}

/**
 * `config/settings`, admin face. It never writes: the document is seeded at
 * deployment and edited by an admin from the browser (§5). A function that
 * could write it would be a function that can change what a session costs.
 */
export function settingsStore(db: Firestore): SettingsStore {
  return {
    async read(): Promise<SessionSettings> {
      const snapshot = await db.doc(SETTINGS_DOC).get();
      return settingsFrom(snapshot.data() ?? {});
    },
  };
}
