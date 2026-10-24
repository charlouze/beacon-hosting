import { isGame, type Game, type GameVersion } from '@beacon/session';
import type { GameCopyRecord } from '@beacon/session-record';
import type { ObjectApi } from '@beacon/scaleway-storage';
import { ADMIN_REMOTE, type AdminCredentials, adminCredentialsFrom, describeRemote } from '@beacon/admin-key';
import { type DepositSteps, type PushGameFilesDeps, gameArchiveKeyFor } from './game-depot.js';
import { type CopyApplication, copyApplicationOf } from './copy-application.js';
import {
  type DiscoveredSteamAccount,
  type LocalFiles,
  type SteamcmdTarget,
  discoverSteamAccount,
  findInstall,
  installDirFor,
  steamLibraries,
} from './steam-install.js';
import { installedCopy } from './steam-manifest.js';

/**
 * Three states rather than two, because the caller turns them into an exit
 * code and only one of them is a fault. Taking the operator's `no` is this
 * command doing its job — painting it red is how a task runner teaches him to
 * ignore red.
 */
export type GuidedUpdateOutcome =
  /** The archive is in the bucket, was read back, and its version is recorded. */
  | 'deposited'
  /** The operator was asked and answered no. */
  | 'declined'
  /** Something is wrong, and nothing was deposited. */
  | 'refused';

/** steamcmd, as this flow uses it. */
export interface Steamcmd {
  /** Whether it is on this machine. Looks without launching: a launch updates steamcmd itself. */
  present(): boolean;
  /** Runs it in the operator's terminal and resolves with its exit code. Rejects when it ends without one. */
  install(target: SteamcmdTarget): Promise<number>;
}

export interface GuidedUpdatePorts {
  /** What `--game` names, if anything. */
  readonly requestedGame?: string;
  /** The games whose copy this tool deposits. */
  readonly games: readonly Game[];
  readonly bucketName: string;
  readonly steamRoot: string;
  /** Where the version is recorded, worded for the operator. */
  readonly recordDestination: string;
  /** An install folder named on the command line, which skips the search. */
  readonly installDir?: string;
  /** Overrides what `loginusers.vdf` says, on a machine with several accounts. */
  readonly steamAccount?: string;
  readonly files: LocalFiles;
  readonly record: GameCopyRecord;
  readonly steamcmd: Steamcmd;
  /** Whether someone can answer at a keyboard: steamcmd asks for a password and a Steam Guard code. */
  readonly canAnswer: boolean;
  readonly rcloneConfigDump: () => Promise<string>;
  readonly openBucket: (credentials: AdminCredentials) => ObjectApi;
  /** `pushGameFiles` itself. A port only so a test does not need gigabytes on disk. */
  readonly pushArchive: (deps: PushGameFilesDeps) => Promise<GameVersion>;
  /** A yes or no, no by default. */
  readonly ask: (question: string) => Promise<boolean>;
  /** The game the operator picks, or undefined for an answer that names none. */
  readonly choose: (question: string, games: readonly Game[]) => Promise<Game | undefined>;
  readonly say: (line: string) => void;
}

/** A refusal: its lines are said under `STOP`, and nothing is deposited. */
class Stop extends Error {
  constructor(readonly lines: readonly string[]) {
    super(lines.join(' '));
  }
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function gigabytes(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/**
 * The gesture an administrator repeats at every game update, guided from end
 * to end. It has steamcmd bring the install on this machine to the build the
 * publisher publishes, with the operator's own Steam account, because only a
 * machine owning the game may download it; then it deposits that install,
 * reads it back and records its version.
 *
 * It has no verb that removes, here or anywhere below. The objects of the older
 * file-by-file deposit outlive every run: dropping them is the administrator's
 * call, and these files under licence can only be deposited again from a
 * machine that owns the game.
 */
export async function runGuidedUpdate(ports: GuidedUpdatePorts): Promise<GuidedUpdateOutcome> {
  try {
    return await guide(ports);
  } catch (error) {
    if (!(error instanceof Stop)) throw error;
    const [first, ...rest] = error.lines;
    ports.say(`  STOP  ${first}`);
    for (const line of rest) ports.say(`        ${line}`);
    return 'refused';
  }
}

async function guide(ports: GuidedUpdatePorts): Promise<GuidedUpdateOutcome> {
  const { say } = ports;
  say(`beacon: game files, from this machine into ${ports.bucketName}`);

  say('');
  say('1. The administrator key, never the machine one');
  const credentials = await adminKey(ports);

  say('');
  say('2. steamcmd, which downloads the game with your Steam account');
  if (!ports.steamcmd.present()) {
    throw new Stop(['steamcmd.exe is not on the PATH.', 'Install steamcmd, put its folder on the PATH, then run this again.']);
  }
  say('  ok    steamcmd.exe is on the PATH');

  say('');
  say('3. A terminal to answer in');
  if (!ports.canAnswer) {
    throw new Stop([
      'no terminal to answer in: steamcmd would ask for a password and a Steam Guard',
      'code nobody could type. Run this from a terminal.',
    ]);
  }
  say('  ok    steamcmd and this command ask their questions here');

  say('');
  say('4. The game');
  const game = await gameToDeposit(ports);
  const copy = copyApplicationOf(game);

  say('');
  say(`5. Where ${game} is installed, and with which Steam account`);
  const libraries = steamLibraries(ports.files, ports.steamRoot);
  say(`  ok    ${libraries.length} Steam ${libraries.length === 1 ? 'library' : 'libraries'}: ${libraries.join(', ')}`);
  const target: SteamcmdTarget = {
    installDir: chooseInstallDir(ports, libraries, game, copy.steamApp),
    account: steamAccount(ports),
    app: copy.steamApp,
  };
  const deposited = await depositedVersion(ports, game);

  say('');
  say('6. The download, by steamcmd');
  await download(ports, target);

  say('');
  say('7. What is about to be deposited');
  const installed = inspect(ports, target.installDir, copy);

  say('');
  say('8. The deposit');
  if (!(await operatorAgrees(ports, game, installed, deposited))) {
    say('  !     nothing deposited');
    return 'declined';
  }
  await deposit(ports, credentials, game, target.installDir);

  say('');
  say('9. What this command did not do');
  say('  !     nothing was deleted. The objects of the older file-by-file deposit are');
  say('        where they were: dropping them is your call, and only once a real session');
  say('        has booted on this archive. These files are under licence, and only a');
  say('        machine that owns the game can ever deposit them again.');
  return 'deposited';
}

async function adminKey(ports: GuidedUpdatePorts): Promise<AdminCredentials> {
  let credentials: AdminCredentials;
  try {
    credentials = adminCredentialsFrom(await ports.rcloneConfigDump(), ADMIN_REMOTE);
  } catch (error) {
    throw new Stop([reasonOf(error), `rclone config show ${ADMIN_REMOTE}   says whether it exists at all.`]);
  }
  ports.say(`  ok    ${describeRemote(ADMIN_REMOTE, credentials)}`);
  ports.say('  ok    no credential value is printed by this command, here or below');
  return credentials;
}

async function gameToDeposit(ports: GuidedUpdatePorts): Promise<Game> {
  const { requestedGame, games, say } = ports;
  if (requestedGame !== undefined) {
    if (!isGame(requestedGame)) throw new Stop([`--game names no game: "${requestedGame}".`]);
    if (!games.includes(requestedGame)) {
      throw new Stop([`${requestedGame} goes through no copy: nothing of it is deposited here.`]);
    }
    say(`  ok    ${requestedGame}, as --game says`);
    return requestedGame;
  }
  if (games.length === 1) {
    say(`  ok    ${games[0]}, the only game whose copy is deposited here`);
    return games[0];
  }
  const chosen = await ports.choose('which game?', games);
  if (chosen === undefined) throw new Stop(['that answer names none of the games above.']);
  say(`  ok    ${chosen}`);
  return chosen;
}

function chooseInstallDir(ports: GuidedUpdatePorts, libraries: readonly string[], game: Game, app: string): string {
  if (ports.installDir !== undefined) {
    ports.say(`  ok    ${ports.installDir}, as --from says`);
    return ports.installDir;
  }
  const found = findInstall(ports.files, libraries, app);
  if (found !== undefined) {
    ports.say(`  ok    ${found}, found by its manifest`);
    return found;
  }
  const first = installDirFor(libraries, game);
  ports.say(`  ok    no install yet: steamcmd will install into ${first}`);
  return first;
}

function steamAccount(ports: GuidedUpdatePorts): string {
  if (ports.steamAccount !== undefined) {
    ports.say(`  ok    Steam account ${ports.steamAccount}, as --steam-account says`);
    return ports.steamAccount;
  }
  const discovered = discoverSteamAccount(ports.files, ports.steamRoot);
  if (discovered === undefined) {
    throw new Stop([
      'no account was found in the Steam client on this machine.',
      'Pass --steam-account=<name> to say which one owns the game.',
    ]);
  }
  sayAccountConfidence(ports.say, discovered);
  return discovered.name;
}

/**
 * Says exactly what the pick is worth, and nothing more than that: a flagged
 * account is a real answer from the Steam client, not a coin flip, and saying
 * "it is a guess" about it would be as false as staying silent about a real
 * coin flip between two unflagged accounts — the ordinary state of a client
 * signed into more than one account over the years.
 */
function sayAccountConfidence(say: (line: string) => void, discovered: DiscoveredSteamAccount): void {
  if (discovered.flagged) {
    say(`  ok    Steam account ${discovered.name}, the one the Steam client itself flagged as`);
    say('        logged in. Pass --steam-account=<name> if this machine owns the game under');
    say('        another account.');
  } else if (discovered.accountCount > 1) {
    say(`  !     Steam account ${discovered.name} is a guess: ${discovered.accountCount} accounts are in the`);
    say('        Steam client, none flagged as logged in, so the first one found was taken.');
    say('        Pass --steam-account=<name> to say which one owns the game.');
  } else {
    say(`  ok    Steam account ${discovered.name}, the only one in the Steam client on this`);
    say('        machine, so it is likely right. Pass --steam-account=<name> if it owns the');
    say('        game under another.');
  }
}

/** Read before the download: an unreachable record would otherwise be learnt after gigabytes. */
async function depositedVersion(ports: GuidedUpdatePorts, game: Game): Promise<GameVersion | null> {
  let deposited: GameVersion | null;
  try {
    deposited = await ports.record.depositedVersion(game);
  } catch (error) {
    throw new Stop([
      `the record of the copy cannot be reached: ${reasonOf(error)}`,
      'BEACON_FIREBASE_PROJECT names the project, and gcloud auth application-default login the identity.',
    ]);
  }
  const holds = deposited === null ? 'no copy deposited yet' : `build ${deposited} deposited`;
  ports.say(`  ok    the record of the copy answers, in ${ports.recordDestination}: ${holds}`);
  return deposited;
}

async function download(ports: GuidedUpdatePorts, target: SteamcmdTarget): Promise<void> {
  const { say } = ports;
  say(`  !     steamcmd runs below, in this terminal. It may ask for the password of`);
  say(`        ${target.account} and for a Steam Guard code: they go to steamcmd, never to this command.`);
  say('');
  let exitCode: number;
  try {
    exitCode = await ports.steamcmd.install(target);
  } catch (error) {
    throw new Stop([`steamcmd did not run to the end: ${reasonOf(error)}.`, 'Nothing deposited.']);
  }
  say('');
  if (exitCode !== 0) throw new Stop([`steamcmd exited with code ${exitCode}.`, 'Nothing deposited.']);
  say('  ok    steamcmd exited with code 0');
}

/** The build steamcmd left in the folder, once the folder is an install of the copy. */
function inspect(ports: GuidedUpdatePorts, installDir: string, copy: CopyApplication): GameVersion {
  const installed = installedCopy(ports.files, installDir, copy);
  if ('refusal' in installed) throw new Stop([`${installed.refusal}.`, 'Nothing deposited.']);
  const measure = ports.files.measure(installDir);
  ports.say(`  ok    ${installDir}`);
  ports.say(
    `  ok    ${gigabytes(measure.sizeBytes)}, ${measure.fileCount} files, ${copy.executable} present, build ${installed.version}`,
  );
  return installed.version;
}

/**
 * The one question before the upload, no by default. A build that is already
 * the deposited copy is said, and asked about on its own terms: depositing it
 * again buys nothing but the upload.
 */
async function operatorAgrees(
  ports: GuidedUpdatePorts,
  game: Game,
  installed: GameVersion,
  deposited: GameVersion | null,
): Promise<boolean> {
  if (installed === deposited) {
    ports.say(`  !     build ${installed} is already the deposited copy of ${game}.`);
    return ports.ask(`deposit build ${installed} again anyway?`);
  }
  return ports.ask(`build the archive and deposit it as ${gameArchiveKeyFor(game)} in ${ports.bucketName}?`);
}

async function deposit(ports: GuidedUpdatePorts, credentials: AdminCredentials, game: Game, from: string): Promise<void> {
  const key = gameArchiveKeyFor(game);
  const bucket = ports.openBucket(credentials);
  const steps: DepositSteps = {
    building: () => ports.say(`  ..    building the archive of ${from}, in a temporary folder`),
    sending: (sizeBytes) =>
      ports.say(`  ..    sending ${key}, ${gigabytes(sizeBytes)}, to ${ports.bucketName}: nothing shows until it is done`),
  };
  const version = await ports.pushArchive({ api: bucket, record: ports.record, game, from, steps });

  // Read back rather than trust. `pushGameFiles` already compares the size it
  // deposited; this second look is what the operator gets to see, and it costs
  // a `list` — never a second `get` over gigabytes.
  const inBucket = (await bucket.list(key)).find((summary) => summary.key === key);
  if (inBucket === undefined) {
    throw new Error(`${key} is not in ${ports.bucketName} after a push that claimed success`);
  }
  ports.say(`  ok    ${key} in ${ports.bucketName}, ${gigabytes(inBucket.sizeBytes)}`);
  ports.say(`  ok    build ${version} recorded as the copy of ${game}, in ${ports.recordDestination}`);
}
