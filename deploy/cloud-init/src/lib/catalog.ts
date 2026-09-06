import type { Game, JoinInfo } from '@beacon/session';
import { enshrouded } from './enshrouded.js';

export interface BootRequest {
  readonly serverName: string;
  readonly serverPassword: string;
  readonly slotCount: number;
}

/**
 * Everything the repository knows about one game, and the only place it knows
 * it. A port number has no business in a model that talks about sessions and
 * deadlines (§4).
 */
export interface GameCatalogEntry {
  readonly game: Game;
  /**
   * The name a dns record points at, or null when nothing does. Null is not a
   * missing value: one of the two games announces no address at all, and a
   * port one does not call is cheaper than a port made optional (§4).
   */
  readonly hostname: string | null;
  compose(): string;
  render(request: BootRequest): string;
  joinInfo(address: string): JoinInfo;
}

const CATALOG: Partial<Record<Game, GameCatalogEntry>> = { enshrouded };

export function catalogFor(game: Game): GameCatalogEntry {
  const entry = CATALOG[game];
  if (entry === undefined) {
    // Named, and with the reason: this game cannot start before its 2.3 GB
    // are restored from object storage, which is the companion, which is
    // tranche 3. A bare "unknown game" would read as an oversight.
    throw new Error(`no catalogue entry for ${game}: it arrives with the companion, in tranche 3`);
  }
  return entry;
}

export const renderCloudInit = (game: Game, request: BootRequest): string =>
  catalogFor(game).render(request);

export const renderCompose = (game: Game): string => catalogFor(game).compose();
