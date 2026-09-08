import { S3Client } from '@aws-sdk/client-s3';
import { fromS3 } from '@beacon/scaleway-storage';
import { isGame } from '@beacon/session';
import { gameArchiveKeyFor, pushGameFiles } from './lib/game-depot.js';

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value === '') {
    // Named, and it fails now: an administrator running this by hand should
    // learn which credential is missing before a multi-gigabyte upload
    // starts, not from an opaque signature error partway through it.
    throw new Error(`${name} is required`);
  }
  return value;
}

/**
 * Runs on the one machine that holds the game (§7) — never a runner, never
 * the VM, which only ever reads this bucket. Task 11 is the only caller, with
 * the administrator's own key, never the machine's.
 */
try {
  const game = argValue('game');
  if (!isGame(game)) throw new Error(`--game must name a game, got "${game}"`);

  const from = argValue('from');
  if (from === undefined) {
    throw new Error('--from is required: the local folder holding the game files');
  }

  const client = new S3Client({
    endpoint: requiredEnv('BEACON_S3_ENDPOINT'),
    region: requiredEnv('BEACON_S3_REGION'),
    credentials: {
      accessKeyId: requiredEnv('BEACON_S3_ACCESS_KEY'),
      secretAccessKey: requiredEnv('BEACON_S3_SECRET_KEY'),
    },
    // Scaleway serves the bucket as a subdomain of the endpoint, which is the
    // path style the sdk defaults away from (mirrors deploy/companion).
    forcePathStyle: false,
  });

  await pushGameFiles({ api: fromS3(client, requiredEnv('BEACON_GAMES_BUCKET')), game, from });
  console.log(`beacon: pushed ${gameArchiveKeyFor(game)}`);
} catch (error) {
  console.error(`beacon: ${String(error)}`);
  process.exitCode = 1;
}
