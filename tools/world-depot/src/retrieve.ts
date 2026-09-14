import { isGame, type Game } from '@beacon/session';
import { adminSaveStore } from './lib/admin-store.js';
import { argValue, hasFlag } from './lib/args.js';
import { chooseSave } from './lib/choose.js';
import { worldIdentity } from './lib/world-identity.js';

/**
 * An empty history is a legitimate answer — a world's first evening, the same
 * thought `newestSave` already carries by returning `undefined` rather than
 * refusing. But `--list` printing nothing at all reads as a breakage: the
 * administrator cannot tell "no save for this game" from "the command died
 * quietly". Said in the voice `adopt` already uses for the same situation.
 */
export const emptyHistoryMessage = (game: Game, bucket: string): string =>
  `${game} has no save yet in ${bucket}: nothing to list`;

/**
 * Hands the administrator back the world that lives in the bucket — never
 * writes to it. `SaveStore` has no delete and no prune (§8), which is what
 * keeps this a tool and not a script holding an administration key.
 */
try {
  const game = argValue(process.argv, 'game');
  if (!isGame(game)) throw new Error(`--game must name a game, got "${game}"`);

  const { store, bucket } = adminSaveStore();
  console.log(`reading ${bucket}`);
  const history = await store.list(game);

  if (hasFlag(process.argv, 'list')) {
    if (history.length === 0) {
      console.log(emptyHistoryMessage(game, bucket));
    }
    for (const save of history) {
      console.log(`${save.objectKey}  ${save.sizeBytes} bytes  ${save.createdAt.toISOString()}`);
    }
    process.exit(0);
  }

  const wanted = argValue(process.argv, 'key');
  const save = chooseSave(history, wanted);
  if (save === undefined) {
    throw new Error(
      wanted === undefined ? `no save found for ${game}` : `no save named ${wanted} in ${game}'s history`,
    );
  }

  const to = argValue(process.argv, 'to');
  if (to === undefined) throw new Error('--to is required: where to write the archive');

  await store.fetch(save, to);

  const identity = await worldIdentity(to);
  console.log(
    `retrieved ${save.objectKey} (${save.sizeBytes} bytes, ${save.createdAt.toISOString()})` +
      (identity === undefined ? '' : ` — ${identity.name} ~ ${identity.guid}`),
  );
} catch (error) {
  console.error(`beacon: ${String(error)}`);
  process.exitCode = 1;
}
