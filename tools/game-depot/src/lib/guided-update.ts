import { join } from 'node:path';
import type { Game } from '@beacon/session';
import type { ObjectApi } from '@beacon/scaleway-storage';
import { ADMIN_REMOTE, type AdminCredentials, adminCredentialsFrom, describeRemote } from './admin-credentials.js';
import { SERVER_BINARY, type PushGameFilesDeps, gameArchiveKeyFor } from './game-depot.js';
import {
  type DiscoveredSteamAccount,
  type LocalFiles,
  discoverSteamAccount,
  findDedicatedServer,
  steamLibraries,
  steamcmdCommandFor,
  suggestedInstallDir,
} from './steam-install.js';

/**
 * Four states rather than two, because the caller turns them into an exit code
 * and only one of them is a fault. Guiding an operator to steamcmd, or taking
 * his `no`, is this command doing its job — painting either of them red is how
 * a task runner teaches him to ignore red.
 */
export type GuidedUpdateOutcome =
  /** The archive is in the bucket, and was read back. */
  | 'deposited'
  /** The server is not on this machine; the command to install it was handed over. */
  | 'not-installed'
  /** The operator was asked and answered no. */
  | 'declined'
  /** Something is wrong: no admin remote, or a folder that is not an install. */
  | 'refused';

export interface GuidedUpdatePorts {
  readonly game: Game;
  readonly bucketName: string;
  readonly steamRoot: string;
  /** An install folder named on the command line, which skips the search. */
  readonly installDir?: string;
  /** Overrides what `loginusers.vdf` says, on a machine with several accounts. */
  readonly steamAccount?: string;
  readonly files: LocalFiles;
  readonly rcloneConfigDump: () => Promise<string>;
  readonly openBucket: (credentials: AdminCredentials) => ObjectApi;
  /** `pushGameFiles` itself. A port only so a test does not need 2.3 GB on disk. */
  readonly pushArchive: (deps: PushGameFilesDeps) => Promise<void>;
  /** Answers `false` when nobody is at the keyboard — a 2.3 GB upload is never assumed. */
  readonly ask: (question: string) => Promise<boolean>;
  readonly say: (line: string) => void;
}

/** Measured: the server weighs 2.3 GB, the client 8. Anything past this is the client. */
const WEIGHT_THAT_IS_NO_LONGER_A_SERVER = 4 * 1024 ** 3;

const RESUME_QUESTION = 'steamcmd finished — re-check the Steam libraries?';

function gigabytes(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/**
 * The gesture an administrator repeats at every game update, guided rather than
 * demanded. It resolves what it can on its own — the key out of rclone, the
 * install out of the Steam libraries — and where it cannot, it hands over the
 * exact command to run and waits, because the one thing it can never do itself
 * is download files that only a machine owning the game may download (§7).
 *
 * It has no verb that removes, here or anywhere below. The objects of the older
 * file-by-file deposit outlive every run: dropping them is the administrator's
 * call, and these files under licence can only be deposited again from this one
 * machine.
 */
export async function runGuidedUpdate(ports: GuidedUpdatePorts): Promise<GuidedUpdateOutcome> {
  const { say } = ports;
  const key = gameArchiveKeyFor(ports.game);

  say(`beacon: ${ports.game} game files, from this machine into ${ports.bucketName}`);

  say('');
  say('1. The administrator key, never the machine one');
  let credentials: AdminCredentials;
  try {
    credentials = adminCredentialsFrom(await ports.rcloneConfigDump(), ADMIN_REMOTE);
  } catch (error) {
    say(`  STOP  ${error instanceof Error ? error.message : String(error)}`);
    say(`        rclone config show ${ADMIN_REMOTE}   says whether it exists at all.`);
    return 'refused';
  }
  say(`  ok    ${describeRemote(ADMIN_REMOTE, credentials)}`);
  say('  ok    no credential value is printed by this command, here or below');

  say('');
  say('2. The dedicated server install, which is not the game client');
  const libraries = steamLibraries(ports.files, ports.steamRoot);
  say(`  ok    ${libraries.length} Steam ${libraries.length === 1 ? 'library' : 'libraries'}: ${libraries.join(', ')}`);

  let installDir = ports.installDir ?? findDedicatedServer(ports.files, libraries);
  while (installDir === undefined) {
    sayHowToInstall(ports, libraries);
    if (!(await ports.ask(RESUME_QUESTION))) {
      say('  !     nothing deposited. Run the command above, then this one again.');
      return 'not-installed';
    }
    installDir = findDedicatedServer(ports.files, libraries);
  }

  say('');
  say('3. What is about to be deposited');
  if (!ports.files.exists(join(installDir, SERVER_BINARY))) {
    say(`  STOP  ${installDir} holds no ${SERVER_BINARY}.`);
    say('        That is the game client or a half-copied folder, not the dedicated server.');
    return 'refused';
  }
  const measure = ports.files.measure(installDir);
  say(`  ok    ${installDir}`);
  say(`  ok    ${gigabytes(measure.sizeBytes)}, ${measure.fileCount} files, ${SERVER_BINARY} present`);
  if (measure.sizeBytes > WEIGHT_THAT_IS_NO_LONGER_A_SERVER) {
    say('  !     that is far past the 2.3 GB a dedicated server weighs — this looks like');
    say('        the 8 GB game client. Check before answering below.');
  }

  say('');
  say('4. The deposit');
  if (!(await ports.ask(`build the archive and deposit it as ${key} in ${ports.bucketName}?`))) {
    say('  !     nothing deposited');
    return 'declined';
  }
  const bucket = ports.openBucket(credentials);
  await ports.pushArchive({ api: bucket, game: ports.game, from: installDir });

  // Read back rather than trust. `pushGameFiles` already compares the size it
  // deposited; this second look is what the operator gets to see, and it costs
  // a `list` — never a second `get` over 2.3 GB.
  const deposited = (await bucket.list(key)).find((summary) => summary.key === key);
  if (deposited === undefined) {
    throw new Error(`${key} is not in ${ports.bucketName} after a push that claimed success`);
  }
  say(`  ok    ${key} in ${ports.bucketName}, ${gigabytes(deposited.sizeBytes)}`);

  say('');
  say('5. What this command did not do');
  say('  !     nothing was deleted. The objects of the older file-by-file deposit are');
  say('        where they were: dropping them is your call, and only once a real session');
  say('        has booted on this archive. These files are under licence, and only a');
  say('        machine that owns the game can ever deposit them again.');
  return 'deposited';
}

function sayHowToInstall(ports: GuidedUpdatePorts, libraries: readonly string[]): void {
  const { say } = ports;
  const discovered = discoverSteamAccount(ports.files, ports.steamRoot);
  const account = ports.steamAccount ?? discovered?.name ?? '<your-steam-account>';

  say(`  !     no folder under any Steam library holds ${SERVER_BINARY}.`);
  say('        The dedicated server is a Steam application of its own, separate from the');
  say('        game client: an installed client is not an installed server.');
  say('');
  say('        Run this in another window, then come back here:');
  say('');
  say(`          ${steamcmdCommandFor({ installDir: suggestedInstallDir(libraries), account })}`);
  say('');
  say('        +force_install_dir comes before +login on purpose. Steam fixes its install');
  say('        root at login: placed after, the option is not refused, it is ignored, and');
  say("        the 2.3 GB land in steamcmd's own folder where nothing here will look.");
  say('');
  say('        No password on that line. +login <account> alone is enough — steamcmd asks');
  say('        for the rest, and Steam Guard asks again regardless. A password passed as');
  say('        an argument lands in the shell history, a plaintext file nothing cleans.');
  say('');
  // Only when the account was found rather than named: an operator who passed
  // --steam-account already knows which one owns the game, and telling him his
  // own answer is a guess would be false, not merely unhelpful.
  if (ports.steamAccount === undefined) sayAccountConfidence(ports, discovered);
}

/**
 * Says exactly what the pick is worth, and nothing more than that: a flagged
 * account is a real answer from the Steam client, not a coin flip, and saying
 * "it is a guess" about it would be as false as staying silent about a real
 * coin flip between two unflagged accounts — the ordinary state of a client
 * signed into more than one account over the years.
 */
function sayAccountConfidence(ports: GuidedUpdatePorts, discovered: DiscoveredSteamAccount | undefined): void {
  const { say } = ports;
  if (discovered === undefined) {
    say('        No account was found in the Steam client on this machine at all. Pass');
    say('        --steam-account=<name> to say which one owns the game.');
  } else if (discovered.flagged) {
    say(`        The account above, ${discovered.name}, is the one the Steam client itself`);
    say('        flagged as logged in. Pass --steam-account=<name> if this machine owns the');
    say('        game under a different account.');
  } else if (discovered.accountCount > 1) {
    say(`        The account above is a guess: ${discovered.accountCount} accounts are in the`);
    say('        Steam client, none flagged as logged in, so the first one found was taken.');
    say('        Pass --steam-account=<name> to say which one owns the game.');
  } else {
    say('        The account above is the only one in the Steam client on this machine, so');
    say('        it is likely right. Pass --steam-account=<name> if it owns the game under');
    say('        another.');
  }
  say('');
}
