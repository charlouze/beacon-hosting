import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Save, type Clock, type SaveStore } from '@beacon/session';
import { pushSave, stopAndPush, type PushDeps } from './push.js';

const NOW = new Date('2026-09-06T20:10:00Z');

let root: string;
let deps: PushDeps;

const deposited = () =>
  Save.of({
    createdAt: NOW,
    game: 'enshrouded',
    objectKey: 'saves/enshrouded/auto/s1/2026-09-06T20-10-00Z.tar.gz',
    sizeBytes: 20_000,
    origin: 'auto',
  });

// Random, not a repeated byte: gzip folds `Buffer.alloc(bytes, 5)` down to a
// couple hundred bytes regardless of `bytes`, which would put every fixture
// below `SAVE_FLOOR_BYTES` and make the floor fire on a push these tests mean
// to succeed. A real save does not compress like a repeated byte either.
//
// Cleared before it is rebuilt: the default `deps` already calls `worldOf`
// once in `beforeEach`, so a second call for the same `root` — as the floor
// test makes, asking for an empty world — would otherwise find its own
// leftover file still on disk and archive that instead of nothing.
const worldOf = (bytes: number): string => {
  const saveDir = join(root, 'savegame');
  rmSync(saveDir, { recursive: true, force: true });
  mkdirSync(saveDir, { recursive: true });
  if (bytes > 0) writeFileSync(join(saveDir, '3ad85aea'), randomBytes(bytes));
  return saveDir;
};

/**
 * Real time, unlike `NOW`: `stopAndPush`'s wait is bounded by wall clock, and a
 * frozen clock never reaches that bound — confirmed by a run that hung this
 * suite before the wait was reviewed back to reading `deps.clock`. Production
 * gets this for free; these tests advance a fake clock instead of waiting on
 * real minutes.
 */
const advancing = (stepMs = 30_000): Clock => {
  let now = NOW.getTime();
  return {
    now: () => {
      const at = new Date(now);
      now += stepMs;
      return at;
    },
  };
};

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'beacon-push-'));
  const store: SaveStore = {
    list: vi.fn(async () => []),
    fetch: vi.fn(async () => undefined),
    deposit: vi.fn(async () => deposited()),
  };

  deps = {
    store,
    report: vi.fn(async () => ({ state: 'RUNNING' as const, deadlineIso: null })),
    probeReady: vi.fn(async () => false),
    touch: vi.fn(async () => undefined),
    sleep: vi.fn(async () => undefined),
    log: vi.fn(),
    clock: { now: () => NOW },
    config: {
      game: 'enshrouded',
      sessionId: 's1',
      saveDir: worldOf(20_000),
      workDir: join(root, 'work'),
      stopFlag: join(root, 'control', 'stop'),
    } as PushDeps['config'],
    shutdownGraceMs: 120_000,
  };
});

describe('pushSave', () => {
  it('archives the world and deposits it under the origin it was given', async () => {
    await pushSave(deps, 'auto');
    const [, draft] = (deps.store.deposit as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(draft).toEqual({
      game: 'enshrouded',
      sessionId: 's1',
      origin: 'auto',
      createdAt: NOW,
    });
  });

  it('tells the control plane what it deposited', async () => {
    await pushSave(deps, 'auto');
    expect(deps.report).toHaveBeenCalledWith({
      phase: 'saved',
      save: {
        objectKey: 'saves/enshrouded/auto/s1/2026-09-06T20-10-00Z.tar.gz',
        sizeBytes: 20_000,
        origin: 'auto',
      },
    });
  });

  // §8, first defense, and the whole point of asking before acting: a suspect
  // archive that gets refused downstream has already left the machine. This one
  // never does.
  it('refuses to deposit an archive under the floor, and deposits nothing', async () => {
    deps = { ...deps, config: { ...deps.config, saveDir: worldOf(0) } };
    await pushSave(deps, 'auto');
    expect(deps.store.deposit).not.toHaveBeenCalled();
    // Never reported as a save — it is reported as a failure instead, covered
    // below. `not.toHaveBeenCalled()` would have made both outcomes look alike.
    expect(deps.report).not.toHaveBeenCalledWith(expect.objectContaining({ phase: 'saved' }));
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('floor'));
  });

  // A push that fails is a push that fails. The evening continues, the world is
  // still on the disk, and the next push is ten minutes away — killing the loop
  // here would give up every save that follows.
  it('survives a deposit that refuses', async () => {
    deps.store.deposit = vi.fn(async () => {
      throw new Error('503 SlowDown');
    });
    await expect(pushSave(deps, 'auto')).resolves.toBeUndefined();
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('503 SlowDown'));
  });

  // The machine is minutes from being destroyed either way; a failure known
  // only to a console on it is a failure nobody ever learns about (§8).
  it('tells the control plane when the floor refuses a push', async () => {
    deps = { ...deps, config: { ...deps.config, saveDir: worldOf(0) } };
    await pushSave(deps, 'auto');
    expect(deps.report).toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'failed', detail: expect.stringContaining('floor') }),
    );
  });

  it('tells the control plane when a deposit fails', async () => {
    deps.store.deposit = vi.fn(async () => {
      throw new Error('503 SlowDown');
    });
    await pushSave(deps, 'auto');
    expect(deps.report).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: 'failed',
        detail: expect.stringContaining('503 SlowDown'),
      }),
    );
  });

  // The deposit already succeeded — the world is safe in the bucket. Turning a
  // report failure into `phase: 'failed'` here would file an
  // AgentReportedFailure about a save that exists, on the one path this task
  // exists to protect (§8).
  it('does not report a successful push as failed when only the report throws', async () => {
    deps = {
      ...deps,
      report: vi.fn(async () => {
        throw new Error('ECONNRESET');
      }),
    };
    await expect(pushSave(deps, 'auto')).resolves.toBeUndefined();
    expect(deps.store.deposit).toHaveBeenCalled();
    expect(deps.report).not.toHaveBeenCalledWith(
      expect.objectContaining({ phase: 'failed' }),
    );
    expect(deps.log).toHaveBeenCalledWith(
      expect.stringContaining('could not report a successful push'),
    );
  });

  // Roughly twenty-four of these accumulate over a four-hour session, on the
  // same disk that holds the world and the game — a work file, not the
  // bucket §8 forbids destroying.
  it('removes the local archive once the deposit has succeeded', async () => {
    await pushSave(deps, 'auto');
    const archive = join(deps.config.workDir, `save-${NOW.getTime()}.tar.gz`);
    expect(existsSync(archive)).toBe(false);
  });
});

describe('stopAndPush', () => {
  beforeEach(() => {
    // The wait below is bounded by wall clock; see `advancing`'s own comment.
    deps = { ...deps, clock: advancing() };
  });

  // §6, and the order is the reason it exists: a folder archived while the game
  // writes into it can be torn. The channel has one verb — this touches a file,
  // and a systemd unit on the host runs `docker stop`. No socket, no api.
  it('asks for the stop before it archives anything', async () => {
    const order: string[] = [];
    deps = { ...deps, touch: vi.fn(async () => void order.push('stop')) };
    deps.store.deposit = vi.fn(async () => {
      order.push('deposit');
      return deposited();
    });
    await stopAndPush(deps);
    expect(order).toEqual(['stop', 'deposit']);
  });

  // A stop request that cannot even be filed must not cost the evening's last
  // save either — the same reasoning §5 gives for pushing when the server
  // never goes quiet applies one step earlier.
  it('archives anyway when the stop request itself fails', async () => {
    deps = {
      ...deps,
      touch: vi.fn(async () => {
        throw new Error('EACCES');
      }),
    };
    await stopAndPush(deps);
    const [, draft] = (deps.store.deposit as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(draft.origin).toBe('pre-shutdown');
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('EACCES'));
  });

  it('waits for the server to stop answering before it archives', async () => {
    let turns = 0;
    deps = { ...deps, probeReady: vi.fn(async () => ++turns < 3) };
    await stopAndPush(deps);
    expect(deps.probeReady).toHaveBeenCalledTimes(3);
    expect(deps.store.deposit).toHaveBeenCalled();
  });

  // A container that will not die must not cost the evening's last save. The
  // wait is bounded and the push happens anyway — a torn archive is a risk, and
  // the previous key is untouched whatever happens (§5).
  it('pushes anyway when the server never goes quiet', async () => {
    deps = {
      ...deps,
      probeReady: vi.fn(async () => true),
      sleep: vi.fn(async () => undefined),
    };
    await stopAndPush(deps);
    expect(deps.store.deposit).toHaveBeenCalled();
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('still answering'));
  });

  it('deposits the last one as pre-shutdown', async () => {
    await stopAndPush(deps);
    const [, draft] = (deps.store.deposit as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(draft.origin).toBe('pre-shutdown');
  });
});
