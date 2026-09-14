import type { Save } from './save.js';

/**
 * The §8 default: exactly what the next session would restore. By
 * `createdAt` and never `saves[0]`: the port's contract is "newest first"
 * (§4), but trusting an adapter's order here would make a restore depend on
 * an invariant this function cannot check. An empty list is a legitimate
 * answer — the first evening of a world — and yields `undefined`.
 */
export function newestSave(saves: readonly Save[]): Save | undefined {
  return saves.reduce<Save | undefined>(
    (latest, save) => (latest === undefined || save.createdAt > latest.createdAt ? save : latest),
    undefined,
  );
}
