import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Save, type SaveStore } from '@beacon/session';
import { fakeObjectApi, type FakeObjectApi } from '@beacon/scaleway-storage';
import { packDirectory } from './archive.js';
import { runRestore, type RestoreDeps } from './restore.js';

const NOW = new Date('2026-09-06T20:00:00Z');

let root: string;
let deps: RestoreDeps;
let deposited: string;

const saveOf = (createdAt: string, sizeBytes = 20_000) =>
  Save.of({
    createdAt: new Date(createdAt),
    game: 'enshrouded',
    objectKey: `saves/enshrouded/auto/s0/${createdAt.replace(/[:.]/g, '-')}.tar.gz`,
    sizeBytes,
    origin: 'auto',
  });

beforeEach(async () => {
  root = mkdtempSync(join(tmpdir(), 'beacon-restore-'));

  // A real archive, so what is asserted is that the world lands on disk — not
  // that a double was called.
  const world = join(root, 'source');
  mkdirSync(world);
  writeFileSync(join(world, '3ad85aea'), Buffer.alloc(20_000, 9));
  deposited = join(root, 'deposited.tar.gz');
  await packDirectory(world, deposited);

  const saveDir = join(root, 'savegame');
  mkdirSync(saveDir);

  const store: SaveStore = {
    // Newest first, matching what `SaveStore.list` documents (§4) — this mock
    // is the fixture the next double or adapter gets copied from.
    list: vi.fn(async () => [saveOf('2026-09-06T19:00:00Z'), saveOf('2026-09-05T20:00:00Z')]),
    fetch: vi.fn(async (_save, toFile) => {
      writeFileSync(toFile, readFileSync(deposited));
    }),
    deposit: vi.fn(async () => saveOf('2026-09-06T20:00:00Z')),
  };

  deps = {
    store,
    report: vi.fn(async () => ({ state: 'PROVISIONING' as const, deadlineIso: null })),
    takeOwnership: vi.fn(async () => undefined),
    log: vi.fn(),
    config: {
      game: 'enshrouded',
      saveDir,
      saveOwner: '4711:4711',
      workDir: join(root, 'work'),
    } as RestoreDeps['config'],
    clock: { now: () => NOW },
  };
});

describe('runRestore', () => {
  it('lays the newest save down in the folder the game reads', async () => {
    await runRestore(deps);
    expect(readFileSync(join(root, 'savegame', '3ad85aea')).byteLength).toBe(20_000);
    const fetched = (deps.store.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(fetched.createdAt).toEqual(new Date('2026-09-06T19:00:00Z'));
  });

  // Measured 2026-09-05: `rclone` fills the folder as root and the server writes
  // as 4711. Without this the autosave writes nothing, silently, and the evening
  // is lost at the end rather than at the start.
  it('gives the folder to the user the game server runs as', async () => {
    await runRestore(deps);
    expect(deps.takeOwnership).toHaveBeenCalledWith(join(root, 'savegame'), '4711:4711');
  });

  // The mock above is already well-behaved; this one is not, on purpose — it
  // pins the defensive `reduce` in `runRestore` rather than trusting order.
  it('picks the newest even when the store answers out of order', async () => {
    deps.store.list = vi.fn(async () => [
      saveOf('2026-09-05T20:00:00Z'),
      saveOf('2026-09-06T19:00:00Z'),
    ]);
    await runRestore(deps);
    const fetched = (deps.store.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(fetched.createdAt).toEqual(new Date('2026-09-06T19:00:00Z'));
  });

  // The first session of a world, and it is legitimate. The game generates one.
  it('succeeds without restoring when this game has never been saved', async () => {
    deps.store.list = vi.fn(async () => []);
    await expect(runRestore(deps)).resolves.toBeUndefined();
    expect(deps.store.fetch).not.toHaveBeenCalled();
  });

  // Same silent failure as above, on the one boot with no earlier save to fall
  // back on: a fresh volume hands this folder to nobody, the game generates a
  // world into it, and the autosave writes nothing at all.
  it('still gives the folder to the game server even on a first save', async () => {
    deps.store.list = vi.fn(async () => []);
    await runRestore(deps);
    expect(deps.takeOwnership).toHaveBeenCalledWith(join(root, 'savegame'), '4711:4711');
  });

  // **The one that matters.** An unreachable bucket must not look like an empty
  // one. Taken for "never saved", it would let the game generate a fresh world;
  // the next push would deposit that world as the newest save, and the session
  // after would restore it. Nothing would have been overwritten and the world
  // would be gone all the same (§8, first defense).
  it('refuses to start when the bucket could not answer', async () => {
    deps.store.list = vi.fn(async () => {
      throw new Error('connect ETIMEDOUT');
    });
    await expect(runRestore(deps)).rejects.toThrow(/ETIMEDOUT/);
    expect(deps.takeOwnership).not.toHaveBeenCalled();
  });

  it('tells the control plane why it refused, before it gives up', async () => {
    deps.store.list = vi.fn(async () => {
      throw new Error('connect ETIMEDOUT');
    });
    await expect(runRestore(deps)).rejects.toThrow();
    expect(deps.report).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'failed', detail: expect.stringContaining('ETIMEDOUT') }),
    );
  });

  // A half-written world is worse than none: the game would load it, the player
  // would build on it, and the push at the end would make it the newest save.
  it('refuses when the download fails halfway', async () => {
    deps.store.fetch = vi.fn(async () => {
      throw new Error('unexpected end of stream');
    });
    await expect(runRestore(deps)).rejects.toThrow(/unexpected end of stream/);
  });

  // A mount that has not been pre-created must not fail the extract: there is
  // no second chance at "this game has a save", and the folder is made here
  // rather than assumed.
  it('creates the save directory before extracting into it, even when a save exists', async () => {
    rmSync(deps.config.saveDir, { recursive: true, force: true });
    await expect(runRestore(deps)).resolves.toBeUndefined();
    expect(readFileSync(join(deps.config.saveDir, '3ad85aea')).byteLength).toBe(20_000);
  });

  // A restore that merges into whatever the folder already holds would let a
  // stale world from a different save survive next to the one just restored.
  it('clears whatever the folder already holds before restoring into it', async () => {
    writeFileSync(join(deps.config.saveDir, 'stale-from-another-world'), 'x');
    await runRestore(deps);
    expect(existsSync(join(deps.config.saveDir, 'stale-from-another-world'))).toBe(false);
  });

  // A failure here must not boot the game silently: the same best-effort
  // report every other failure path already sends.
  it('tells the control plane when it cannot prepare the work directory', async () => {
    writeFileSync(deps.config.workDir, 'not a directory');
    await expect(runRestore(deps)).rejects.toThrow();
    expect(deps.report).toHaveBeenCalledWith(expect.objectContaining({ phase: 'failed' }));
  });

  it('tells the control plane when it cannot prepare a fresh world', async () => {
    deps.store.list = vi.fn(async () => []);
    deps = {
      ...deps,
      takeOwnership: vi.fn(async () => {
        throw new Error('chown refused');
      }),
    };
    await expect(runRestore(deps)).rejects.toThrow(/chown refused/);
    expect(deps.report).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'failed', detail: expect.stringContaining('chown refused') }),
    );
  });

  it('tells the control plane when it cannot take ownership after a restore', async () => {
    deps = {
      ...deps,
      takeOwnership: vi.fn(async () => {
        throw new Error('chown refused');
      }),
    };
    await expect(runRestore(deps)).rejects.toThrow(/chown refused/);
    expect(deps.report).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'failed', detail: expect.stringContaining('chown refused') }),
    );
  });

  // The game that downloads its own files leaves `gameFiles` undefined, and
  // the existing path above must not move a byte for it.
  it('restores the world alone when no game files are configured', async () => {
    await runRestore(deps);
    expect(deps.store.fetch).toHaveBeenCalledTimes(1);
  });
});

describe('runRestore with game files', () => {
  let gameDir: string;
  let games: FakeObjectApi;
  let gamePacked: string;

  beforeEach(async () => {
    gameDir = join(root, 'game');
    const source = join(root, 'game-source');
    mkdirSync(source);
    writeFileSync(join(source, 'Sunkenland-DedicatedServer.exe'), Buffer.alloc(1_000, 7));
    gamePacked = join(root, 'game.tar.gz');
    await packDirectory(source, gamePacked);

    games = fakeObjectApi();
    games.stored.set('sunkenland/game.tar', readFileSync(gamePacked));

    deps = {
      ...deps,
      gameFiles: { api: games, directory: gameDir, objectKey: 'sunkenland/game.tar' },
    };
  });

  // The same transfer a save already makes, to another folder, from the other
  // bucket. Not a second code path: a second call.
  it('unpacks the game files before the game container may start', async () => {
    await runRestore(deps);
    expect(readdirSync(gameDir)).toContain('Sunkenland-DedicatedServer.exe');
  });

  // §8, first defense: as long as this exits non-zero there is no game
  // container at all. A game whose files are missing must not start some other
  // way, on a half-written install.
  it('refuses when the game files cannot be fetched', async () => {
    games.breakWith(new Error('connect ETIMEDOUT'));
    await expect(runRestore(deps)).rejects.toThrow();
    expect(deps.report).toHaveBeenCalledWith(expect.objectContaining({ phase: 'failed' }));
  });

  // Measured 2026-09-05 on the world folder: the server runs as an unprivileged
  // uid, the unpack runs as root, and the oblivion is silent. Same line, for
  // the folder the server reads its files from.
  it('gives the game folder to the uid the server runs as', async () => {
    await runRestore(deps);
    expect(deps.takeOwnership).toHaveBeenCalledWith(gameDir, deps.config.saveOwner);
  });

  // §7: the key this machine holds reads this bucket and never writes to it.
  // Asserted explicitly rather than "nothing threw" — a test whose only check
  // is the absence of an exception passes on the day it stops testing anything.
  it('never writes to the bucket it reads', async () => {
    const putSpy = vi.spyOn(games, 'put');
    await runRestore(deps);
    expect(putSpy).not.toHaveBeenCalled();
  });

  // The bigger transfer first: a failure then wastes less work already done.
  it('fetches the game files before the world', async () => {
    const order: string[] = [];
    const originalGet = games.get.bind(games);
    games.get = vi.fn(async (key, toFile) => {
      order.push('game');
      await originalGet(key, toFile);
    });
    deps.store.fetch = vi.fn(async (_save, toFile) => {
      order.push('world');
      writeFileSync(toFile, readFileSync(deposited));
    });
    await runRestore(deps);
    expect(order).toEqual(['game', 'world']);
  });
});
