import { closeSync, fstatSync, openSync, readSync } from 'node:fs';

/** How much of the game's output a turn of the agent reads: its end, and no more. */
export const GAME_LOG_TAIL_BYTES = 65_536;

/**
 * The end of what the game printed. The file grows for the whole session, so
 * it is never read whole. Absent or unreadable, it reads as empty: until the
 * game's container exists nothing has written it, and that is no failure.
 */
export function readLogTail(path: string, maxBytes = GAME_LOG_TAIL_BYTES): string {
  let file: number;
  try {
    file = openSync(path, 'r');
  } catch {
    return '';
  }
  try {
    const size = fstatSync(file).size;
    const length = Math.min(size, maxBytes);
    const tail = Buffer.alloc(length);
    const read = readSync(file, tail, 0, length, size - length);
    return tail.subarray(0, read).toString('utf8');
  } catch {
    return '';
  } finally {
    closeSync(file);
  }
}
