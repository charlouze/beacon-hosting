import { describe, expect, it } from 'vitest';
import { adminFirestore, proveAdminIdentity } from './admin-firestore.js';

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

describe('proveAdminIdentity', () => {
  // L'emulateur ne demande jamais de jeton : exiger une connexion gcloud pour
  // lui bloquerait le developpement local sans rien prouver.
  it("ne demande rien contre l'emulateur", async () => {
    expect(await proveAdminIdentity({ FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' })).toBe('emulator');
  });
});
