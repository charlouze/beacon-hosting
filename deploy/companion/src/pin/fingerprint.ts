import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The shape of an esbuild metafile this module reads, and nothing more. */
export interface Metafile {
  readonly inputs: Readonly<Record<string, unknown>>;
}

/**
 * The first-party files esbuild actually inlined. Third-party ones are dropped
 * not because they do not reach the image — `thirdParty: true` puts them there
 * too — but because `package-lock.json` already pins them exactly, and hashing
 * a few thousand files to learn what one lockfile says is work with no reader.
 */
export function sourcesOf(metafile: Metafile): string[] {
  return Object.keys(metafile.inputs)
    .filter((path) => !path.includes('node_modules'))
    .sort();
}

/** What the catalogue records beside the digest, as `sha256:<hex>`. */
export function fingerprintOf(files: ReadonlyMap<string, string>): string {
  const hash = createHash('sha256');
  for (const path of [...files.keys()].sort()) {
    // Newlines normalised, because `core.autocrlf` decides how a checkout
    // spells them and no image was ever built from a carriage return.
    const content = (files.get(path) ?? '').replace(/\r\n/g, '\n');
    // Framed, never concatenated: a path cannot hold a NUL, and the byte count
    // bounds the content, so no two different sets of files can produce the
    // same run of bytes.
    hash.update(`${path}\0${Buffer.byteLength(content)}\0`);
    hash.update(content);
  }
  return `sha256:${hash.digest('hex')}`;
}

/**
 * The workspace root, derived from this file's own place in it rather than
 * from the working directory: the pin is read by a test, by a target and by a
 * human, and only one of the three is reliably launched from the root.
 */
export const workspaceRoot = (): string =>
  fileURLToPath(new URL('../../../../', import.meta.url));

const METAFILE = 'deploy/companion/dist/meta.json';

/** What the last build inlined. Requires that build — hence `dependsOn`. */
export function companionSources(root = workspaceRoot()): string[] {
  const metafile = JSON.parse(readFileSync(join(root, METAFILE), 'utf8')) as Metafile;
  return sourcesOf(metafile);
}

/**
 * The lockfile stands for every third-party byte the bundle inlines, and the
 * Dockerfile for the base image and the entry point around it. Neither is an
 * input esbuild reports, and both change what runs on a game machine.
 */
const BESIDE_THE_BUNDLE = ['package-lock.json', 'deploy/companion/Dockerfile'];

/** Every file the pinned image is built from, as workspace-relative paths. */
export function companionFiles(root = workspaceRoot()): string[] {
  return [...companionSources(root), ...BESIDE_THE_BUNDLE].sort();
}

/** The value the catalogue records beside the digest. */
export function companionFingerprint(root = workspaceRoot()): string {
  const files = new Map(
    companionFiles(root).map((path) => [path, readFileSync(join(root, path), 'utf8')]),
  );
  return fingerprintOf(files);
}
