import { readFileSync, writeFileSync } from 'node:fs';
import type { ObjectApi, ObjectSummary } from './object-api.js';

export interface FakeObjectApi extends ObjectApi {
  /** What the bucket holds, for an assertion no method of the port exposes. */
  readonly stored: Map<string, Buffer>;
  /** Make the next call of every method reject, to test what a refusal does. */
  breakWith(error: Error): void;
}

/**
 * A Map with an s3 shape. It is the double every test of this lib runs against,
 * and it holds real bytes: the adapter's job is to move a file, so a double that
 * pretended files were strings would prove nothing about the one thing it does.
 */
export function fakeObjectApi(): FakeObjectApi {
  const stored = new Map<string, Buffer>();
  const times = new Map<string, Date>();
  let broken: Error | null = null;

  const check = (): void => {
    if (broken !== null) throw broken;
  };

  return {
    stored,

    breakWith(error: Error): void {
      broken = error;
    },

    async list(prefix: string): Promise<ObjectSummary[]> {
      check();
      return [...stored.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, body]) => ({
          key,
          sizeBytes: body.byteLength,
          lastModified: times.get(key) ?? new Date(0),
        }));
    },

    async put(key: string, fromFile: string): Promise<void> {
      check();
      stored.set(key, readFileSync(fromFile));
      times.set(key, new Date());
    },

    async get(key: string, toFile: string): Promise<void> {
      check();
      const body = stored.get(key);
      if (body === undefined) throw new Error(`no such key: ${key}`);
      writeFileSync(toFile, body);
    },
  };
}
