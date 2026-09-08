import { readFileSync } from 'node:fs';
import type { Readiness } from './readiness.js';

/**
 * Bounded like every value this wire carries (§5) — a file something else
 * filled must not grow a report the Function accepts once a minute.
 */
const MAX_LENGTH = 1024;

/**
 * The only source of this game's join point (§6): no provider api and no
 * queryable port carries it, and it changes at every boot. Task 5's entry
 * point writes to a temp file and renames it into place, so what this reads
 * is always either absent or whole — never a line cut halfway through.
 *
 * Re-read on every call, and nothing is cached here. What makes a ready server
 * stay ready is the file surviving on disk, and what keeps the wire to a single
 * `ready` is `announced` in `agent-loop.ts` — neither is this function's to
 * hold. So this is no liveness check either: measured for §6, this game's
 * periodic status line only prints once a player has connected, and silence
 * would say nothing about the server being alive. `push.ts` polls it while
 * waiting for quiet and, for this game, gets `ready` right up to the deadline.
 */
export function readServerId(path: string): () => Promise<Readiness> {
  return async (): Promise<Readiness> => {
    let content: string;
    try {
      content = readFileSync(path, 'utf8');
    } catch {
      // The ordinary case for the first minutes of every session: nothing
      // has written the file yet.
      return { ready: false };
    }

    const serverId = content.trim();
    // Empty means nobody has finished writing yet, and oversized means
    // something has gone wrong upstream — either way "not ready" is the
    // honest answer. Judging the *shape* of the identifier is the
    // catalogue's job: this project names no game.
    if (serverId.length === 0 || serverId.length > MAX_LENGTH) {
      return { ready: false };
    }
    return { ready: true, serverId };
  };
}
