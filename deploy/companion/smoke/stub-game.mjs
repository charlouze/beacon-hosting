// Everything the companion asks of a game server, and nothing a game does. It
// writes a world, it becomes ready the way the catalogue says this game becomes
// ready, and it dies on SIGTERM — which is what a `docker stop` sends, and what
// the one-verb channel triggers.
import { createSocket } from 'node:dgram';
import { randomBytes } from 'node:crypto';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

// No default: a silent fallback to one game's save directory would let a
// second game's harness pass while writing that first game's world instead
// of its own.
const dir = process.env.SAVE_DIR;
mkdirSync(dir, { recursive: true });

// Twenty kilobytes of random bytes, so the archive lands well above the floor
// of a save once gzipped. A constant fill compresses to a few hundred bytes —
// under the floor — and would make the round trip fail for the wrong reason.
writeFileSync(join(dir, '3ad85aea'), randomBytes(20_000));
writeFileSync(join(dir, '3ad85aea-index'), randomBytes(512));

/**
 * The world above is written at once, the announcement below is not, and the
 * order is the measured one: a server has its world folder long before it
 * finishes booting — 121 to 205 seconds for the real image (probe/RESULTS.md).
 * What the probe has to survive is the wait, so this stub makes it wait. Twenty
 * seconds is one report cycle short of a minute: the agent reports `alive` at
 * least once, and cannot report `ready` on its very first turn.
 */
const ANNOUNCE_DELAY_MS = 20_000;

/** Long enough to say nothing about readiness, short enough to notice at all. */
const HEARTBEAT_MS = 60_000;

// `BEACON_READY_PROBE`, as the catalogue writes it and as `readiness.ts` reads
// it — passed in by render-smoke-compose.mjs. The stub answers the probe the
// catalogue declared rather than one it picked: a stub that always answered
// A2S would have this whole harness prove a readiness no second game uses.
const probe = process.env.READY_PROBE ?? '';
const a2s = /^a2s:\/\/[^:/]+:(\d+)$/.exec(probe);
const serverid = /^serverid:\/\/(.+)$/.exec(probe);

if (a2s !== null) {
  answerQueries(Number(a2s[1]));
} else if (serverid !== null) {
  announceIdentifier(serverid[1]);
} else {
  throw new Error(`stub-game: READY_PROBE names no probe this stub can answer: "${probe}"`);
}

/** The game queried like a player would query it. Binding holds the process open. */
function answerQueries(port) {
  const HEADER = Buffer.from([0xff, 0xff, 0xff, 0xff]);
  const socket = createSocket('udp4');
  socket.on('message', (_message, from) => {
    socket.send(
      Buffer.concat([HEADER, Buffer.from([0x49]), Buffer.from('beacon-stub\0')]),
      from.port,
      from.address,
    );
  });
  socket.bind(port);

  process.on('SIGTERM', () => {
    socket.close();
    process.exit(0);
  });
}

/**
 * The game whose join point only the machine discovers: it writes one file,
 * which is the whole of what its container ever shows the rest of the machine
 * (§7). The value is handed in rather than invented here, because run.sh
 * asserts the very same one came back out of the report.
 */
function announceIdentifier(path) {
  const serverId = process.env.SERVER_ID;
  if (!serverId) {
    throw new Error('stub-game: SERVER_ID is required when readiness is an identifier');
  }
  mkdirSync(dirname(path), { recursive: true });

  const announce = setTimeout(() => {
    // Aside then renamed, exactly as the entry point's own filter does: the
    // agent reads this file every thirty seconds, and half a line would be a
    // failure this harness invented rather than one it found.
    writeFileSync(`${path}.tmp`, `${serverId}\n`);
    renameSync(`${path}.tmp`, path);
  }, ANNOUNCE_DELAY_MS);

  // Something has to hold this process open once the announcement is written.
  // A stub that exited would leave the game container stopped, and the last
  // assertion of run.sh — that the game is no longer running — would then pass
  // without the one-verb channel ever having stopped anything.
  //
  // It prints, rather than idling, because holding the loop open is only half
  // of what a real server does here: this container's log is the one place a
  // human reads while the harness waits its several minutes, and a silent stub
  // is indistinguishable there from one that died after announcing.
  const alive = setInterval(() => {
    console.log(`stub-game: still serving ${serverId}`);
  }, HEARTBEAT_MS);

  process.on('SIGTERM', () => {
    clearTimeout(announce);
    clearInterval(alive);
    process.exit(0);
  });
}
