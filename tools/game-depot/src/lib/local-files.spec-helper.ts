import { join, sep } from 'node:path';
import type { InstallMeasure, LocalFiles } from './steam-install.js';

/**
 * A tree of absolute paths, in memory. Everything this tool discovers is a walk
 * over a disk no test may touch: a real Steam install exists on exactly one
 * machine, weighs gigabytes, and says nothing about the case the guided flow
 * exists for — the one where the server is *not* there.
 *
 * A `number` stands for an opaque file of that many bytes, a `string` for a
 * text file. The record is read on every call rather than snapshotted, so a
 * test can grow the tree between two probes: that is how an operator going off
 * to run steamcmd is played.
 */
export function inMemoryFiles(tree: Record<string, number | string>): LocalFiles {
  const under = (dir: string): string[] => Object.keys(tree).filter((path) => path.startsWith(dir + sep));

  const sizeOf = (path: string): number => {
    const entry = tree[path];
    return typeof entry === 'string' ? Buffer.byteLength(entry) : entry;
  };

  return {
    exists: (path) => tree[path] !== undefined,

    readText: (path) => (typeof tree[path] === 'string' ? (tree[path] as string) : undefined),

    subdirectories: (dir) => [
      ...new Set(
        under(dir)
          .map((path) => path.slice(dir.length + 1))
          // A file sitting directly in `dir` is not one of its subdirectories,
          // and offering it as one would make every install folder look like a
          // candidate to the search.
          .filter((rest) => rest.includes(sep))
          .map((rest) => join(dir, rest.split(sep)[0])),
      ),
    ],

    measure: (dir): InstallMeasure => ({
      fileCount: under(dir).length,
      sizeBytes: under(dir).reduce((total, path) => total + sizeOf(path), 0),
    }),
  };
}
