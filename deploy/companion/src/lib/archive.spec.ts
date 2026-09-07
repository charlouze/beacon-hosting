import { mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { packDirectory, unpackInto } from './archive.js';

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'beacon-archive-'));
});

describe('the save archive', () => {
  it('packs a folder and lays it back down, file for file', async () => {
    const world = join(root, 'savegame');
    mkdirSync(world);
    writeFileSync(join(world, '3ad85aea'), Buffer.alloc(20_000, 3));
    writeFileSync(join(world, '3ad85aea-index'), Buffer.alloc(512, 4));

    const archive = join(root, 'world.tar.gz');
    await packDirectory(world, archive);

    const restored = join(root, 'restored');
    mkdirSync(restored);
    await unpackInto(archive, restored);

    expect(readFileSync(join(restored, '3ad85aea')).byteLength).toBe(20_000);
    expect(readFileSync(join(restored, '3ad85aea-index')).byteLength).toBe(512);
  });

  // Not an optimisation: an archive of a folder that holds nothing is what a
  // world looks like before the game has written once, and the floor of `Save`
  // is what stops it from being deposited. This test pins that such an archive
  // really does come out small enough for the floor to catch it (§8).
  it('packs an empty folder into something under the floor', async () => {
    const world = join(root, 'empty');
    mkdirSync(world);
    const archive = join(root, 'empty.tar.gz');
    await packDirectory(world, archive);
    expect(statSync(archive).size).toBeLessThan(1024);
  });

  it('refuses to pack a folder that is not there', async () => {
    await expect(packDirectory(join(root, 'absent'), join(root, 'x.tar.gz'))).rejects.toThrow();
  });
});
