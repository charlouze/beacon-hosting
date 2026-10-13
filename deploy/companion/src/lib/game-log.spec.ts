import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GAME_LOG_TAIL_BYTES, readLogTail } from './game-log.js';

let folder: string;

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'beacon-game-log-'));
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

describe('readLogTail', () => {
  it('reads a short file whole', () => {
    const path = join(folder, 'game.log');
    writeFileSync(path, 'line 1\nline 2\n');

    expect(readLogTail(path)).toBe('line 1\nline 2\n');
  });

  it('reads the end of a file longer than what it reads, and nothing before it', () => {
    const path = join(folder, 'game.log');
    writeFileSync(path, `first line\n${'x'.repeat(GAME_LOG_TAIL_BYTES)}\nlast line\n`);

    const tail = readLogTail(path);

    expect(GAME_LOG_TAIL_BYTES).toBe(65_536);
    expect(Buffer.byteLength(tail)).toBe(GAME_LOG_TAIL_BYTES);
    expect(tail.endsWith('last line\n')).toBe(true);
    expect(tail).not.toContain('first line');
  });

  // The ordinary case until the game's container exists: nothing has written
  // the file yet.
  it('reads a file that is not there as an empty one', () => {
    expect(readLogTail(join(folder, 'absent.log'))).toBe('');
  });

  it('reads what cannot be read as an empty file', () => {
    expect(readLogTail(folder)).toBe('');
  });
});
