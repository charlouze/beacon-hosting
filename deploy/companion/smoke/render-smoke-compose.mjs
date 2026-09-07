// Turns the catalogue's real compose (read from stdin — `nx run
// cloud-init:render-compose`'s own output, banner and footer included; see
// `extractComposeYaml` below) into the one this harness launches. Everything
// that describes the real stack — images and their digests, volumes,
// `depends_on` and its condition, the `env_file` that carries the companion
// its variables — is copied through untouched; a service this script has
// never heard of still reaches the stack it prints. Only three things are
// patched, each named in task 11's brief as staying hand-written for the
// test: the game service becomes the stub, the companion's `env_file` is
// redirected to this harness's own values, and MinIO is appended.
//
// This is why a service added to the catalogue's compose, without a line
// changed here, changes what this harness launches: nothing below names
// `restore` or `agent`, only the one pattern (the companion's digest, the
// env_file target) that both currently share.
//
// The compose this prints is written under ./tmp, so every relative path in
// it resolves against ./tmp — which is exactly where ./data and ./control
// (both copied through untouched) should land: ephemeral, and already
// git-ignored. The two paths this script adds itself climb back out of
// ./tmp for that reason.
const COMPANION_DIGEST_RE = /ghcr\.io\/charlouze\/beacon-companion@sha256:[0-9a-f]+/g;

const raw = await readStdin();
const rendered = extractComposeYaml(raw);
const lines = rendered.split('\n');

const HEADER_RE = /^ {2}([A-Za-z0-9_-]+):$/;
const headers = [];
lines.forEach((line, index) => {
  const match = line.match(HEADER_RE);
  if (match) headers.push({ name: match[1], index });
});

const gameHeader = headers.find((header) => header.name === 'enshrouded');
if (!gameHeader) {
  throw new Error('rendered compose has no "enshrouded" service — cloud-init changed shape');
}
const gameEnd = (headers.find((header) => header.index > gameHeader.index) ?? { index: lines.length }).index;

// Depth is syntax here exactly as it is in the cloud-init (enshrouded.spec.ts):
// a line stops belonging to a block the moment it is no deeper than the line
// that opened it, or the chunk ends on a blank line.
function collectBlock(startIndex) {
  const baseIndent = lines[startIndex].match(/^ */)[0].length;
  let end = startIndex + 1;
  while (end < gameEnd) {
    const line = lines[end];
    if (line === '' || line.match(/^ */)[0].length <= baseIndent) break;
    end += 1;
  }
  return lines.slice(startIndex, end);
}

function findLine(pattern) {
  for (let index = gameHeader.index; index < gameEnd; index += 1) {
    if (lines[index] === pattern) return index;
  }
  throw new Error(`rendered "enshrouded" service has no "${pattern}" line`);
}

// Kept, not retyped: task 11 golden rule holds only if the stub waits on the
// same restore the real game waits on, and lands on the same mount.
const dependsOnBlock = collectBlock(findLine('    depends_on:'));
const volumesBlock = collectBlock(findLine('    volumes:'));

const stubBlock = [
  '  enshrouded:',
  '    # The stub (task 13 covers booting the real image): answers A2S, writes a',
  "    # world, and dies on SIGTERM — same digest as this image's own Dockerfile,",
  '    # so nothing here hand-duplicates a second copy of that pin.',
  '    image: node:22-alpine@sha256:c610fcdfb1d5b4740dd70c284ed3cb16bb857e0f7166196e36a5501df7a3aa32',
  '    container_name: enshrouded',
  '    command: ["node", "/opt/stub-game.mjs"]',
  ...dependsOnBlock,
  '    environment:',
  '      SAVE_DIR: /opt/enshrouded/server/savegame',
  ...volumesBlock,
  '      - ../stub-game.mjs:/opt/stub-game.mjs:ro',
  '',
];

let output = [...lines.slice(0, gameHeader.index), ...stubBlock, ...lines.slice(gameEnd)].join('\n');

// A transformation that can silently do nothing is not a transformation: if
// the pattern it looks for ever stops matching (a registry move, a rename,
// uppercase hex in a digest), replacing zero occurrences must fail loudly —
// the alternative is a harness that goes green pulling the already-published
// image, having run the candidate build not at all.
function mustReplaceAll(text, pattern, replacement, what) {
  const count = pattern instanceof RegExp ? (text.match(pattern) ?? []).length : text.split(pattern).length - 1;
  if (count === 0) {
    throw new Error(`render-smoke-compose: expected to replace ${what}, found no occurrence`);
  }
  return text.replaceAll(pattern, replacement);
}

// The companion's own image, wherever it appears (today: restore and agent) —
// never named, so a third companion service inherits this the same way.
output = mustReplaceAll(output, COMPANION_DIGEST_RE, 'beacon-companion:smoke', "the companion's own image reference");

// The companion reads its BEACON_* variables from one env_file; this harness
// gives it a different file with the same shape (smoke.env), never inline keys.
output = mustReplaceAll(output, '/opt/beacon/companion.env', '../smoke.env', "the companion's env_file target");
output = mustReplaceAll(
  output,
  '    env_file:\n      - ../smoke.env\n',
  '    env_file:\n      - ../smoke.env\n' +
    '    # Only this harness needs to reach the fake endpoint on the host; nothing\n' +
    '    # in production resolves this name.\n' +
    '    extra_hosts:\n' +
    '      - "host.docker.internal:host-gateway"\n',
  'the env_file block to attach extra_hosts to',
);

// `restore` is the one companion service with nothing upstream of it in
// production; here it has MinIO, and only here — a future companion service
// that also writes before the bucket exists would need the same line.
output = mustReplaceAll(
  output,
  '    container_name: beacon-restore\n',
  '    container_name: beacon-restore\n' +
    '    depends_on:\n' +
    '      bucket:\n' +
    '        condition: service_healthy\n',
  "restore's container_name, to attach its dependency on bucket",
);

// The one service with no equivalent in the render at all: what backs the
// companion's own bucket, hand-written because nothing else describes it.
output +=
  '\n' +
  '  # Not in the catalogue: what backs the companion\'s own bucket in this harness.\n' +
  '  bucket:\n' +
  '    image: minio/minio@sha256:14cea493d9a34af32f524e538b8346cf79f3321eff8e708c1e2960462bd8936e\n' +
  '    command: ["server", "/data"]\n' +
  '    environment:\n' +
  '      MINIO_ROOT_USER: smoke\n' +
  '      MINIO_ROOT_PASSWORD: smokesmoke\n' +
  '      # Without this, MinIO cannot tell that a `Host: beacon-saves.bucket` header\n' +
  '      # names the beacon-saves bucket rather than an opaque hostname — every\n' +
  '      # virtual-hosted-style request the companion sends would 404.\n' +
  '      MINIO_DOMAIN: bucket\n' +
  '    healthcheck:\n' +
  '      test: ["CMD", "mc", "ready", "local"]\n' +
  '      interval: 2s\n' +
  '      retries: 30\n' +
  '    # Scaleway is addressed virtual-hosted style (forcePathStyle: false,\n' +
  '    # hardcoded in container.ts because that is what production talks to), so\n' +
  '    # this alias makes `beacon-saves.bucket` resolve to this container, on this\n' +
  '    # network only.\n' +
  '    networks:\n' +
  '      default:\n' +
  '        aliases:\n' +
  '          - beacon-saves.bucket\n';

process.stdout.write(output);

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

/**
 * `nx run` wraps a target's own output in a banner and a footer — on stdout,
 * not stderr, and unconditionally, in this Nx version — so this cannot just
 * pipe `nx run cloud-init:render-compose` through. Indentation alone cannot
 * find the boundary: the footer's own lines ("  Run duration:", "  Cache:")
 * are two-space indented too, and a first attempt at this that assumed
 * otherwise let the whole footer leak into the compose, which then failed to
 * parse as YAML (a raw ESC byte is not valid content). That failure is what
 * this now relies on instead: real compose content never contains an ESC
 * byte, by construction, so the first line that does is never real content —
 * it is the start of Nx's own decoration, however it is styled. Reading
 * directly from `render.ts` (no Nx wrapper, no ESC byte anywhere) trims to
 * the same result, so this works either way.
 */
function extractComposeYaml(text) {
  // Nx's child process writes CRLF somewhere on this platform: a naive split
  // on '\n' alone leaves a stray '\r' as its own "line", which is not the
  // empty string and survives a blank-line trim that only checks for one —
  // the exact way a first attempt at this let one wrong blank line through.
  // Normalising once here removes that whole class of near-miss.
  const rawLines = text.replaceAll('\r', '').split('\n');
  const start = rawLines.indexOf('services:');
  if (start === -1) {
    throw new Error('render-smoke-compose: no "services:" line in the input — is this cloud-init:render-compose\'s output?');
  }
  let end = rawLines.length;
  for (let index = start + 1; index < rawLines.length; index += 1) {
    if (rawLines[index].includes('\x1b')) {
      end = index;
      break;
    }
  }
  while (end > start && rawLines[end - 1] === '') end -= 1;
  return rawLines.slice(start, end).join('\n');
}
