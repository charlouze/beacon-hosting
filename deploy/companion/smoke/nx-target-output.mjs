// A target's own stdout, cut out of what `nx run` writes around it. Nx frames
// every target with a banner and a footer — on stdout, not stderr — so nothing
// can pipe `nx run <project>:<target>` straight into a file that has to be an
// executable script, or into a shell variable that has to be an object key. A
// first attempt at this harness did exactly that: the file it obtained carried
// the banner before the shebang, and `bash` died on `command not found` then on
// a syntax error.
//
// `render-smoke-compose.mjs` solves the same problem for the compose by
// anchoring on its `services:` line. Neither of this file's two callers has
// such an anchor — a bash script and a bare object key look like nothing in
// particular — so this reads the decoration itself: real target output never
// carries an ESC byte, by construction, so the first line that does is where
// Nx's own footer starts, and the run of ESC-bearing and blank lines at the top
// is its banner.
//
// Which is why every caller sets FORCE_COLOR=1, and why this refuses input
// without a single escape byte rather than guessing. Nx colours its banner
// through picocolors, whose `isColorSupported` depends on TTY and CI detection:
// unforced, the decoration is there on one machine and absent on another, and
// this harness would pass where it was written and fail where it runs.
const raw = await readStdin();

if (!raw.includes('\x1b')) {
  throw new Error(
    'nx-target-output: no ANSI escape anywhere on stdin — run nx with FORCE_COLOR=1, or this cannot tell its banner from the target\'s own output',
  );
}

// Nx's child process writes CRLF on this platform while the target's own
// output does not: normalising once removes a whole class of near-miss, the
// same one `extractComposeYaml` documents next door.
const lines = raw.replaceAll('\r', '').split('\n');

let start = 0;
while (start < lines.length && (lines[start] === '' || lines[start].includes('\x1b'))) start += 1;
if (start === lines.length) {
  throw new Error('nx-target-output: the target wrote nothing but decoration — did it fail?');
}

let end = start;
while (end < lines.length && !lines[end].includes('\x1b')) end += 1;
while (end > start && lines[end - 1] === '') end -= 1;

process.stdout.write(`${lines.slice(start, end).join('\n')}\n`);

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}
