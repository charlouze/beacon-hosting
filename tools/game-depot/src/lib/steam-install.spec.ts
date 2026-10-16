import { delimiter, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { inMemoryFiles } from './local-files.spec-helper.js';
import {
  discoverSteamAccount,
  findInstall,
  findSteamcmd,
  installDirFor,
  steamLibraries,
  steamcmdArgumentsFor,
} from './steam-install.js';
import { manifestPathFor } from './steam-manifest.js';

const DEFAULT_STEAM = 'C:\\Program Files (x86)\\Steam';
const SECOND_LIBRARY = 'D:\\SteamLibrary';

/**
 * The shape Steam actually writes: every backslash doubled. Read naively, the
 * second library becomes `D:SteamLibrary` and the search silently never looks
 * at the drive where a 2.3 GB server most often lands.
 */
const LIBRARY_FOLDERS_VDF = `"libraryfolders"
{
\t"0"
\t{
\t\t"path"\t\t"C:\\\\Program Files (x86)\\\\Steam"
\t\t"label"\t\t""
\t}
\t"1"
\t{
\t\t"path"\t\t"D:\\\\SteamLibrary"
\t\t"label"\t\t""
\t}
}
`;

const LOGIN_USERS_VDF = `"users"
{
\t"76561190000000001"
\t{
\t\t"AccountName"\t\t"an-old-account"
\t\t"MostRecent"\t\t"0"
\t\t"AutoLogin"\t\t"0"
\t}
\t"76561190000000002"
\t{
\t\t"AccountName"\t\t"the-one-who-owns-the-game"
\t\t"MostRecent"\t\t"1"
\t\t"AutoLogin"\t\t"0"
\t}
}
`;

/**
 * What the client on this machine actually writes: two accounts, no
 * `MostRecent` anywhere. Reading only that key hands over the wrong account,
 * and the operator finds out from steamcmd rather than from here.
 */
const LOGIN_USERS_WITHOUT_MOST_RECENT = `"users"
{
\t"76561190000000001"
\t{
\t\t"AccountName"\t\t"an-old-account"
\t\t"AutoLogin"\t\t"0"
\t}
\t"76561190000000002"
\t{
\t\t"AccountName"\t\t"the-one-who-owns-the-game"
\t\t"AutoLogin"\t\t"1"
\t}
}
`;

/**
 * The ordinary state of a Steam client with more than one account signed in
 * over the years: neither flag is set on either. Reading only `.name` off the
 * result cannot be told apart from a real pick, which is why the pick must
 * say `flagged: false` here.
 */
const LOGIN_USERS_TWO_UNFLAGGED = `"users"
{
\t"76561190000000001"
\t{
\t\t"AccountName"\t\t"an-old-account"
\t}
\t"76561190000000002"
\t{
\t\t"AccountName"\t\t"the-one-who-owns-the-game"
\t}
}
`;

const libraryFoldersAt = (steamRoot: string): string => join(steamRoot, 'steamapps', 'libraryfolders.vdf');
const loginUsersAt = (steamRoot: string): string => join(steamRoot, 'config', 'loginusers.vdf');
const commonFolder = (library: string, name: string): string => join(library, 'steamapps', 'common', name);

describe('the Steam libraries', () => {
  it('reads every library out of libraryfolders.vdf, unescaping its doubled backslashes', () => {
    const files = inMemoryFiles({ [libraryFoldersAt(DEFAULT_STEAM)]: LIBRARY_FOLDERS_VDF });
    expect(steamLibraries(files, DEFAULT_STEAM)).toEqual([DEFAULT_STEAM, SECOND_LIBRARY]);
  });

  // A machine with a single library has no file to read, and the search must
  // still happen rather than report nothing installed.
  it('still knows the default library when Steam wrote no libraryfolders.vdf', () => {
    expect(steamLibraries(inMemoryFiles({}), DEFAULT_STEAM)).toEqual([DEFAULT_STEAM]);
  });
});

const APP = '2667530';

describe('finding the install of an application', () => {
  it('finds the folder whose own manifest names the application', () => {
    const install = commonFolder(SECOND_LIBRARY, 'Sunkenland Dedicated Server');
    const files = inMemoryFiles({ [manifestPathFor(install, APP)]: '"AppState" {}' });
    expect(findInstall(files, [SECOND_LIBRARY], APP)).toBe(install);
  });

  // The client sits next to the server in the same `common/`, and once held a
  // file that looked like the server's. Only the manifest steamcmd writes
  // inside the folder it installs tells the two apart.
  it('never takes a folder without that manifest, whatever it holds', () => {
    const client = commonFolder(DEFAULT_STEAM, 'Sunkenland');
    const files = inMemoryFiles({
      [join(client, 'Sunkenland.exe')]: 8_060_000,
      [join(client, 'Sunkenland-DedicatedServer.exe')]: 1_000,
    });
    expect(findInstall(files, [DEFAULT_STEAM], APP)).toBeUndefined();
  });

  it('ignores the manifest of another application', () => {
    const other = commonFolder(DEFAULT_STEAM, 'Something');
    const files = inMemoryFiles({ [manifestPathFor(other, '999')]: '"AppState" {}' });
    expect(findInstall(files, [DEFAULT_STEAM], APP)).toBeUndefined();
  });

  it('looks past the library holding the client, into the one holding the install', () => {
    const install = commonFolder(SECOND_LIBRARY, 'Sunkenland Dedicated Server');
    const files = inMemoryFiles({
      [join(commonFolder(DEFAULT_STEAM, 'Sunkenland'), 'Sunkenland.exe')]: 8_060_000,
      [manifestPathFor(install, APP)]: '"AppState" {}',
    });
    expect(findInstall(files, [DEFAULT_STEAM, SECOND_LIBRARY], APP)).toBe(install);
  });
});

describe('where a first install goes', () => {
  it('goes in the first library, under a name no Steam client takes', () => {
    expect(installDirFor([DEFAULT_STEAM, SECOND_LIBRARY], 'sunkenland')).toBe(
      commonFolder(DEFAULT_STEAM, 'beacon-sunkenland'),
    );
  });

  it('is where the next search finds it', () => {
    const target = installDirFor([DEFAULT_STEAM, SECOND_LIBRARY], 'sunkenland');
    const files = inMemoryFiles({ [manifestPathFor(target, APP)]: '"AppState" {}' });
    expect(findInstall(files, [DEFAULT_STEAM, SECOND_LIBRARY], APP)).toBe(target);
  });
});

describe('the Steam account', () => {
  // The account steamcmd logs in with is the one Steam logged in with most recently.
  it('takes the account Steam logged in with most recently', () => {
    const files = inMemoryFiles({ [loginUsersAt(DEFAULT_STEAM)]: LOGIN_USERS_VDF });
    expect(discoverSteamAccount(files, DEFAULT_STEAM)).toEqual({
      name: 'the-one-who-owns-the-game',
      flagged: true,
      accountCount: 2,
    });
  });

  it('falls back to the one Steam logs in on its own, which is what the client really writes', () => {
    const files = inMemoryFiles({ [loginUsersAt(DEFAULT_STEAM)]: LOGIN_USERS_WITHOUT_MOST_RECENT });
    expect(discoverSteamAccount(files, DEFAULT_STEAM)).toEqual({
      name: 'the-one-who-owns-the-game',
      flagged: true,
      accountCount: 2,
    });
  });

  // The real case this machine hit: two accounts, and nothing flags either.
  // Silently taking the first would be indistinguishable from a real pick.
  it('flags neither when two accounts carry no MostRecent nor AutoLogin, and says so', () => {
    const files = inMemoryFiles({ [loginUsersAt(DEFAULT_STEAM)]: LOGIN_USERS_TWO_UNFLAGGED });
    expect(discoverSteamAccount(files, DEFAULT_STEAM)).toEqual({
      name: 'an-old-account',
      flagged: false,
      accountCount: 2,
    });
  });

  it('finds none when Steam never logged in on this machine', () => {
    expect(discoverSteamAccount(inMemoryFiles({}), DEFAULT_STEAM)).toBeUndefined();
  });
});

describe('what steamcmd is launched with', () => {
  const args = (installDir = 'D:\\SteamLibrary\\steamapps\\common\\srv'): readonly string[] =>
    steamcmdArgumentsFor({ installDir, account: 'someone', app: APP });

  // Steam fixes its install root at login. A `+force_install_dir` that comes
  // after is not refused — it is ignored, and the download lands in steamcmd's
  // own folder where the next run of this tool will never look.
  it('puts +force_install_dir before +login', () => {
    expect(args().indexOf('+force_install_dir')).toBeLessThan(args().indexOf('+login'));
  });

  it('updates the application it is given, without validate', () => {
    expect(args()).toContain('+app_update');
    expect(args()[args().indexOf('+app_update') + 1]).toBe(APP);
    expect(args()).not.toContain('validate');
  });

  // `+login` accepts a password as a second word. steamcmd asks for it in the
  // terminal, and Steam Guard asks again regardless.
  it('carries the account name and nothing behind it', () => {
    expect(args().slice(args().indexOf('+login'), args().indexOf('+login') + 3)).toEqual([
      '+login',
      'someone',
      '+app_update',
    ]);
  });

  it('passes a folder with spaces as one argument, unquoted', () => {
    const folder = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\beacon-sunkenland';
    expect(args(folder)[args(folder).indexOf('+force_install_dir') + 1]).toBe(folder);
  });

  it('quits once the update is done', () => {
    expect(args().at(-1)).toBe('+quit');
  });
});

describe('finding steamcmd', () => {
  const at = (...paths: string[]) => (path: string) => paths.includes(path);

  it('takes steamcmd.exe in the first folder of the PATH that holds it', () => {
    const pathVariable = ['C:\\Windows', 'C:\\steamcmd', 'D:\\other'].join(delimiter);
    expect(findSteamcmd(pathVariable, at(join('C:\\steamcmd', 'steamcmd.exe'), join('D:\\other', 'steamcmd.exe')))).toBe(
      join('C:\\steamcmd', 'steamcmd.exe'),
    );
  });

  it('takes steamcmd.exe from a folder the PATH quotes', () => {
    const pathVariable = ['"C:\\steamcmd"'].join(delimiter);
    expect(findSteamcmd(pathVariable, at(join('C:\\steamcmd', 'steamcmd.exe')))).toBe(
      join('C:\\steamcmd', 'steamcmd.exe'),
    );
  });

  it('finds nothing when no folder of the PATH holds it', () => {
    expect(findSteamcmd(['C:\\Windows', 'C:\\tools'].join(delimiter), at())).toBeUndefined();
  });

  it('finds nothing without a PATH, and skips its empty entries', () => {
    expect(findSteamcmd(undefined, at(join('', 'steamcmd.exe')))).toBeUndefined();
    expect(findSteamcmd(['', 'C:\\steamcmd'].join(delimiter), at(join('', 'steamcmd.exe')))).toBeUndefined();
  });
});
