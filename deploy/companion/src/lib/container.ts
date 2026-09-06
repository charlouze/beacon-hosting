import { S3Client } from '@aws-sdk/client-s3';
import { fromS3, ScalewaySaveStore } from '@beacon/scaleway-storage';
import type { SaveStore } from '@beacon/session';
import type { CompanionConfig } from './config.js';

/** The composition root of this machine. The only place that names a client. */
export function buildSaveStore(config: CompanionConfig): SaveStore {
  const client = new S3Client({
    endpoint: config.s3.endpoint,
    region: config.s3.region,
    credentials: {
      accessKeyId: config.s3.accessKey,
      secretAccessKey: config.s3.secretKey,
    },
    // Scaleway serves the bucket as a subdomain of the endpoint, which is the
    // path style the sdk defaults away from. Without this every call goes to
    // the endpoint's root and answers a 404 that reads like a missing object.
    forcePathStyle: false,
  });
  return new ScalewaySaveStore(fromS3(client, config.savesBucket));
}
