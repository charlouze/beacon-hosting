import { delimiter, join } from 'node:path';
import type { Game } from '@beacon/session';
import { manifestPathFor } from './steam-manifest.js';

export interface InstallMeasure {
  readonly fileCount: number;
  readonly sizeBytes: number;
}

/**
 * The narrow slice of the disk the guided flow needs, and the seam that lets it
 * be tested at all: a real Steam install exists on one machine, weighs
 * gigabytes, and cannot be made to *not* hold the install — the case where
 * the tool installs it itself.
 */
export interface LocalFiles {
  exists(path: string): boolean;
  /** The file's text, or `undefined` when there is no such file. */
  readText(path: string): string | undefined;
  /** Absolute paths of the directories directly under this one. */
  subdirectories(path: string): readonly string[];
  /** Everything under this folder, recursively. */
  measure(path: string): InstallMeasure;
}

export const DEFAULT_STEAM_ROOT = 'C:\\Program Files (x86)\\Steam';

/**
 * Every library Steam knows, the default one first. Reading
 * `libraryfolders.vdf` rather than assuming the default folder is not
 * thoroughness: an 8 GB client and a 2.3 GB server routinely land on different
 * drives, and a search that only looks at `C:` reports nothing installed on a
 * machine where the server sits on `D:`.
 */
export function steamLibraries(files: LocalFiles, steamRoot: string): readonly string[] {
  const declared = files.readText(join(steamRoot, 'steamapps', 'libraryfolders.vdf')) ?? '';
  // Steam doubles every backslash in that file. Read literally, `D:\\Games`
  // stays unusable and the drive is silently never visited.
  const paths = [...declared.matchAll(/"path"\s+"(.+?)"/g)].map((match) => match[1].replaceAll('\\\\', '\\'));
  return [...new Set([steamRoot, ...paths])];
}

/**
 * The install of an application, recognised by the manifest steamcmd writes
 * inside the folder it installs. A game client sitting next to it in the same
 * `common/` carries no such file, whatever it is named.
 */
export function findInstall(files: LocalFiles, libraries: readonly string[], app: string): string | undefined {
  for (const library of libraries) {
    for (const candidate of files.subdirectories(join(library, 'steamapps', 'common'))) {
      if (files.exists(manifestPathFor(candidate, app))) return candidate;
    }
  }
  return undefined;
}

/**
 * Where a first install of a game's copy goes: in the first library's
 * `common/`, where `findInstall` looks next time, under a name no Steam client
 * takes for an application of its own.
 */
export function installDirFor(libraries: readonly string[], game: Game): string {
  return join(libraries[0] ?? DEFAULT_STEAM_ROOT, 'steamapps', 'common', `beacon-${game}`);
}

/**
 * What `discoverSteamAccount` found, and how much that finding is worth. The
 * name alone cannot be told apart from a real pick: a caller that only reads
 * `.name` cannot tell a machine with one flagged account from one with two
 * unflagged accounts where the first happened to be taken.
 */
export interface DiscoveredSteamAccount {
  readonly name: string;
  /** True when `MostRecent` or `AutoLogin` singled this account out from the rest. */
  readonly flagged: boolean;
  /** How many accounts `loginusers.vdf` lists at all — the guess is a coin flip only past one. */
  readonly accountCount: number;
}

/**
 * The account Steam is most likely logged in as, which steamcmd logs in with
 * unless --steam-account names another.
 *
 * `MostRecent` first, `AutoLogin` after, because the client on the machine this
 * was written against writes the second and not the first — with two accounts
 * in the file, reading only `MostRecent` hands over whichever came first, and
 * the operator learns it from steamcmd rather than from here. Absent either
 * flag, the first account in the file is still returned, but `flagged: false`
 * says plainly that the pick is a coin flip — the ordinary state of a Steam
 * client with more than one account signed in.
 */
export function discoverSteamAccount(files: LocalFiles, steamRoot: string): DiscoveredSteamAccount | undefined {
  const users = files.readText(join(steamRoot, 'config', 'loginusers.vdf')) ?? '';
  const accounts = [...users.matchAll(/"AccountName"\s+"([^"]+)"([\s\S]*?)(?="AccountName"|$)/g)];
  if (accounts.length === 0) return undefined;
  const flagged =
    accounts.find((account) => /"MostRecent"\s+"1"/.test(account[2])) ??
    accounts.find((account) => /"AutoLogin"\s+"1"/.test(account[2]));
  const chosen = flagged ?? accounts[0];
  return { name: chosen[1], flagged: flagged !== undefined, accountCount: accounts.length };
}

export interface SteamcmdTarget {
  readonly installDir: string;
  readonly account: string;
  readonly app: string;
}

/**
 * What steamcmd is launched with, one argument per element: the install
 * folder stays whole whatever spaces it holds. Two properties cost an evening
 * each when they are wrong, and neither is visible in the result:
 *
 * `+force_install_dir` comes **before** `+login` because Steam fixes its
 * install root at login — placed after, the option is not refused, it is
 * ignored, and the download lands in steamcmd's own folder where nothing looks.
 *
 * There is no password here, and there cannot be one: steamcmd asks for it in
 * the operator's terminal, and Steam Guard asks again regardless.
 *
 * No `validate`, which would reread every local file at each update.
 */
export function steamcmdArgumentsFor(target: SteamcmdTarget): readonly string[] {
  return ['+force_install_dir', target.installDir, '+login', target.account, '+app_update', target.app, '+quit'];
}

/**
 * steamcmd.exe in the first folder of the PATH that holds it. The `.exe` and
 * nothing else: it is the one file `spawn` launches without a shell.
 */
export function findSteamcmd(
  pathVariable: string | undefined,
  exists: (path: string) => boolean,
): string | undefined {
  for (const entry of (pathVariable ?? '').split(delimiter)) {
    // Windows allows a PATH entry wrapped in double quotes.
    const folder = entry.replace(/^"(.*)"$/, '$1');
    if (folder === '') continue;
    const candidate = join(folder, 'steamcmd.exe');
    if (exists(candidate)) return candidate;
  }
  return undefined;
}
