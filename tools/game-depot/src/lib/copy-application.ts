import { GAMES, type Game } from '@beacon/session';
import { catalogFor } from '@beacon/cloud-init';

/** What the catalogue says the copy of a game is made of. */
export interface CopyApplication {
  /** The Steam application whose files the copy holds. */
  readonly steamApp: string;
  /** The file every install of it carries, and the one its server launches. */
  readonly executable: string;
}

/** The copy of a game, as the catalogue describes it. A game that goes through no copy has nothing to deposit here. */
export function copyApplicationOf(game: Game): CopyApplication {
  const { copySteamApp, copyExecutable } = catalogFor(game);
  if (copySteamApp === null || copyExecutable === null) {
    throw new Error(`${game} goes through no copy: nothing of it is deposited`);
  }
  return { steamApp: copySteamApp, executable: copyExecutable };
}

/** The games this tool deposits a copy of, in the catalogue's order. */
export function gamesWithACopy(): readonly Game[] {
  return GAMES.filter((game) => catalogFor(game).copySteamApp !== null);
}
