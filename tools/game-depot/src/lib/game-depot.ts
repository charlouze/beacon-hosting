import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { create } from 'tar';
import type { Game, GameVersion } from '@beacon/session';
import type { GameCopyRecord } from '@beacon/session-record';
import type { ObjectApi } from '@beacon/scaleway-storage';
import { copyApplicationOf } from './copy-application.js';
import { installedCopy } from './steam-manifest.js';

/**
 * `<game>/game.tar`. The literal the cloud-init writes into
 * `BEACON_GAME_FILES_KEY` (task 5) — built here, not copied there, because a
 * third literal is a third place the two could quietly drift apart.
 */
export function gameArchiveKeyFor(game: Game): string {
  return `${game}/game.tar`;
}

export interface PushGameFilesDeps {
  readonly api: ObjectApi;
  /** Where the version of the copy is recorded, once the deposit is read back. */
  readonly record: GameCopyRecord;
  readonly game: Game;
  /** The local folder holding an install of the game's copy. */
  readonly from: string;
}

/**
 * Builds the archive from a local install, deposits it, reads its own deposit
 * back rather than trusting the upload, then records the version it deposited.
 * Everything that can refuse happens before the archive is built, and the
 * version is recorded only for a deposit that was read back: a recorded
 * version never describes an archive this tool did not verify.
 *
 * The reread costs a `list`, never a second `get` — downloading the archive back
 * would double the price of every push to catch a fault a `ListObjectsV2`
 * already reports.
 */
export async function pushGameFiles(deps: PushGameFilesDeps): Promise<GameVersion> {
  const version = await versionToDeposit(deps);
  await depositArchive(deps);
  await recordDeposit(deps, version);
  return version;
}

const onDisk = {
  exists: (path: string) => existsSync(path),
  readText: (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : undefined),
};

/** The version of the install, once nothing is left that could refuse the push. */
async function versionToDeposit(deps: PushGameFilesDeps): Promise<GameVersion> {
  const installed = installedCopy(onDisk, deps.from, copyApplicationOf(deps.game));
  if ('refusal' in installed) throw new Error(`${installed.refusal}: refusing to push`);
  try {
    await deps.record.depositedVersion(deps.game);
  } catch (error) {
    throw new Error(`the record of the copy cannot be reached (${String(error)}): nothing deposited`);
  }
  return installed.version;
}

async function depositArchive(deps: PushGameFilesDeps): Promise<void> {
  const key = gameArchiveKeyFor(deps.game);
  const workDir = mkdtempSync(join(tmpdir(), 'game-depot-'));
  try {
    const archive = join(workDir, 'game.tar');
    // No gzip: these files are already compressed, and re-compressing 2.3 GB
    // would cost minutes of CPU on both ends for nothing.
    await create({ file: archive, cwd: deps.from }, ['.']);
    const sizeBytes = statSync(archive).size;

    await deps.api.put(key, archive);

    const deposited = (await deps.api.list(key)).find((summary) => summary.key === key);
    // A network that drops mid-upload can leave s3 holding an object shorter
    // than what was sent, without the request itself ever failing. 2.3 GB in
    // one `PutObject` is exactly the size where that silence is expensive.
    if (deposited === undefined || deposited.sizeBytes !== sizeBytes) {
      throw new Error(
        `deposited size disagrees with what was pushed: expected ${sizeBytes} bytes, s3 reports ${deposited?.sizeBytes ?? 'nothing'}`,
      );
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

async function recordDeposit(deps: PushGameFilesDeps, version: GameVersion): Promise<void> {
  try {
    await deps.record.recordDeposit(deps.game, version);
  } catch (error) {
    // The archive is new and the recorded version is the old one: the copy
    // reads as behind until a run of this tool records it.
    throw new Error(
      `${gameArchiveKeyFor(deps.game)} is deposited, but its version ${version} was not recorded (${String(error)}): run this again`,
    );
  }
}
