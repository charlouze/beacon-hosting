import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (name: string) =>
  readFileSync(new URL(`../../../../${name}`, import.meta.url), 'utf8');

/**
 * A permissive rules file exists in this repository, for the emulator. These
 * two tests are what keeps it there: deployment happens on merge (§10), so
 * pointing the deployed configuration at it would open the database players
 * play on, in one commit, with nothing else to notice.
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
});
