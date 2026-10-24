import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ObjectApi } from '@beacon/scaleway-storage';
import type { AdminCredentials } from '@beacon/admin-key';
import { gameVersionFrom, type Game, type GameVersion } from '@beacon/session';
import { gameArchiveKeyFor } from './game-depot.js';
import { inMemoryFiles } from './local-files.spec-helper.js';
import { type GuidedUpdatePorts, runGuidedUpdate } from './guided-update.js';
import type { SteamcmdTarget } from './steam-install.js';

const DEFAULT_STEAM = 'C:\\Program Files (x86)\\Steam';
const SERVER_DIR = join(DEFAULT_STEAM, 'steamapps', 'common', 'Sunkenland Dedicated Server');
const CLIENT_DIR = join(DEFAULT_STEAM, 'steamapps', 'common', 'Sunkenland');
const FIRST_INSTALL_DIR = join(DEFAULT_STEAM, 'steamapps', 'common', 'beacon-sunkenland');
const EXECUTABLE = 'Sunkenland-DedicatedServer.exe';
const APP = '2667530';
const OLD_BUILD = '25746735';
const NEW_BUILD = '25800001';

const ADMIN_SECRET = 'the-admin-secret-nothing-may-ever-print';
const MACHINE_SECRET = 'the-machine-secret-that-cannot-write';

const DUMP_WITH_BOTH_REMOTES = JSON.stringify({
  'scw-machine': {
    endpoint: 'https://s3.fr-par.scw.cloud',
    region: 'fr-par',
    access_key_id: 'MACHINE-ACCESS-KEY',
    secret_access_key: MACHINE_SECRET,
  },
  'scw-admin': {
    endpoint: 'https://s3.fr-par.scw.cloud',
    region: 'fr-par',
    access_key_id: 'ADMIN-ACCESS-KEY',
    secret_access_key: ADMIN_SECRET,
  },
});

const LOGIN_USERS_VDF = `"users"
{
\t"76561190000000002"
\t{
\t\t"AccountName"\t\t"the-one-who-owns-the-game"
\t\t"MostRecent"\t\t"1"
\t}
}
`;

/** The ordinary state of a Steam client signed into more than one account: neither is flagged. */
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

const LOGIN_USERS_ONE_UNFLAGGED = `"users"
{
\t"76561190000000002"
\t{
\t\t"AccountName"\t\t"the-one-who-owns-the-game"
\t}
}
`;

const LOGIN_USERS = join(DEFAULT_STEAM, 'config', 'loginusers.vdf');

const manifestPath = (dir: string): string => join(dir, 'steamapps', `appmanifest_${APP}.acf`);

const manifestOf = (build: string, stateFlags = '4'): string => `"AppState"
{
\t"appid"\t\t"${APP}"
\t"StateFlags"\t\t"${stateFlags}"
\t"buildid"\t\t"${build}"
}
`;

type Tree = Record<string, number | string>;

/** A complete install of the copy, at a build. */
function installAt(dir: string, build: string): Tree {
  return {
    [join(dir, EXECUTABLE)]: 60_000_000,
    [join(dir, 'Sunkenland-DedicatedServer_Data', 'data.pak')]: 2_240_000_000,
    [manifestPath(dir)]: manifestOf(build),
  };
}

/** Steam logged in, the game client installed, and the copy installed at the old build. */
function machine(): Tree {
  return {
    [LOGIN_USERS]: LOGIN_USERS_VDF,
    [join(CLIENT_DIR, 'Sunkenland.exe')]: 8_060_000_000,
    ...installAt(SERVER_DIR, OLD_BUILD),
  };
}

/** The same machine before any install of the copy. */
function machineWithoutTheCopy(): Tree {
  return {
    [LOGIN_USERS]: LOGIN_USERS_VDF,
    [join(CLIENT_DIR, 'Sunkenland.exe')]: 8_060_000_000,
  };
}

type SteamcmdDouble = (target: SteamcmdTarget, tree: Tree) => number | Promise<number>;

/** steamcmd as measured: it brings the folder it is given to the build Steam publishes, and exits 0. */
const updatesTo =
  (build: string): SteamcmdDouble =>
  (target, tree) => {
    Object.assign(tree, installAt(target.installDir, build));
    return 0;
  };

const version = (digits: string): GameVersion => {
  const built = gameVersionFrom(digits);
  if (built === null) throw new Error(`not a version: ${digits}`);
  return built;
};

const RECORD_DESTINATION = 'Firestore of project beacon-test';

interface Harness {
  readonly said: string[];
  readonly asked: string[];
  /** In order: `read the record`, `steamcmd`, `ask`, `push`. */
  readonly events: string[];
  readonly choices: (readonly Game[])[];
  readonly installs: SteamcmdTarget[];
  readonly opened: AdminCredentials[];
  readonly bucket: Map<string, number>;
  readonly recorded: string[];
  readonly ports: GuidedUpdatePorts;
}

function harness(
  options: {
    readonly tree?: Tree;
    readonly configDump?: string;
    readonly requestedGame?: string;
    readonly games?: readonly Game[];
    readonly choice?: Game;
    readonly installDir?: string;
    readonly steamAccount?: string;
    readonly steamcmdPresent?: boolean;
    readonly steamcmd?: SteamcmdDouble;
    readonly canAnswer?: boolean;
    /** The version on record; `null` for none. Defaults to the old build. */
    readonly deposited?: string | null;
    readonly recordUnreachable?: boolean;
    /** What proving the Google identity returns, or the error it throws. */
    readonly identity?: 'emulator' | 'application-default' | Error;
    readonly answer?: (question: string) => boolean;
  } = {},
): Harness {
  const tree = options.tree ?? machine();
  const said: string[] = [];
  const asked: string[] = [];
  const events: string[] = [];
  const choices: (readonly Game[])[] = [];
  const installs: SteamcmdTarget[] = [];
  const opened: AdminCredentials[] = [];
  const bucket = new Map<string, number>();
  const recorded: string[] = [];

  const api: ObjectApi = {
    async list(prefix: string) {
      return [...bucket]
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, sizeBytes]) => ({ key, sizeBytes, lastModified: new Date(0) }));
    },
    async put() {
      throw new Error('the guided flow deposits through pushGameFiles, never through put');
    },
    async get() {
      throw new Error('the guided flow downloads nothing');
    },
  };

  return {
    said,
    asked,
    events,
    choices,
    installs,
    opened,
    bucket,
    recorded,
    ports: {
      requestedGame: options.requestedGame,
      games: options.games ?? ['sunkenland'],
      bucketName: 'beacon-games',
      steamRoot: DEFAULT_STEAM,
      recordDestination: RECORD_DESTINATION,
      installDir: options.installDir,
      steamAccount: options.steamAccount,
      files: inMemoryFiles(tree),
      canAnswer: options.canAnswer ?? true,
      steamcmd: {
        present: () => options.steamcmdPresent ?? true,
        install: async (target) => {
          events.push('steamcmd');
          installs.push(target);
          return (options.steamcmd ?? updatesTo(NEW_BUILD))(target, tree);
        },
      },
      record: {
        depositedVersion: async () => {
          events.push('read the record');
          if (options.recordUnreachable === true) throw new Error('PERMISSION_DENIED');
          const deposited = options.deposited === undefined ? OLD_BUILD : options.deposited;
          return deposited === null ? null : version(deposited);
        },
        recordDeposit: async (_game, deposited) => {
          recorded.push(deposited);
        },
      },
      rcloneConfigDump: async () => options.configDump ?? DUMP_WITH_BOTH_REMOTES,
      proveIdentity: async () => {
        const identity = options.identity ?? 'application-default';
        if (identity instanceof Error) throw identity;
        return identity;
      },
      openBucket: (credentials) => {
        opened.push(credentials);
        return api;
      },
      pushArchive: async ({ game, record, from, steps }) => {
        events.push('push');
        steps?.building();
        steps?.sending(2_480_000_000);
        bucket.set(gameArchiveKeyFor(game), 2_480_000_000);
        const build = /"buildid"\s+"(\d+)"/.exec(String(tree[manifestPath(from)]))?.[1];
        if (build === undefined) throw new Error(`no manifest in ${from}`);
        await record.recordDeposit(game, version(build));
        return version(build);
      },
      ask: async (question) => {
        events.push('ask');
        asked.push(question);
        return options.answer?.(question) ?? true;
      },
      choose: async (_question, games) => {
        choices.push(games);
        return options.choice;
      },
      say: (line) => said.push(line),
    },
  };
}

const printed = (flow: Harness): string => flow.said.join('\n');
const lineIndex = (flow: Harness, pattern: RegExp): number => flow.said.findIndex((line) => pattern.test(line));

describe('the download, by steamcmd', () => {
  it('has steamcmd bring the install to the published build, then deposits it', async () => {
    const flow = harness();

    expect(await runGuidedUpdate(flow.ports)).toBe('deposited');
    expect(flow.installs).toEqual([{ installDir: SERVER_DIR, account: 'the-one-who-owns-the-game', app: APP }]);
    expect(flow.recorded).toEqual([NEW_BUILD]);
    expect(flow.events).toEqual(['read the record', 'steamcmd', 'ask', 'push']);
  });

  it('deposits nothing when steamcmd exits on a code other than 0', async () => {
    const flow = harness({ steamcmd: () => 5 });

    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(printed(flow)).toMatch(/code 5/);
    expect(flow.asked).toEqual([]);
    expect(flow.bucket.size).toBe(0);
    expect(flow.recorded).toEqual([]);
  });

  it('deposits nothing when steamcmd ends without an exit code', async () => {
    const flow = harness({ steamcmd: () => Promise.reject(new Error('spawn EACCES')) });

    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(printed(flow)).toContain('spawn EACCES');
    expect(flow.bucket.size).toBe(0);
  });

  it('stops before reading the record or downloading when steamcmd is not on the PATH', async () => {
    const flow = harness({ steamcmdPresent: false });

    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(printed(flow)).toContain('PATH');
    expect(flow.events).toEqual([]);
  });

  // steamcmd asks for a password and a Steam Guard code: launched with nobody
  // to answer, it would wait for ever, or fail in a way that says nothing.
  it('launches nothing without a terminal to answer in', async () => {
    const flow = harness({ canAnswer: false });

    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(printed(flow)).toMatch(/terminal/i);
    expect(printed(flow)).toContain('mise run game-update');
    expect(flow.events).toEqual([]);
  });

  it('says steamcmd may ask for the password, and hands it none', async () => {
    const flow = harness();
    await runGuidedUpdate(flow.ports);

    expect(lineIndex(flow, /password/i)).toBeGreaterThan(-1);
    expect(lineIndex(flow, /password/i)).toBeLessThan(lineIndex(flow, /steamcmd exited with code 0/));
    expect(Object.keys(flow.installs[0] ?? {})).toEqual(['installDir', 'account', 'app']);
  });

  it('refuses an install steamcmd left incomplete, without asking', async () => {
    const flow = harness({
      steamcmd: (target, tree) => {
        tree[manifestPath(target.installDir)] = manifestOf(NEW_BUILD, '1026');
        return 0;
      },
    });

    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(printed(flow)).toMatch(/not complete/);
    expect(flow.asked).toEqual([]);
  });
});

describe('the game', () => {
  it('announces the only game whose copy is deposited, without asking', async () => {
    const flow = harness();
    await runGuidedUpdate(flow.ports);

    expect(flow.choices).toEqual([]);
    expect(lineIndex(flow, /sunkenland/)).toBeGreaterThan(lineIndex(flow, /^4\./));
  });

  // The catalogue holds one game with a copy: only the choice is played here.
  it('asks which game when several have a copy, and names it once chosen', async () => {
    const flow = harness({ games: ['sunkenland', 'enshrouded'], choice: 'sunkenland' });

    expect(await runGuidedUpdate(flow.ports)).toBe('deposited');
    expect(flow.choices).toEqual([['sunkenland', 'enshrouded']]);
    expect(lineIndex(flow, /sunkenland/)).toBeGreaterThan(lineIndex(flow, /^4\./));
  });

  it('stops before steamcmd when the answer names no game', async () => {
    const flow = harness({ games: ['sunkenland', 'enshrouded'], choice: undefined });

    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(flow.installs).toEqual([]);
  });

  it('takes the game --game names, without asking', async () => {
    const flow = harness({ games: ['sunkenland', 'enshrouded'], requestedGame: 'sunkenland' });

    expect(await runGuidedUpdate(flow.ports)).toBe('deposited');
    expect(flow.choices).toEqual([]);
  });

  it('refuses a --game that goes through no copy, saying why', async () => {
    const flow = harness({ requestedGame: 'enshrouded' });

    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(printed(flow)).toMatch(/enshrouded goes through no copy/);
    expect(flow.events).toEqual([]);
  });

  it('refuses a --game that names no game', async () => {
    const flow = harness({ requestedGame: 'tetris' });

    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(printed(flow)).toContain('tetris');
    expect(flow.events).toEqual([]);
  });
});

describe('the install folder', () => {
  // The old recogniser took any folder holding the server's file name. The
  // manifest steamcmd writes inside the folder is what names the application.
  it('finds the install by its manifest, and never takes the client next to it', async () => {
    const flow = harness({
      tree: {
        [LOGIN_USERS]: LOGIN_USERS_VDF,
        [join(CLIENT_DIR, EXECUTABLE)]: 1_000,
        [join(CLIENT_DIR, 'Sunkenland.exe')]: 8_060_000_000,
        ...installAt(SERVER_DIR, OLD_BUILD),
      },
    });
    await runGuidedUpdate(flow.ports);

    expect(flow.installs[0]?.installDir).toBe(SERVER_DIR);
  });

  it('installs into a folder of its own when no install exists, then deposits it', async () => {
    const flow = harness({ tree: machineWithoutTheCopy(), deposited: null });

    expect(await runGuidedUpdate(flow.ports)).toBe('deposited');
    expect(flow.installs[0]?.installDir).toBe(FIRST_INSTALL_DIR);
    expect(flow.recorded).toEqual([NEW_BUILD]);
  });

  it('installs into the folder --from names', async () => {
    const elsewhere = 'D:\\elsewhere';
    const flow = harness({ tree: machineWithoutTheCopy(), installDir: elsewhere });

    expect(await runGuidedUpdate(flow.ports)).toBe('deposited');
    expect(flow.installs[0]?.installDir).toBe(elsewhere);
  });

  it('refuses a folder without the executable the catalogue names, without asking', async () => {
    const flow = harness({
      tree: machineWithoutTheCopy(),
      steamcmd: (target, tree) => {
        tree[manifestPath(target.installDir)] = manifestOf(NEW_BUILD);
        return 0;
      },
    });

    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(printed(flow)).toContain(EXECUTABLE);
    expect(flow.asked).toEqual([]);
    expect(flow.bucket.size).toBe(0);
  });

  it('names the folder, its weight and its file count before asking', async () => {
    const flow = harness();
    await runGuidedUpdate(flow.ports);

    const beforeTheQuestion = flow.said.slice(0, lineIndex(flow, /^8\./)).join('\n');
    expect(beforeTheQuestion).toContain(SERVER_DIR);
    expect(beforeTheQuestion).toContain('3 files');
    expect(beforeTheQuestion).toMatch(/2\.\d\d GB/);
  });
});

describe('the Steam account', () => {
  it('stops before steamcmd when no account is found and none is named', async () => {
    const tree = machine();
    delete tree[LOGIN_USERS];
    const flow = harness({ tree });

    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(printed(flow)).toContain('--steam-account=');
    expect(flow.installs).toEqual([]);
  });

  it('takes the account --steam-account names, without judging it', async () => {
    const flow = harness({ steamAccount: 'someone-else' });
    await runGuidedUpdate(flow.ports);

    expect(flow.installs[0]?.account).toBe('someone-else');
    expect(printed(flow)).not.toMatch(/flagged|guess|likely/);
  });

  it('says the account it takes before steamcmd runs', async () => {
    const flow = harness();
    await runGuidedUpdate(flow.ports);

    expect(lineIndex(flow, /the-one-who-owns-the-game/)).toBeGreaterThan(-1);
    expect(lineIndex(flow, /the-one-who-owns-the-game/)).toBeLessThan(lineIndex(flow, /^6\./));
  });

  it('says a flagged account is the one the Steam client flagged, not a guess', async () => {
    const flow = harness();
    await runGuidedUpdate(flow.ports);

    expect(printed(flow)).toMatch(/the one the Steam client itself flagged/);
    expect(printed(flow)).not.toMatch(/guess/);
    expect(printed(flow)).toContain('--steam-account=');
  });

  it('says it took the first of several accounts, only because none is flagged', async () => {
    const flow = harness({ tree: { ...machine(), [LOGIN_USERS]: LOGIN_USERS_TWO_UNFLAGGED } });
    await runGuidedUpdate(flow.ports);

    expect(printed(flow)).toMatch(/is a guess: 2 accounts are in the/);
    expect(printed(flow)).toMatch(/none flagged as logged in/);
    expect(flow.installs[0]?.account).toBe('an-old-account');
  });

  it('says the only account in the client is likely right', async () => {
    const flow = harness({ tree: { ...machine(), [LOGIN_USERS]: LOGIN_USERS_ONE_UNFLAGGED } });
    await runGuidedUpdate(flow.ports);

    expect(printed(flow)).toMatch(/the only one in the Steam client/);
  });
});

describe('the version of the copy', () => {
  it('stops before the download when the record cannot be reached', async () => {
    const flow = harness({ recordUnreachable: true });

    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(printed(flow)).toMatch(/record of the copy cannot be reached/);
    expect(flow.installs).toEqual([]);
  });

  it('says what the record holds, and where', async () => {
    const flow = harness();
    await runGuidedUpdate(flow.ports);

    expect(printed(flow)).toContain(`the record of the copy answers, in ${RECORD_DESTINATION}: build ${OLD_BUILD} deposited`);
  });

  it('says no copy is deposited yet when the record holds none', async () => {
    const flow = harness({ deposited: null });
    await runGuidedUpdate(flow.ports);

    expect(printed(flow)).toContain('no copy deposited yet');
  });

  it('says the installed build is already the deposited copy, and deposits nothing on a no', async () => {
    const flow = harness({ steamcmd: updatesTo(OLD_BUILD), answer: () => false });

    expect(await runGuidedUpdate(flow.ports)).toBe('declined');
    expect(printed(flow)).toContain(`build ${OLD_BUILD} is already the deposited copy of sunkenland`);
    expect(flow.asked).toEqual([`deposit build ${OLD_BUILD} again anyway?`]);
    expect(flow.bucket.size).toBe(0);
    expect(flow.recorded).toEqual([]);
  });

  it('deposits the same build again on a yes', async () => {
    const flow = harness({ steamcmd: updatesTo(OLD_BUILD) });

    expect(await runGuidedUpdate(flow.ports)).toBe('deposited');
    expect(flow.recorded).toEqual([OLD_BUILD]);
  });

  it('asks the usual question when the build is new', async () => {
    const flow = harness();
    await runGuidedUpdate(flow.ports);

    expect(flow.asked).toEqual(['build the archive and deposit it as sunkenland/game.tar in beacon-games?']);
  });

  it('says the build it is about to deposit, before asking', async () => {
    const flow = harness();
    await runGuidedUpdate(flow.ports);

    expect(flow.said.slice(0, lineIndex(flow, /^8\./)).join('\n')).toContain(`build ${NEW_BUILD}`);
  });

  it('announces the version it recorded, and where', async () => {
    const flow = harness();
    expect(await runGuidedUpdate(flow.ports)).toBe('deposited');

    expect(printed(flow)).toContain(`build ${NEW_BUILD} recorded as the copy of sunkenland, in ${RECORD_DESTINATION}`);
  });
});

describe('the deposit', () => {
  it('reads back what the bucket then holds, and announces it', async () => {
    const flow = harness();
    expect(await runGuidedUpdate(flow.ports)).toBe('deposited');

    expect(printed(flow)).toContain('sunkenland/game.tar in beacon-games, 2.31 GB');
  });

  // Building then sending gigabytes is minutes of silence: said as each starts,
  // so the operator does not take it for a hang.
  it('says the archive is being built, then sent, before reading it back', async () => {
    const flow = harness();
    await runGuidedUpdate(flow.ports);

    const building = flow.said.findIndex((line) => line.includes(`building the archive of ${SERVER_DIR}`));
    const sending = lineIndex(flow, /sending sunkenland\/game\.tar, 2\.31 GB, to beacon-games: nothing shows until it is done/);
    const readBack = lineIndex(flow, /sunkenland\/game\.tar in beacon-games/);
    expect(building).toBeGreaterThan(-1);
    expect(sending).toBeGreaterThan(building);
    expect(readBack).toBeGreaterThan(sending);
  });

  // The machine's key can only read this bucket. Taking it would fail at the
  // end of a multi-gigabyte upload rather than before it starts.
  it('opens the bucket with the administrator key, never the machine one', async () => {
    const flow = harness();
    await runGuidedUpdate(flow.ports);

    expect(flow.opened.map((credentials) => credentials.accessKeyId)).toEqual(['ADMIN-ACCESS-KEY']);
  });

  // Told apart from a refusal on purpose: an operator who answers no has been
  // served, and a task runner that paints that red teaches him to ignore red.
  it('deposits nothing when the operator declines, and calls that neither a failure nor a deposit', async () => {
    const flow = harness({ answer: () => false });

    expect(await runGuidedUpdate(flow.ports)).toBe('declined');
    expect(flow.bucket.size).toBe(0);
    expect(flow.recorded).toEqual([]);
  });

  it('says what it deliberately left alone', async () => {
    const flow = harness();
    await runGuidedUpdate(flow.ports);

    expect(printed(flow)).toMatch(/nothing was deleted/i);
  });
});

describe('the credentials', () => {
  it('names the missing remote and stops before anything else', async () => {
    const flow = harness({ configDump: JSON.stringify({ 'scw-machine': {} }) });

    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(printed(flow)).toContain('scw-admin');
    expect(flow.events).toEqual([]);
  });

  // The record is read before the download and written after the upload: a
  // login that expired would otherwise be learnt minutes, or gigabytes, in.
  it('stops before anything else when no Google identity answers, naming the login to run', async () => {
    const flow = harness({ identity: new Error('Could not load the default credentials.') });

    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(printed(flow)).toContain('Could not load the default credentials.');
    expect(printed(flow)).toContain('gcloud auth application-default login');
    expect(flow.events).toEqual([]);
  });

  it('says the Google identity answers', async () => {
    const flow = harness();
    await runGuidedUpdate(flow.ports);

    expect(printed(flow)).toContain('the Google identity gcloud auth application-default login left here answers');
  });

  it('asks no Google identity of the emulator, and says so', async () => {
    const flow = harness({ identity: 'emulator' });

    expect(await runGuidedUpdate(flow.ports)).toBe('deposited');
    expect(printed(flow)).toContain('no Google identity needed: the record is in the emulator');
  });

  // The flow reads a secret out of rclone on every run, in a terminal whose
  // scrollback is shared in a chat the day something goes wrong.
  it('lets no part of a credential reach the output', async () => {
    const flow = harness();
    await runGuidedUpdate(flow.ports);
    const everything = [...flow.said, ...flow.asked].join('\n');

    expect(everything).not.toContain(ADMIN_SECRET);
    expect(everything).not.toContain(MACHINE_SECRET);
    expect(everything).not.toContain('ADMIN-ACCESS-KEY');
    expect(everything).not.toContain('MACHINE-ACCESS-KEY');
    expect(flow.opened[0]?.secretAccessKey).toBe(ADMIN_SECRET);
  });
});
