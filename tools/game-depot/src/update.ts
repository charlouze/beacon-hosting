import { type ExecSyncOptionsWithStringEncoding, execSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { S3Client } from '@aws-sdk/client-s3';
import { fromS3 } from '@beacon/scaleway-storage';
import { isGame } from '@beacon/session';
import { pushGameFiles } from './lib/game-depot.js';
import { runGuidedUpdate } from './lib/guided-update.js';
import { DEFAULT_STEAM_ROOT, type LocalFiles } from './lib/steam-install.js';

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

async function ask(question: string): Promise<boolean> {
  // Never assume yes. A run with no terminal — a CI, a piped shell, a task
  // runner that does not forward stdin — must not start a multi-gigabyte
  // upload nobody is watching.
  if (!process.stdin.isTTY) {
    console.log(`  ?     ${question}`);
    console.log('  !     no terminal to answer on — taking that as no');
    return false;
  }

  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await terminal.question(`  ?     ${question} [y/N] `);
    return ['y', 'yes', 'o', 'oui'].includes(answer.trim().toLowerCase());
  } finally {
    terminal.close();
  }
}

/**
 * The gesture repeated at every game update, guided from end to end: it finds
 * the key, finds the install or says exactly how to make one, shows what it is
 * about to send, deposits it and reads it back. Runs on the one machine that
 * owns the game (§7) — never a runner, never the VM, which only reads this
 * bucket.
 *
 * `push` stays next door for the scripted case: same deposit, no questions.
 */
try {
  const game = argValue('game') ?? 'sunkenland';
  if (!isGame(game)) throw new Error(`--game must name a game, got "${game}"`);
  // The application id and the server binary this flow looks for are
  // Sunkenland's, exactly like `SERVER_BINARY` next door. The other game gets
  // its files another way entirely, and would need its own pair before any of
  // this meant anything for it.
  if (game !== 'sunkenland') {
    throw new Error(
      `the guided update only knows sunkenland's Steam application, and ${game} does not use it — ` +
        `${game} downloads its own files through steamcmd on the game machine itself, and has nothing to deposit here`,
    );
  }

  const bucketName = process.env['BEACON_GAMES_BUCKET'] ?? 'beacon-games';

  const outcome = await runGuidedUpdate({
    game,
    bucketName,
    steamRoot: argValue('steam-root') ?? DEFAULT_STEAM_ROOT,
    installDir: argValue('from'),
    steamAccount: argValue('steam-account'),
    files: onDisk,
    rcloneConfigDump: async () => rcloneConfigDump(),
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
    say: (line) => console.log(line),
  });

  // Only a fault is red. Handing over the steamcmd line, or taking a `no`, is
  // this command doing its job, and a task runner that reports either as a
  // failed target teaches its operator to read past failed targets.
  if (outcome === 'refused') process.exitCode = 1;
} catch (error) {
  console.error(`beacon: ${String(error)}`);
  process.exitCode = 1;
}
