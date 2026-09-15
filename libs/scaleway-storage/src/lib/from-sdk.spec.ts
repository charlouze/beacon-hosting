import { createReadStream, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import type { S3Client } from '@aws-sdk/client-s3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fromS3 } from './from-sdk.js';

// Only `createReadStream` is wrapped, so a test can see the exact stream this
// adapter opened; every other export of `node:fs` passes through untouched.
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return { ...actual, createReadStream: vi.fn(actual.createReadStream) };
});

let folder: string;

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'beacon-from-sdk-'));
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

const archive = (): string => {
  const path = join(folder, 'game.tar');
  writeFileSync(path, Buffer.alloc(4096, 7));
  return path;
};

/**
 * A client that refuses every call, the way a misconfigured endpoint does:
 * before anything of the body has been read.
 *
 * `config` is the empty object a real `S3Client` never is: `Upload` reads
 * `client.config` before it ever calls `send`, so a fake missing it fails on
 * a `TypeError`, not on the rejection this test means to exercise.
 */
function refusingClient(failure: Error): { client: S3Client } {
  const client = { config: {}, send: () => Promise.reject(failure) };
  return { client: client as unknown as S3Client };
}

/**
 * A client that plays the multipart handshake instead of a single `PutObject`
 * — `Upload` (`@aws-sdk/lib-storage`) takes this path itself once a body
 * exceeds one part, `CreateMultipartUpload` before any part gains an upload
 * id. Naming the command by its constructor is what lets this test tell a
 * multipart deposit from a single oversized `PutObject` apart.
 */
function multipartCapableClient(): { client: S3Client; commandNames: () => string[] } {
  const commandNames: string[] = [];
  const client = {
    config: {
      requestHandler: {},
      requestChecksumCalculation: () => Promise.resolve('WHEN_SUPPORTED'),
    },
    send: (command: { constructor: { name: string }; input: { PartNumber?: number } }) => {
      commandNames.push(command.constructor.name);
      switch (command.constructor.name) {
        case 'CreateMultipartUploadCommand':
          return Promise.resolve({ UploadId: 'upload-1' });
        case 'UploadPartCommand':
          return Promise.resolve({ ETag: `"etag-${command.input.PartNumber}"` });
        case 'CompleteMultipartUploadCommand':
          return Promise.resolve({ Location: 'https://beacon-games.example/sunkenland/game.tar' });
        default:
          return Promise.reject(new Error(`unexpected command ${command.constructor.name}`));
      }
    },
  };
  return { client: client as unknown as S3Client, commandNames: () => commandNames };
}

describe('putting a file when the deposit is refused', () => {
  it('rejects with the failure that caused it, and lets the caller delete its work', async () => {
    const failure = new TypeError('Invalid URL');
    const { client } = refusingClient(failure);

    await expect(fromS3(client, 'beacon-games').put('sunkenland/game.tar', archive())).rejects.toBe(failure);

    // What every caller does next: `pushGameFiles` wipes its temporary folder
    // in a `finally`. A stream still waiting to be read would open on a file
    // that no longer exists and emit an 'error' with no listener on it, which
    // ends the process — losing the failure above, on the game machine as much
    // as here.
    rmSync(folder, { recursive: true, force: true });
    await new Promise((resolve) => setTimeout(resolve, 50));
  });

  it('leaves no read stream open behind it', async () => {
    const { client } = refusingClient(new TypeError('Invalid URL'));

    await expect(fromS3(client, 'beacon-games').put('sunkenland/game.tar', archive())).rejects.toThrow();

    const opened = vi.mocked(createReadStream).mock.results[0]?.value as Readable | undefined;
    expect(opened?.destroyed).toBe(true);
  });
});

describe('putting a file larger than a single S3 part', () => {
  it('deposits it as multiple parts instead of one PutObject over the 5 GiB limit', async () => {
    const path = join(folder, 'game.tar');
    writeFileSync(path, Buffer.alloc(6 * 1024 * 1024, 7));
    const { client, commandNames } = multipartCapableClient();

    await fromS3(client, 'beacon-games').put('sunkenland/game.tar', path);

    expect(commandNames()).toContain('CreateMultipartUploadCommand');
    expect(commandNames()).toContain('CompleteMultipartUploadCommand');
    expect(commandNames()).not.toContain('PutObjectCommand');
  });
});
