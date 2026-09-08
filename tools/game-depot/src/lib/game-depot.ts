import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { create } from 'tar';
import type { Game } from '@beacon/session';
import type { ObjectApi } from '@beacon/scaleway-storage';

/**
 * `<game>/game.tar`. The literal the cloud-init writes into
 * `BEACON_GAME_FILES_KEY` (task 5) — built here, not copied there, because a
 * third literal is a third place the two could quietly drift apart.
 */
export function gameArchiveKeyFor(game: Game): string {
  return `${game}/game.tar`;
}

/**
 * The one file an install of the dedicated server always carries, and an
 * empty or half-copied folder never does. Named for Sunkenland and not
 * looked up per game: this tool has exactly one caller today (§4 decision 2),
 * and a table keyed by `Game` would guess at a second one that does not
 * exist yet.
 *
 * Literally the same value `deploy/cloud-init/src/lib/sunkenland.ts` hands to
 * `wine`, and module boundaries forbid importing it from here. Nothing breaks
 * when the two drift, and the drift is mute: the server never starts, the log
 * filter matches nothing, no identifier is ever written, and the session dies
 * of the provisioning delay with nothing saying why. Exported so a test in
 * each project pins the same literal — the only thing holding the two ends
 * together, exactly as for `gameArchiveKeyFor` above.
 */
export const SERVER_BINARY = 'Sunkenland-DedicatedServer.exe';

export interface PushGameFilesDeps {
  readonly api: ObjectApi;
  readonly game: Game;
  /** The local folder holding an install of the game's dedicated server. */
  readonly from: string;
}

/**
 * Builds the archive from a local install, deposits it, and reads its own
 * deposit back rather than trusting the upload. Refusing the wrong folder
 * happens first and costs nothing; the reread happens last and costs a
 * `list`, never a second `get` — downloading 2.3 GB back would double the
 * price of every push to catch a fault a `ListObjectsV2` already reports.
 */
export async function pushGameFiles(deps: PushGameFilesDeps): Promise<void> {
  if (!existsSync(join(deps.from, SERVER_BINARY))) {
    throw new Error(`${deps.from} does not hold ${SERVER_BINARY}: refusing to push the wrong folder`);
  }

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
