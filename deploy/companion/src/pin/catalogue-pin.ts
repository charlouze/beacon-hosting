import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { workspaceRoot } from './fingerprint.js';

/**
 * The one place that knows how the catalogue spells its pin — read here, and
 * written here by `companion:pin`. Its shape is duplicated nowhere else: a
 * second reader would be a second answer to "which image ran tonight", which
 * `companion-image.ts` exists to prevent.
 */
const SOURCES = /(COMPANION_SOURCES\s*=\s*['"])(sha256:[0-9a-f]{64})(['"])/;

/** Null when the catalogue carries no fingerprint yet. */
export function sourcesIn(catalogue: string): string | null {
  return SOURCES.exec(catalogue)?.[2] ?? null;
}

const DIGEST = /(beacon-companion@)sha256:[0-9a-f]{64}/;
const REPOSITORY = /ghcr\.io\/([^@'"]+)@sha256:/;

/** Where the pinned image lives, so no second place has to spell it. */
export function repositoryIn(catalogue: string): string | null {
  return REPOSITORY.exec(catalogue)?.[1] ?? null;
}

/**
 * Both lines or neither. A digest moved without its fingerprint would pass the
 * guard while naming an image built from other sources, which is the exact
 * confusion this pair was introduced to make impossible.
 */
export function withPin(catalogue: string, digest: string, sources: string): string {
  if (!DIGEST.test(catalogue) || !SOURCES.test(catalogue)) {
    throw new Error('the catalogue carries no companion pin to move');
  }
  return catalogue
    .replace(DIGEST, `$1${digest}`)
    .replace(SOURCES, `$1${sources}$3`);
}

/** Where the catalogue keeps the pin, relative to the workspace root. */
export const CATALOGUE_PATH = 'deploy/cloud-init/src/lib/companion-image.ts';

/** Null until a fingerprint has been recorded at all. */
export function pinnedSources(root = workspaceRoot()): string | null {
  return sourcesIn(readFileSync(join(root, CATALOGUE_PATH), 'utf8'));
}
