import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { refuseWorldLayout } from '@beacon/cloud-init';
import { buildWorldArchive } from './world-archive.js';

const WORLD = "Beacon's World~4db51c84-24cf-459e-9e9e-88b8c3a7ce3b";

const worldDir = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'beacon-adopt-'));
  mkdirSync(join(root, WORLD), { recursive: true });
  // Une apostrophe et une espace dans le nom : c'est le monde reel, et c'est
  // ce qui casse un script shell ecrit sans guillemets.
  writeFileSync(join(root, WORLD, 'World~0.json'), '{}');
  return root;
};

describe('buildWorldArchive', () => {
  it('archive a partir du dossier donne, et rend ce qu elle contient', async () => {
    const archive = join(mkdtempSync(join(tmpdir(), 'beacon-out-')), 'world.tar.gz');
    const entries = await buildWorldArchive(worldDir(), archive);
    expect(entries.some((entry) => entry.includes(`${WORLD}/World~0.json`))).toBe(true);
  });

  // Le piege mesure : construire depuis le parent donne Worlds/Worlds/<monde>,
  // le serveur ne s'en plaint pas, et il genere un monde vierge par-dessus.
  // Ce test est la preuve que l'archive commence bien au bon niveau.
  it('ne coiffe pas le contenu d un dossier de plus', async () => {
    const archive = join(mkdtempSync(join(tmpdir(), 'beacon-out-')), 'world.tar.gz');
    const entries = await buildWorldArchive(worldDir(), archive);
    expect(refuseWorldLayout('sunkenland', entries)).toBeNull();
  });
});
