import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOGUE_PATH, repositoryIn } from './catalogue-pin.js';
import { companionFingerprint, workspaceRoot } from './fingerprint.js';
import { digestOf } from './registry.js';
import { runPin } from './run-pin.js';

const version = process.argv[2];
if (version === undefined || version === '') {
  throw new Error('usage: nx run companion:pin -- <version>, as the companion-v tag names it');
}

const root = workspaceRoot();
const catalogue = join(root, CATALOGUE_PATH);
const read = (): string => readFileSync(catalogue, 'utf8');

const repository = repositoryIn(read());
if (repository === null) {
  throw new Error(`${CATALOGUE_PATH} names no image to pin`);
}

const digest = await runPin({
  version,
  read,
  write: (text) => writeFileSync(catalogue, text),
  digest: (published) => digestOf(repository, published),
  fingerprint: () => companionFingerprint(root),
});

console.log(`beacon: pinned ${repository}:${version} — ${digest}`);
console.log(`beacon: commit ${CATALOGUE_PATH} and push; verify runs on your own push`);
