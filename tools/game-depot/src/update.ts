import { type ExecSyncOptionsWithStringEncoding, execSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { S3Client } from '@aws-sdk/client-s3';
import { adminFirestore, proveAdminIdentity } from '@beacon/admin-firestore';
import { fromS3 } from '@beacon/scaleway-storage';
import { gameCopyRecord } from '@beacon/session-record';
import type { Game } from '@beacon/session';
import { gamesWithACopy } from './lib/copy-application.js';
import { pushGameFiles } from './lib/game-depot.js';
import { type Steamcmd, runGuidedUpdate } from './lib/guided-update.js';
import { recordDestinationFrom } from './lib/record-destination.js';
import { DEFAULT_STEAM_ROOT, type LocalFiles, findSteamcmd, steamcmdArgumentsFor } from './lib/steam-install.js';

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

const onDisk: LocalFiles = {
  exists: (path) => existsSync(path),

  readText: (path) => (existsSync(path) ? readFileSync(path, 'utf8') : undefined),

  subdirectories: (path) =>
    existsSync(path)
      ? readdirSync(path, { withFileTypes: true })
          .filter((entry) => entry.isDirectory())
          .map((entry) => join(path, entry.name))
      : [],

  measure: (path) => {
    let fileCount = 0;
    let sizeBytes = 0;
    for (const entry of readdirSync(path, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile()) continue;
      fileCount += 1;
      sizeBytes += statSync(join(entry.parentPath, entry.name)).size;
    }
    return { fileCount, sizeBytes };
  },
};

/**
 * The administrator key, in the one format the flow knows how to read. Always
 * pulled fresh out of rclone — never out of the environment — so a deposit
 * needs nothing exported by hand, and therefore no credential pasted into a
 * terminal, a note, or a chat.
 *
 * An environment override was tried and dropped: it labelled whatever four
 * `BEACON_S3_*` values it found as `scw-admin` regardless of where they truly
 * came from, which is only true while the sole exporter of those names
 * happens to be `scw-admin`. Silently false the day someone exports the
 * machine's own key under the same names — a corruption this module refuses
 * on every other path. The scripted case that wants to skip rclone is `push`,
 * which reads the same four values directly and never relabels them.
 */
function rcloneConfigDump(): string {
  // stderr is dropped on purpose: rclone writes its config path in there, and
  // nothing this command prints may hint at where a secret lives.
  const quietly: ExecSyncOptionsWithStringEncoding = {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  };
  try {
    return execSync('rclone config dump', quietly);
  } catch {
    // rclone is pinned in mise.toml, so a shell that never activated mise still
    // reaches the same version through `mise exec` — as the sibling PowerShell
    // bootstrap does.
    try {
      return execSync('mise exec -- rclone config dump', quietly);
    } catch {
      throw new Error('neither `rclone` nor `mise exec -- rclone` would run, and one of them holds the admin key');
    }
  }
}

/**
 * steamcmd.exe as found on the PATH, and launched as that very file in the
 * operator's terminal. `spawn` runs an `.exe` without a shell, so the install
 * folder reaches steamcmd as one argument whatever spaces it holds.
 */
function steamcmdOnThisMachine(): Steamcmd {
  const path = findSteamcmd(process.env['PATH'], existsSync);
  return {
    present: () => path !== undefined,
    install: (target) =>
      new Promise((resolve, reject) => {
        if (path === undefined) {
          reject(new Error('steamcmd.exe is not on the PATH'));
          return;
        }
        const child = spawn(path, [...steamcmdArgumentsFor(target)], { stdio: 'inherit' });
        child.on('error', reject);
        child.on('exit', (code, signal) =>
          code === null ? reject(new Error(`steamcmd ended on ${signal}`)) : resolve(code),
        );
      }),
  };
}

async function ask(question: string): Promise<boolean> {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await terminal.question(`  ?     ${question} [y/N] `);
    return ['y', 'yes', 'o', 'oui'].includes(answer.trim().toLowerCase());
  } finally {
    terminal.close();
  }
}

async function choose(question: string, games: readonly Game[]): Promise<Game | undefined> {
  games.forEach((game, index) => console.log(`        ${index + 1}. ${game}`));
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await terminal.question(`  ?     ${question} [1-${games.length}] `);
    return games[Number(answer.trim()) - 1];
  } finally {
    terminal.close();
  }
}

/**
 * The gesture repeated at every game update, guided from end to end: it finds
 * the key, has steamcmd bring the install to the build the publisher
 * publishes, shows what it is about to send, deposits it, reads it back and
 * records its version. Runs on a machine that owns the game — never a runner,
 * never the VM, which only reads this bucket.
 *
 * `push` stays next door for the scripted case: same deposit, no download, no
 * questions.
 */
try {
  const bucketName = process.env['BEACON_GAMES_BUCKET'] ?? 'beacon-games';

  const from = argValue('from');

  const outcome = await runGuidedUpdate({
    requestedGame: argValue('game'),
    games: gamesWithACopy(),
    bucketName,
    steamRoot: argValue('steam-root') ?? DEFAULT_STEAM_ROOT,
    recordDestination: recordDestinationFrom(process.env),
    installDir: from === undefined ? undefined : resolve(from),
    steamAccount: argValue('steam-account'),
    files: onDisk,
    record: gameCopyRecord(adminFirestore(process.env)),
    steamcmd: steamcmdOnThisMachine(),
    // stdout too: steamcmd inherits it, and holds all it writes to a pipe until
    // it exits (probe/RESULTS.md, section O).
    canAnswer: process.stdin.isTTY === true && process.stdout.isTTY === true,
    rcloneConfigDump: async () => rcloneConfigDump(),
    proveIdentity: () => proveAdminIdentity(process.env),
    openBucket: (credentials) =>
      fromS3(
        new S3Client({
          endpoint: credentials.endpoint,
          region: credentials.region,
          credentials: { accessKeyId: credentials.accessKeyId, secretAccessKey: credentials.secretAccessKey },
          // Scaleway serves the bucket as a subdomain of the endpoint, which is
          // the path style the sdk defaults away from (mirrors push.ts).
          forcePathStyle: false,
        }),
        bucketName,
      ),
    pushArchive: pushGameFiles,
    ask,
    choose,
    say: (line) => console.log(line),
  });

  // Only a fault is red. Taking a `no` is this command doing its job, and a
  // task runner that reports it as a failed target teaches its operator to
  // read past failed targets.
  if (outcome === 'refused') process.exitCode = 1;
} catch (error) {
  console.error(`beacon: ${String(error)}`);
  process.exitCode = 1;
}
