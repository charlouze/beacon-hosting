import { execFileSync } from 'node:child_process';
import { S3Client } from '@aws-sdk/client-s3';
import { adminCredentialsFrom, describeRemote, ADMIN_REMOTE } from '@beacon/admin-key';
import { fromS3, ScalewaySaveStore } from '@beacon/scaleway-storage';
import { savesBucketFrom } from './bucket.js';

/**
 * Reads the administrator key out of rclone, exactly as `game-depot` does —
 * never out of the environment, so nothing is pasted into a terminal, a note,
 * or a chat before a retrieve or an adoption.
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
 * The one door both gestures go through. What remains here is wiring — it
 * spawns rclone and builds an s3 client — and the one decision that is not,
 * which bucket receives the write, lives in `bucket.ts` where a test reaches
 * it.
 *
 * There is exactly one copy of it because there is exactly one credential
 * path: two would be two places to forget that the key comes from rclone.
 *
 * It answers the bucket's name alongside the store, because the caller has to
 * be able to say it out loud: a confirmation that hides its destination is not
 * a confirmation.
 */
export function adminSaveStore(): { store: ScalewaySaveStore; bucket: string } {
  const bucket = savesBucketFrom(process.env);
  const credentials = adminCredentialsFrom(rcloneConfigDump(), ADMIN_REMOTE);
  console.log(describeRemote(ADMIN_REMOTE, credentials));

  const client = new S3Client({
    endpoint: credentials.endpoint,
    region: credentials.region,
    credentials: { accessKeyId: credentials.accessKeyId, secretAccessKey: credentials.secretAccessKey },
    forcePathStyle: false,
  });
  return { store: new ScalewaySaveStore(fromS3(client, bucket)), bucket };
}
