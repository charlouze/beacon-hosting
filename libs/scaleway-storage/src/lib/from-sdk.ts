import { createWriteStream } from 'node:fs';
import { createReadStream, statSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  type S3Client,
} from '@aws-sdk/client-s3';
import type { ObjectApi, ObjectSummary } from './object-api.js';

/**
 * The sdk, behind the seam. Everything in this file is translation; there is no
 * decision to test here, which is why the adapter's suite runs against the fake
 * and this one is exercised by task 12's live measurement — the boundary
 * between the two buckets, taken by hand against the real account.
 */
export function fromS3(client: S3Client, bucket: string): ObjectApi {
  return {
    async list(prefix: string): Promise<ObjectSummary[]> {
      const summaries: ObjectSummary[] = [];
      let token: string | undefined;

      // Paged, because a bucket that has run for a year holds more than a
      // thousand keys and s3 truncates silently at that point — an unpaged list
      // would quietly stop offering the oldest saves.
      do {
        const page = await client.send(
          new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }),
        );
        for (const object of page.Contents ?? []) {
          if (object.Key === undefined || object.Size === undefined) continue;
          summaries.push({
            key: object.Key,
            sizeBytes: object.Size,
            lastModified: object.LastModified ?? new Date(0),
          });
        }
        token = page.NextContinuationToken;
      } while (token !== undefined);

      return summaries;
    },

    async put(key: string, fromFile: string): Promise<void> {
      // ContentLength is passed explicitly: a stream has no length, and without
      // it the sdk buffers the whole archive in memory on a machine that is
      // also running a game server.
      const sizeBytes = statSync(fromFile).size;
      const body = createReadStream(fromFile);
      try {
        await client.send(
          new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentLength: sizeBytes }),
        );
      } catch (error) {
        // A send that fails before reading the body — a bad endpoint, a refused
        // signature — leaves this stream with nobody to consume it, while every
        // caller deletes the file it points at on its way out. Destroying it
        // releases the descriptor, and the listener catches what destroying
        // cannot: an fs stream opens late, so the open still reports back, on a
        // file that is gone by then. That 'error' has no reader left to reach,
        // and an unhandled one ends the process — the deposit's real cause
        // never gets reported, and on a game machine the companion dies instead
        // of answering `failed` (§8). Whatever it says concerns a file this
        // deposit has already given up on.
        body.on('error', () => undefined);
        body.destroy();
        throw error;
      }
      // Nothing to close on success: the sdk consumed the stream, and reading it
      // to the end closes it.
    },

    async get(key: string, toFile: string): Promise<void> {
      const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (response.Body === undefined) {
        throw new Error(`s3 returned no body for ${key}`);
      }
      // Streamed to disk, and awaited: a save that arrives half-written is the
      // failure mode this whole tranche exists to prevent.
      await pipeline(response.Body as Readable, createWriteStream(toFile));
    },
  };
}
