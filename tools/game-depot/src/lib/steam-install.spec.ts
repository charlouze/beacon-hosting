import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SERVER_BINARY } from './game-depot.js';
import { inMemoryFiles } from './local-files.spec-helper.js';
import {
  DEDICATED_SERVER_APP_ID,
  discoverSteamAccount,
  findDedicatedServer,
  steamLibraries,
  steamcmdCommandFor,
  suggestedInstallDir,
} from './steam-install.js';

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

describe('recognising an install of the dedicated server', () => {
  it('accepts the folder that holds the server binary', () => {
    const server = commonFolder(SECOND_LIBRARY, 'Sunkenland Dedicated Server');
    const files = inMemoryFiles({ [join(server, SERVER_BINARY)]: 2_300_000 });
    expect(findDedicatedServer(files, [SECOND_LIBRARY])).toBe(server);
  });

  // The client is the one already installed on the administrator's machine, and
  // it is a different Steam application. Taking it for the server deposits 8 GB
  // of the wrong files over the only ones nobody can rebuild without the
  // Steam account.
  it('refuses the game client, which carries another binary entirely', () => {
    const client = commonFolder(DEFAULT_STEAM, 'Sunkenland');
    const files = inMemoryFiles({ [join(client, 'Sunkenland.exe')]: 8_060_000 });
    expect(findDedicatedServer(files, [DEFAULT_STEAM])).toBeUndefined();
  });

  // The whole reason libraryfolders.vdf is read at all: an 8 GB client and a
  // 2.3 GB server routinely sit on different drives.
  it('looks past the library holding the client, into the one holding the server', () => {
    const server = commonFolder(SECOND_LIBRARY, 'Sunkenland Dedicated Server');
    const files = inMemoryFiles({
      [join(commonFolder(DEFAULT_STEAM, 'Sunkenland'), 'Sunkenland.exe')]: 8_060_000,
      [join(server, SERVER_BINARY)]: 2_300_000,
    });
    expect(findDedicatedServer(files, [DEFAULT_STEAM, SECOND_LIBRARY])).toBe(server);
  });

  // Where the command tells the operator to install is where the next run must
  // look, and one rule holds both ends: every `steamapps/common` is swept.
  it('suggests a destination the next search would find on its own', () => {
    const target = suggestedInstallDir([DEFAULT_STEAM, SECOND_LIBRARY]);
    const files = inMemoryFiles({ [join(target, SERVER_BINARY)]: 2_300_000 });
    expect(findDedicatedServer(files, [DEFAULT_STEAM, SECOND_LIBRARY])).toBe(target);
  });
});

describe('the Steam account', () => {
  // A placeholder in the middle of the line makes it something to edit rather
  // than something to paste, which is the whole point of printing it.
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

describe('the steamcmd command an operator is handed', () => {
  const command = (): string =>
    steamcmdCommandFor({ installDir: 'D:\\SteamLibrary\\steamapps\\common\\srv', account: 'someone' });

  // Steam fixes its install root at login. A `+force_install_dir` that comes
  // after is not refused — it is ignored, and the 2.3 GB land in steamcmd's own
  // folder where the next run of this tool will never look.
  it('puts +force_install_dir before +login', () => {
    expect(command().indexOf('+force_install_dir')).toBeLessThan(command().indexOf('+login'));
  });

  it('names the dedicated server application, and validates what it downloaded', () => {
    expect(DEDICATED_SERVER_APP_ID).toBe('2667530');
    expect(command()).toContain('+app_update 2667530 validate');
  });

  // The `+login` option accepts a password as a second word, and that word ends
  // up in the shell history — a plaintext file nothing ever cleans. steamcmd
  // prompts for it, and Steam Guard prompts again regardless.
  it('carries the account name and nothing behind it', () => {
    expect(command()).toContain('+login someone +app_update');
  });

  it('quotes the install folder, which holds spaces on every Windows machine', () => {
    expect(steamcmdCommandFor({ installDir: 'C:\\Program Files\\x', account: 'a' })).toContain(
      '+force_install_dir "C:\\Program Files\\x"',
    );
  });
});
