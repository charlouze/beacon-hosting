import { catalogFor } from '@beacon/cloud-init';
import { GAMES, type Game } from '@beacon/session';
import type { PlatformJournal } from './platform-journal.js';
import { readPublished, type PublishedVersionDeps } from './published-version.js';

export interface PublishedRefreshDeps extends PublishedVersionDeps {
  readonly journal: PlatformJournal;
}

/**
 * Reads, then records, the version the publisher of each game that goes
 * through a copy publishes. What it cannot read or record goes to the platform
 * journal, and the other games are read all the same.
 */
export async function runPublishedRefresh(deps: PublishedRefreshDeps): Promise<void> {
  for (const game of GAMES.filter(goesThroughCopy)) {
    const { published, recordError } = await readPublished(deps, game);
    if (!published.readable) {
      deps.journal.failure({ source: 'publishedRefresh.read', sessionId: null, error: published.cause });
    }
    if (recordError !== null) {
      deps.journal.failure({ source: 'publishedRefresh.record', sessionId: null, error: recordError });
    }
  }
}

function goesThroughCopy(game: Game): boolean {
  return catalogFor(game).copySteamApp !== null;
}
