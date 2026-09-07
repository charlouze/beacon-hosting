import { execFile } from 'node:child_process';
import { readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { create, extract } from 'tar';

const run = promisify(execFile);

/**
 * One save is one object (§5), so one folder becomes one archive. That is what
 * lets `SaveStore` be three methods and lets a deposit be a single `PutObject`
 * under a key nothing else will ever carry.
 *
 * The library and not the system's `tar`: the same code runs in the image, in
 * the runner and on the machine of whoever wrote it, and `tar` is not the same
 * command on all three. A test that does not run where it is written guards
 * nothing.
 */
export async function packDirectory(directory: string, toFile: string): Promise<void> {
  // Read first, so an absent folder fails here rather than producing a valid
  // archive of nothing — which the floor would then have to catch downstream.
  if (!statSync(directory).isDirectory()) {
    throw new Error(`${directory} is not a directory`);
  }
  // `.` and not `readdirSync(directory)`: an empty folder gives an empty file
  // list, and node-tar refuses to build an archive with none — exactly the
  // folder a world looks like before the game has written to it once. This
  // adds a `Directory ./` entry the file-list form never produced, so
  // `unpackInto` applies the archived directory's own mode to the target —
  // benign for every save this system writes, since none narrows a mode below
  // what the restore already needs.
  await create({ gzip: true, file: toFile, cwd: directory }, ['.']);
}

export async function unpackInto(archive: string, directory: string): Promise<void> {
  await extract({ file: archive, cwd: directory });
}

/**
 * A restore that merges into whatever the folder already holds could leave a
 * stale world sitting next to the one just extracted. Only the folder's
 * contents go — never the folder itself, which may be a mount this process
 * cannot remove.
 */
export function clearDirectory(directory: string): void {
  for (const entry of readdirSync(directory)) {
    rmSync(join(directory, entry), { recursive: true, force: true });
  }
}

/**
 * The game server does not run as root and this process does. Measured on
 * 2026-09-05: without it the autosave writes nothing at all, and the failure is
 * silent — the server looks healthy and the evening is lost at the end.
 *
 * Shelled out because Node's `chown` takes numeric ids and walks nothing: what
 * is wanted here is one recursive call, and the image is ours.
 */
export async function takeOwnership(directory: string, owner: string): Promise<void> {
  await run('chown', ['-R', owner, directory]);
}
