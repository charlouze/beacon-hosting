import { describe, expect, it } from 'vitest';
import { adminFirestore } from './admin-firestore.js';

describe('adminFirestore', () => {
  // Le seul defaut possible serait la production, et ce depot n'a pas de
  // jumeau — meme convention que `savesBucketFrom`.
  it('refuse sans BEACON_FIREBASE_PROJECT nomme', () => {
    expect(() => adminFirestore({})).toThrow(/BEACON_FIREBASE_PROJECT/);
  });

  it('traite une valeur vide comme une absence', () => {
    expect(() => adminFirestore({ BEACON_FIREBASE_PROJECT: '' })).toThrow(/BEACON_FIREBASE_PROJECT/);
  });
});
