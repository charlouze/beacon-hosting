import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readWorldIdentity } from './world-identity.js';

const dirWith = (...folders: string[]): string => {
  const root = mkdtempSync(join(tmpdir(), 'beacon-world-'));
  for (const folder of folders) mkdirSync(join(root, folder), { recursive: true });
  return root;
};

describe('readWorldIdentity', () => {
  it('lit le nom et le guid du monde pose sur le disque', () => {
    const root = dirWith("Beacon's World~4db51c84-24cf-459e-9e9e-88b8c3a7ce3b");
    expect(readWorldIdentity(root)).toEqual({
      name: "Beacon's World",
      guid: '4db51c84-24cf-459e-9e9e-88b8c3a7ce3b',
    });
  });

  // Le cas ordinaire de l'autre jeu : son monde ne porte aucune identite.
  // Ce n'est pas une panne, et le compagnon ne nomme aucun jeu (§4).
  it('rend null quand le monde ne porte pas d identite', () => {
    const root = dirWith();
    writeFileSync(join(root, '3ad85aea-index'), '{"latest":"3ad85aea"}');
    expect(readWorldIdentity(root)).toBeNull();
  });

  it('rend null sur deux mondes, parce qu il n arbitre pas', () => {
    const root = dirWith('A~4db51c84-24cf-459e-9e9e-88b8c3a7ce3b', 'B~5eb62c95-35df-56af-af9f-99c4d8b4cd4c');
    expect(readWorldIdentity(root)).toBeNull();
  });

  // Le tilde qui separe est le dernier : un monde nomme « A~B » se lit comme
  // le point d'entree de la machine le lit, sinon le compagnon rapporte
  // `failed` sur un serveur correctement demarre.
  it('separe sur le dernier tilde, pour un nom de monde qui en porte un', () => {
    const root = dirWith('A~B~4db51c84-24cf-459e-9e9e-88b8c3a7ce3b');
    expect(readWorldIdentity(root)).toEqual({
      name: 'A~B',
      guid: '4db51c84-24cf-459e-9e9e-88b8c3a7ce3b',
    });
  });

  it('rend null quand ce qui suit le tilde n est pas un guid', () => {
    expect(readWorldIdentity(dirWith('Mon~monde'))).toBeNull();
  });

  it('rend null sur un dossier qui n existe pas, sans lever', () => {
    expect(readWorldIdentity(join(tmpdir(), 'beacon-absent-' + String(process.pid)))).toBeNull();
  });
});

/**
 * Le catalogue ne peut pas dependre en retour du compagnon (scope:catalog ne
 * remonte pas vers scope:app), donc cette liste n'a pas d'endroit ou vivre en
 * partage : elle est dupliquee ici et dans
 * `deploy/cloud-init/src/lib/sunkenland.spec.ts`, sous
 * `describe('l accord entre le compagnon et le catalogue')`.
 *
 * Quatre lecteurs parsent le meme nom de dossier `<nom>~<GUID>` : le
 * catalogue (`refuseWorldLayout`, avant que l'archive parte), le point
 * d'entree bash de la machine, le compagnon ici (`readWorldIdentity`, apres
 * la restauration) et `world-depot`. Une divergence entre catalogue et
 * compagnon est une archive que l'adoption accepte et qu'aucune session ne
 * pourra jamais ouvrir : le catalogue plus permissif dit oui puis rapporte
 * `failed` un soir, le compagnon plus permissif refuse une archive saine.
 *
 * Si cette liste change, la liste jumelle doit changer avec elle.
 */
describe('l accord entre le compagnon et le catalogue', () => {
  const GUID = '4db51c84-24cf-459e-9e9e-88b8c3a7ce3b';
  const names: readonly [string, boolean][] = [
    [`Beacon's World~${GUID}`, true],
    [`A~B~${GUID}`, true],
    ['Worlds', false],
    ['Mon~monde', false],
    [GUID, false],
  ];

  it.each(names)('%s : le compagnon tranche comme le catalogue', (folder, accepted) => {
    const root = dirWith(folder);
    expect(readWorldIdentity(root) !== null).toBe(accepted);
  });
});
