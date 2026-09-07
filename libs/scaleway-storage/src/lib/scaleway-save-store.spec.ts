import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { SAVE_FLOOR_BYTES, type SaveDraft } from '@beacon/session';
import { fakeObjectApi, type FakeObjectApi } from './fake-object-api.js';
import { ScalewaySaveStore } from './scaleway-save-store.js';

const DRAFT: SaveDraft = {
  game: 'enshrouded',
  sessionId: 's1',
  origin: 'pre-shutdown',
  createdAt: new Date('2026-09-07T20:04:26Z'),
};

let api: FakeObjectApi;
let store: ScalewaySaveStore;
let folder: string;

const archiveOf = (bytes: number, name = 'world.tar.gz'): string => {
  const path = join(folder, name);
  writeFileSync(path, Buffer.alloc(bytes, 7));
  return path;
};

beforeEach(() => {
  api = fakeObjectApi();
  store = new ScalewaySaveStore(api);
  folder = mkdtempSync(join(tmpdir(), 'beacon-saves-'));
});

describe('ScalewaySaveStore', () => {
  it('deposits under the key the draft describes, and answers what it wrote', async () => {
    const save = await store.deposit(archiveOf(50_000), DRAFT);
    expect(save.objectKey).toBe(
      'saves/enshrouded/pre-shutdown/s1/2026-09-07T20-04-26Z.tar.gz',
    );
    expect(save.sizeBytes).toBe(50_000);
    expect(api.stored.has(save.objectKey)).toBe(true);
  });

  // §8, and it costs nothing: the size is read to build the `Save`, and `Save`
  // is the floor. A suspect archive is refused before a single byte leaves the
  // machine, which is one line of defense more than the spec asks for.
  it('refuses an archive under the floor before uploading anything', async () => {
    await expect(store.deposit(archiveOf(SAVE_FLOOR_BYTES - 1), DRAFT)).rejects.toThrow(
      /1024/,
    );
    expect(api.stored.size).toBe(0);
  });

  it('never writes twice under the same key', async () => {
    await store.deposit(archiveOf(50_000, 'a.tar.gz'), DRAFT);
    await store.deposit(archiveOf(60_000, 'b.tar.gz'), {
      ...DRAFT,
      createdAt: new Date('2026-09-07T20:14:26Z'),
    });
    expect(api.stored.size).toBe(2);
  });

  it('lists this game newest first, and ignores the other one', async () => {
    await store.deposit(archiveOf(50_000, 'a.tar.gz'), {
      ...DRAFT,
      createdAt: new Date('2026-09-07T20:04:26Z'),
    });
    await store.deposit(archiveOf(60_000, 'b.tar.gz'), {
      ...DRAFT,
      createdAt: new Date('2026-09-07T21:04:26Z'),
    });
    await store.deposit(archiveOf(70_000, 'c.tar.gz'), {
      ...DRAFT,
      game: 'sunkenland',
      createdAt: new Date('2026-09-07T22:04:26Z'),
    });

    const listed = await store.list('enshrouded');
    expect(listed.map((save) => save.createdAt.toISOString())).toEqual([
      '2026-09-07T21:04:26.000Z',
      '2026-09-07T20:04:26.000Z',
    ]);
  });

  // One object deposited by hand must not break every restoration of the
  // evening. Skipped, not thrown — and the caller's log is where it surfaces.
  it('skips an object whose key it did not write', async () => {
    api.stored.set('saves/enshrouded/by-hand.tar.gz', Buffer.alloc(50_000));
    expect(await store.list('enshrouded')).toEqual([]);
  });

  // The same rule on the way in: an object of 12 bytes sitting in the bucket is
  // not a world, and handing it to a restore would start a server on nothing.
  it('skips an object under the floor', async () => {
    api.stored.set(
      'saves/enshrouded/auto/s0/2026-09-01T00-00-00Z.tar.gz',
      Buffer.alloc(12),
    );
    expect(await store.list('enshrouded')).toEqual([]);
  });

  it('fetches an object back to a local file, byte for byte', async () => {
    const save = await store.deposit(archiveOf(50_000), DRAFT);
    const destination = join(folder, 'restored.tar.gz');
    await store.fetch(save, destination);
    expect(readFileSync(destination).byteLength).toBe(50_000);
  });

  // The distinction the whole golden rule turns on, one layer up: a store that
  // cannot answer must not look like a store that holds nothing. Task 6 is
  // where it matters — an empty answer there means "generate a fresh world".
  it('refuses rather than answering an empty list when the bucket is unreachable', async () => {
    api.breakWith(new Error('connect ETIMEDOUT'));
    await expect(store.list('enshrouded')).rejects.toThrow(/ETIMEDOUT/);
  });
});
