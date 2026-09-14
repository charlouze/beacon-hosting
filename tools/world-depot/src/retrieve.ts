import { execFileSync } from 'node:child_process';
import { S3Client } from '@aws-sdk/client-s3';
import { adminCredentialsFrom, describeRemote, ADMIN_REMOTE } from '@beacon/admin-key';
import { fromS3, ScalewaySaveStore } from '@beacon/scaleway-storage';
import { isGame, type Game } from '@beacon/session';
import { t as listArchive } from 'tar';
import { chooseSave } from './lib/choose.js';

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

/**
 * The name and GUID a Sunkenland world carries in its top-level folder —
 * `<name>~<guid>`, exactly `world-identity.ts` reads on the machine that
 * restores it. Read here without extracting: the archive never has to touch
 * disk twice for an administrator only asking what it holds.
 */
async function worldIdentity(archive: string): Promise<{ name: string; guid: string } | undefined> {
  const names: string[] = [];
  await listArchive({
    file: archive,
    onReadEntry: (entry) => {
      if (entry.type === 'Directory') names.push(entry.path.replace(/\/$/, ''));
    },
  });

  const candidates = names
    .map((name) => {
      const separator = name.indexOf('~');
      if (separator === -1) return null;
      const guid = name.slice(separator + 1);
      return GUID_PATTERN.test(guid) ? { name: name.slice(0, separator), guid } : null;
    })
    .filter((candidate): candidate is { name: string; guid: string } => candidate !== null);

  return candidates.length === 1 ? candidates[0] : undefined;
}

/**
 * Reads the administrator key out of rclone, exactly as `game-depot` does —
 * never out of the environment, so nothing is pasted into a terminal, a note,
 * or a chat before a retrieve.
 */
function rcloneConfigDump(): string {
  try {
    return execFileSync('rclone', ['config', 'dump'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    try {
      return execFileSync('mise', ['exec', '--', 'rclone', 'config', 'dump'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      throw new Error('neither `rclone` nor `mise exec -- rclone` would run, and one of them holds the admin key');
    }
  }
}

/**
 * An empty history is a legitimate answer — a world's first evening, the same
 * thought `newestSave` already carries by returning `undefined` rather than
 * refusing. But `--list` printing nothing at all reads as a breakage: the
 * administrator cannot tell "no save for this game" from "the command died
 * quietly". Said in the voice `adopt` already uses for the same situation.
 */
export const emptyHistoryMessage = (game: Game, bucket: string): string =>
  `${game} has no save yet in ${bucket}: nothing to list`;

/**
 * Hands the administrator back the world that lives in the bucket — never
 * writes to it. `SaveStore` has no delete and no prune (§8), which is what
 * keeps this a tool and not a script holding an administration key.
 */
try {
  const game = argValue('game');
  if (!isGame(game)) throw new Error(`--game must name a game, got "${game}"`);

  const credentials = adminCredentialsFrom(rcloneConfigDump(), ADMIN_REMOTE);
  console.log(describeRemote(ADMIN_REMOTE, credentials));

  const bucket = process.env['BEACON_SAVES_BUCKET'] ?? 'beacon-saves';
  const client = new S3Client({
    endpoint: credentials.endpoint,
    region: credentials.region,
    credentials: { accessKeyId: credentials.accessKeyId, secretAccessKey: credentials.secretAccessKey },
    forcePathStyle: false,
  });
  const store = new ScalewaySaveStore(fromS3(client, bucket));

  const history = await store.list(game);

  if (hasFlag('list')) {
    if (history.length === 0) {
      console.log(emptyHistoryMessage(game, bucket));
    }
    for (const save of history) {
      console.log(`${save.objectKey}  ${save.sizeBytes} bytes  ${save.createdAt.toISOString()}`);
    }
    process.exit(0);
  }

  const save = chooseSave(history, argValue('key'));
  if (save === undefined) {
    throw new Error(
      argValue('key') === undefined
        ? `no save found for ${game}`
        : `no save named ${argValue('key')} in ${game}'s history`,
    );
  }

  const to = argValue('to');
  if (to === undefined) throw new Error('--to is required: where to write the archive');

  await store.fetch(save, to);

  const identity = await worldIdentity(to);
  console.log(
    `retrieved ${save.objectKey} (${save.sizeBytes} bytes, ${save.createdAt.toISOString()})` +
      (identity === undefined ? '' : ` — ${identity.name} ~ ${identity.guid}`),
  );
} catch (error) {
  console.error(`beacon: ${String(error)}`);
  process.exitCode = 1;
}
