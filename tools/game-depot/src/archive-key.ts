import { isGame } from '@beacon/session';
import { gameArchiveKeyFor } from './lib/game-depot.js';

/**
 * The one place a shell script can ask this repository for the archive key,
 * rather than spelling `<game>/game.tar` a third time next to the two that
 * `game-depot.spec.ts` already ties together (§4). The smoke harness deposits
 * through this target instead.
 */
const game = process.env['GAME'];
if (!isGame(game)) throw new Error(`GAME must name a game, got "${game}"`);

process.stdout.write(gameArchiveKeyFor(game));
