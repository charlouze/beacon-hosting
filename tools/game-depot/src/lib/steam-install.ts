import { join } from 'node:path';
import { SERVER_BINARY } from './game-depot.js';

export interface InstallMeasure {
  readonly fileCount: number;
  readonly sizeBytes: number;
}

/**
 * The narrow slice of the disk the guided flow needs, and the seam that lets it
 * be tested at all: a real Steam install exists on one machine, weighs
 * gigabytes, and cannot be made to *not* hold the server — which is the case
 * this whole flow exists for.
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

/**
 * Sunkenland's *dedicated server* on Steam. A different application from the
 * game client, installed separately, and confusing the two is the mistake this
 * tool exists to catch: the client is already on the administrator's machine
 * and weighs three times as much.
 */
export const DEDICATED_SERVER_APP_ID = '2667530';

/** Where steamcmd is told to put it, when nothing says otherwise. */
const DEDICATED_SERVER_FOLDER = 'Sunkenland Dedicated Server';

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
 * The install folder, recognised by the one file an install of the dedicated
 * server always carries and no other folder does. The client's own folder sits
 * right next to it in the same `common/`, which is why the binary and not the
 * folder name is what decides.
 */
export function findDedicatedServer(files: LocalFiles, libraries: readonly string[]): string | undefined {
  for (const library of libraries) {
    for (const candidate of files.subdirectories(join(library, 'steamapps', 'common'))) {
      if (files.exists(join(candidate, SERVER_BINARY))) return candidate;
    }
  }
  return undefined;
}

/**
 * Where the printed command tells steamcmd to install. Inside a Steam library's
 * `common/` on purpose, and not somewhere neutral: that is exactly where the
 * next run of this tool sweeps, so the operator has nothing to remember and no
 * path to pass back.
 */
export function suggestedInstallDir(libraries: readonly string[]): string {
  return join(libraries[0] ?? DEFAULT_STEAM_ROOT, 'steamapps', 'common', DEDICATED_SERVER_FOLDER);
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
 * The account Steam is most likely logged in as. Worth digging out of
 * `loginusers.vdf` for one reason: a placeholder in the middle of the command
 * turns a line to paste into a line to edit, and an edited line is where a
 * password gets added.
 *
 * `MostRecent` first, `AutoLogin` after, because the client on the machine this
 * was written against writes the second and not the first — with two accounts
 * in the file, reading only `MostRecent` hands over whichever came first, and
 * the operator learns it from steamcmd rather than from here. Absent either
 * flag, the first account in the file is still returned so the command stays
 * pasteable, but `flagged: false` says plainly that the pick is a coin flip —
 * the ordinary state of a Steam client with more than one account signed in.
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

/**
 * The line an operator pastes. Two of its properties cost an evening each when
 * they are wrong, and neither is visible in the result:
 *
 * `+force_install_dir` comes **before** `+login` because Steam fixes its
 * install root at login — placed after, the option is not refused, it is
 * ignored, and 2.3 GB land in steamcmd's own folder where nothing looks.
 *
 * There is no password parameter here, and there cannot be one. `+login`
 * accepts a password as a second word, and that word lands in the shell
 * history, a plaintext file nothing ever cleans. steamcmd prompts for it, and
 * Steam Guard prompts again regardless, so the argument buys nothing.
 */
export function steamcmdCommandFor(target: { readonly installDir: string; readonly account: string }): string {
  return [
    'steamcmd',
    `+force_install_dir "${target.installDir}"`,
    `+login ${target.account}`,
    `+app_update ${DEDICATED_SERVER_APP_ID} validate`,
    '+quit',
  ].join(' ');
}
