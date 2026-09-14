import { describe, expect, it } from 'vitest';
import { Save } from '@beacon/session';
import { chooseSave } from './choose.js';

const save = (iso: string): Save =>
  Save.of({
    createdAt: new Date(iso),
    game: 'sunkenland',
    objectKey: `saves/sunkenland/auto/s1/${iso.replace(/[:.]/g, '-')}.tar.gz`,
    sizeBytes: 50_000,
    origin: 'auto',
  });

describe('chooseSave', () => {
  const history = [save('2026-09-07T20:00:00Z'), save('2026-09-08T09:00:00Z')];

  // Le defaut est ce que la prochaine session restaurerait, et c'est le meme
  // calcul que le compagnon appelle — pas un second qui lui ressemble (§8).
  it('rend par defaut ce que la prochaine session restaurerait', () => {
    expect(chooseSave(history)?.createdAt).toEqual(new Date('2026-09-08T09:00:00Z'));
  });

  // Sans ca, reparer un recouvrement est impossible : ce qu'il faut reprendre
  // est la cle precedente, justement pas la derniere.
  it('rend celle qu on designe, meme si elle n est pas la derniere', () => {
    const wanted = history[0].objectKey;
    expect(chooseSave(history, wanted)?.objectKey).toBe(wanted);
  });

  it('rend undefined pour une cle que l historique ne porte pas', () => {
    expect(chooseSave(history, 'saves/sunkenland/auto/s1/jamais.tar.gz')).toBeUndefined();
  });

  it('rend undefined sur un historique vide', () => {
    expect(chooseSave([])).toBeUndefined();
  });
});
