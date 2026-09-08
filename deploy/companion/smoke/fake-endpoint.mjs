// The control plane, reduced to what the companion reads from it. It answers
// RUNNING until `run.sh` touches STOPPING_FLAG, its own one-verb signal for
// this harness — nothing more elaborate, in the spirit of the channel the
// companion's own shutdown uses (push.ts). What this test needs to see is
// what the companion *sent*, so every phase it reports is appended to a file
// `run.sh` reads back — that is the only way to know a report was ever
// answered rather than merely not rejected. A `saved` report's origin rides
// along on the same line: `BEACON_PUSH_INTERVAL_MS` is only checked once per
// report cycle, so a routine push has already run by the time this test
// asks for STOPPING — the bare phase would not say which one was the
// pre-shutdown archive. A `ready` report's identifier rides along the same
// way, and for the reason that is the whole point of the second game: it is
// the join point, only the machine discovers it, and a bare phase would say
// the server is up without saying what nobody can play without.
import { createServer } from 'node:http';
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';

// Relative to this process's own cwd (`run.sh` `cd`s into this directory
// before starting it), and under `tmp/` so it is never a file `git status`
// notices — an absolute `/tmp` would not be the same place on every host this
// runs on, Windows included.
const PHASES_LOG = './tmp/beacon-smoke-phases.log';
const STOPPING_FLAG = './tmp/beacon-smoke-stopping';
mkdirSync('./tmp', { recursive: true });

createServer((request, response) => {
  if (request.method !== 'POST' || !(request.headers.authorization ?? '').startsWith('Bearer ')) {
    response.writeHead(401).end();
    return;
  }
  const chunks = [];
  request.on('data', (chunk) => chunks.push(chunk));
  request.on('end', () => {
    try {
      const { phase, save, serverId } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      // Whichever of the two the report carries, appended raw: this file is
      // read back with `grep -qx`, so a value the companion mangled on the way
      // cannot match a value the stub wrote. Neither field is ever both.
      const carried = save ? ` ${save.origin}` : serverId ? ` ${serverId}` : '';
      appendFileSync(PHASES_LOG, `${phase}${carried}\n`);
    } catch {
      // A body this cannot parse still gets answered below: the round trip
      // does not hinge on this test harness reading it back.
    }
    const state = existsSync(STOPPING_FLAG) ? 'STOPPING' : 'RUNNING';
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ state, deadlineIso: null }));
  });
  // Printed once bound, so `run.sh` can wait on it instead of guessing.
}).listen(8787, '0.0.0.0', () => {
  console.log('listening');
});
