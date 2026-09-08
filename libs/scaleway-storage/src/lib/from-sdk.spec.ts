import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Readable } from 'node:stream';
import type { S3Client } from '@aws-sdk/client-s3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fromS3 } from './from-sdk.js';

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
 * before anything of the body has been read. It keeps the command it was
 * handed, which is the only way to see what the adapter left behind.
 */
function refusingClient(failure: Error): { client: S3Client; body: () => Readable | undefined } {
  let sent: Readable | undefined;
  const client = {
    send: (command: { input: { Body?: unknown } }) => {
      sent = command.input.Body as Readable | undefined;
      return Promise.reject(failure);
    },
  };
  return { client: client as unknown as S3Client, body: () => sent };
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
    const { client, body } = refusingClient(new TypeError('Invalid URL'));

    await expect(fromS3(client, 'beacon-games').put('sunkenland/game.tar', archive())).rejects.toThrow();

    expect(body()?.destroyed).toBe(true);
  });
});
