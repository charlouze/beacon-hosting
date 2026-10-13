import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeObjectApi } from './fake-object-api.js';

let folder: string;

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'beacon-fake-object-api-'));
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

describe('fakeObjectApi', () => {
  it('says the whole object arrived, to whoever asked for the progress of a get', async () => {
    const api = fakeObjectApi();
    const source = join(folder, 'source');
    writeFileSync(source, Buffer.alloc(2_000, 7));
    await api.put('sunkenland/game.tar', source);
    const onProgress = vi.fn();

    await api.get('sunkenland/game.tar', join(folder, 'fetched'), onProgress);

    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(2_000, 2_000);
  });
});
