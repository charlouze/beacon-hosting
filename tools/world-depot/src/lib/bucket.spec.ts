import { describe, expect, it } from 'vitest';
import { savesBucketFrom } from './bucket.js';

describe('savesBucketFrom', () => {
  it('rend le seau nomme', () => {
    expect(savesBucketFrom({ BEACON_SAVES_BUCKET: 'beacon-saves-local' })).toBe('beacon-saves-local');
  });

  // Le seul defaut possible serait la production, et ce depot n'a pas de
  // jumeau : un administrateur qui a oublie la variable en voulant eprouver
  // une adoption contre un MinIO local deposerait dans le vrai seau.
  it('refuse plutot que de retomber sur la production', () => {
    expect(() => savesBucketFrom({})).toThrow(/BEACON_SAVES_BUCKET/);
  });

  // Une variable posee a vide est aussi absente qu'une variable absente —
  // c'est ce que fait `requiredEnv` dans game-depot, et c'est ce qu'un
  // `export BEACON_SAVES_BUCKET=` produit sans qu'on le voie.
  it('traite une valeur vide comme une absence', () => {
    expect(() => savesBucketFrom({ BEACON_SAVES_BUCKET: '' })).toThrow(/BEACON_SAVES_BUCKET/);
  });
});
