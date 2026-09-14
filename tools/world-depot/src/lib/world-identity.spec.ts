import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildWorldArchive } from './world-archive.js';
import { worldIdentity } from './world-identity.js';

const folders = (...names: readonly string[]): string => {
  const root = mkdtempSync(join(tmpdir(), 'beacon-identity-'));
  for (const name of names) {
    mkdirSync(join(root, name), { recursive: true });
    writeFileSync(join(root, name, 'World~0.json'), '{}');
  }
  return root;
};

const archiveOf = async (root: string): Promise<string> => {
  const file = join(mkdtempSync(join(tmpdir(), 'beacon-out-')), 'world.tar.gz');
  await buildWorldArchive(root, file);
  return file;
};

describe('worldIdentity', () => {
  // Le nom que les joueurs lisent dans la liste des serveurs, et le GUID
  // auquel leurs personnages restent attaches : les deux se figent a la
  // creation, donc les deux s'annoncent tels quels — ni './' devant, ni '/'
  // derriere.
  it('lit le nom et le GUID du dossier de tete, sans la decoration de tar', async () => {
    const root = folders("Beacon's World~4db51c84-24cf-459e-9e9e-88b8c3a7ce3b");
    const identity = await worldIdentity(await archiveOf(root));
    expect(identity).toEqual({ name: "Beacon's World", guid: '4db51c84-24cf-459e-9e9e-88b8c3a7ce3b' });
  });

  // Un nom imprime a cote d'une cle est pire que pas de nom du tout : il
  // nommerait a faux ce que `retrieve` vient de prendre ou ce qu `adopt`
  // s'apprete a recouvrir.
  it('ne devine pas quand l archive porte deux dossiers a identite', async () => {
    const root = folders(
      "Beacon's World~4db51c84-24cf-459e-9e9e-88b8c3a7ce3b",
      'Autre~1111ffff-24cf-459e-9e9e-88b8c3a7ce3b',
    );
    expect(await worldIdentity(await archiveOf(root))).toBeUndefined();
  });

  // Le tilde qui separe est le dernier, comme sur la machine : sinon le nom
  // imprime a cote de la cle est tronque.
  it('separe sur le dernier tilde, pour un nom de monde qui en porte un', async () => {
    const root = folders('A~B~4db51c84-24cf-459e-9e9e-88b8c3a7ce3b');
    expect(await worldIdentity(await archiveOf(root))).toEqual({
      name: 'A~B',
      guid: '4db51c84-24cf-459e-9e9e-88b8c3a7ce3b',
    });
  });

  it('ne devine pas quand aucun dossier ne porte de GUID', async () => {
    expect(await worldIdentity(await archiveOf(folders('Worlds')))).toBeUndefined();
  });
});
