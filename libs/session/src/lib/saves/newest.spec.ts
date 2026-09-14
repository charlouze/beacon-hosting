import { describe, expect, it } from 'vitest';
import { Save } from './save.js';
import { newestSave } from './newest.js';

const save = (iso: string, origin: 'auto' | 'manual' | 'pre-shutdown' = 'auto'): Save =>
  Save.of({
    createdAt: new Date(iso),
    game: 'enshrouded',
    objectKey: `saves/enshrouded/${origin}/s1/${iso}.tar.gz`,
    sizeBytes: 50_000,
    origin,
  });

describe('newestSave', () => {
  it('rend celle que la prochaine session restaurerait', () => {
    const chosen = newestSave([save('2026-09-07T20:00:00Z'), save('2026-09-07T22:31:16Z')]);
    expect(chosen?.createdAt).toEqual(new Date('2026-09-07T22:31:16Z'));
  });

  // Le port promet « newest first ». On ne s'y fie pas : une restauration qui
  // dependrait d'un invariant qu'elle ne peut pas verifier est une restauration
  // qui se trompe de monde le jour ou l'adapter change d'ordre.
  it('ne fait pas confiance a l ordre de la liste', () => {
    const chosen = newestSave([save('2026-09-07T20:00:00Z'), save('2026-09-08T09:00:00Z'), save('2026-09-07T21:00:00Z')]);
    expect(chosen?.createdAt).toEqual(new Date('2026-09-08T09:00:00Z'));
  });

  // Mesure de la tranche 3 : la session 2 a repris la pre-shutdown parce
  // qu'elle etait la plus recente, et pour aucune autre raison.
  it('ne prefere aucune origine, seulement l instant', () => {
    const chosen = newestSave([save('2026-09-08T09:00:00Z', 'pre-shutdown'), save('2026-09-08T10:00:00Z', 'auto')]);
    expect(chosen?.origin).toBe('auto');
  });

  it('rend undefined sur une liste vide, ce qui est le premier soir d un monde', () => {
    expect(newestSave([])).toBeUndefined();
  });
});
