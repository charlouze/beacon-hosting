import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (name: string) =>
  readFileSync(new URL(`../../../../${name}`, import.meta.url), 'utf8');

/**
 * Deployment happens on merge (§10), so what the deployed configuration points
 * at is what the database players play on runs. These tests are the only thing
 * in the repository that reads that configuration as text — a wrong line in
 * `firebase.json` breaks no other test, and no build.
 */
describe('the deployed configuration', () => {
  it('points at the closed rules and never at another file', () => {
    expect(JSON.parse(read('firebase.json')).firestore.rules).toBe('firestore.rules');
  });

  // The last line of defence, and the one a new collection falls through to.
  // Its absence would not fail a single other test in this folder.
  it('ends on a default deny', () => {
    const rules = read('firestore.rules');
    expect(rules).toContain('allow read, write: if false;');
    expect(rules).not.toContain('if true');
  });

  // A permissive twin of `firestore.rules` used to live here, and this is what
  // keeps it gone: deployment happens on merge (§10), so a file that opens
  // everything is one wrong configuration line away from opening the database
  // players play on.
  //
  // `firebase.dev.json` stays, and it is not the same hazard: what it now
  // declares is three emulators the deployed configuration has no business
  // knowing about — functions, hub, and the ui a dev session is conducted by
  // watching. `tools/dev-session` reads its ports and refuses to guess them.
  // What matters is not that a second configuration exists, it is that no
  // configuration points anywhere but at the rules that get deployed.
  it('lets no configuration point at rules that are not the deployed ones', () => {
    expect(existsSync(new URL('../../../../firestore.dev.rules', import.meta.url))).toBe(false);
    expect(JSON.parse(read('firebase.dev.json')).firestore.rules).toBe('firestore.rules');
  });
});
