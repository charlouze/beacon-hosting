import { S3Client } from '@aws-sdk/client-s3';
import { fromS3, ScalewaySaveStore } from '@beacon/scaleway-storage';
import type { SaveStore } from '@beacon/session';
import type { CompanionConfig } from './config.js';
import type { RestoreDeps } from './restore.js';

let client: S3Client | undefined;

/**
 * The composition root of this machine, and the only place that names a
 * client. One account holds both buckets (§7), so `buildSaveStore` and
 * `buildGameFiles` share this single instance rather than each opening its
 * own connection to the same endpoint.
 */
function s3Client(config: CompanionConfig): S3Client {
  if (client === undefined) {
    client = new S3Client({
      endpoint: config.s3.endpoint,
      region: config.s3.region,
      credentials: {
        accessKeyId: config.s3.accessKey,
        secretAccessKey: config.s3.secretKey,
      },
      // Scaleway serves the bucket as a subdomain of the endpoint, which is
      // the path style the sdk defaults away from. Without this every call
      // goes to the endpoint's root and answers a 404 that reads like a
      // missing object.
      forcePathStyle: false,
    });
  }
  return client;
}

export function buildSaveStore(config: CompanionConfig): SaveStore {
  return new ScalewaySaveStore(fromS3(s3Client(config), config.savesBucket));
}

/**
 * `undefined` when the catalogue wrote no game files pair — the game that
 * downloads its own files never touches the games bucket at all. Present, it
 * is exactly the shape `RestoreDeps.gameFiles` expects: a second intermediate
 * shape here would only be translated one line downstream.
 */
export function buildGameFiles(config: CompanionConfig): RestoreDeps['gameFiles'] {
  if (config.gameFiles === undefined) return undefined;
  return {
    api: fromS3(s3Client(config), config.gamesBucket),
    directory: config.gameFiles.directory,
    objectKey: config.gameFiles.objectKey,
  };
}
