// The control plane, reduced to what the companion reads from it: always
// RUNNING — the shutdown path is task 13's to exercise, against a game that
// actually goes quiet on SIGTERM. What this test needs to see is what the
// companion *sent*, so every phase it reports is appended to a file `run.sh`
// reads back — that is the only way to know a report was ever answered
// rather than merely not rejected.
import { createServer } from 'node:http';
import { appendFileSync, mkdirSync } from 'node:fs';

// Relative to this process's own cwd (`run.sh` `cd`s into this directory
// before starting it), and under `tmp/` so it is never a file `git status`
// notices — an absolute `/tmp` would not be the same place on every host this
// runs on, Windows included.
const PHASES_LOG = './tmp/beacon-smoke-phases.log';
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
      const { phase } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      appendFileSync(PHASES_LOG, `${phase}\n`);
    } catch {
      // A body this cannot parse still gets answered below: the round trip
      // does not hinge on this test harness reading it back.
    }
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ state: 'RUNNING', deadlineIso: null }));
  });
  // Printed once bound, so `run.sh` can wait on it instead of guessing.
}).listen(8787, '0.0.0.0', () => {
  console.log('listening');
});
