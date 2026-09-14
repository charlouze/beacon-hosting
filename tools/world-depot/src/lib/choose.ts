import { newestSave, type Save } from '@beacon/session';

/**
 * The §8 default is `newestSave` itself, never a second maximum computed
 * here: an administrator who called this without `--key` must hold exactly
 * what the next session would restore, or the divergence is silent.
 *
 * `wanted` names an `objectKey`, not an index or a date, because repairing an
 * overwrite means naming the *previous* archive precisely — the one thing an
 * administrator can read off `--list`.
 */
export function chooseSave(saves: readonly Save[], wanted?: string): Save | undefined {
  if (wanted === undefined) return newestSave(saves);
  return saves.find((save) => save.objectKey === wanted);
}
