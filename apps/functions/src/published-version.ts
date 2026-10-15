import type { Game, GamePublisher, PublishedVersion } from '@beacon/session';
import type { GameCopyStore } from '@beacon/session-record';

export interface PublishedVersionDeps {
  readonly publisher: GamePublisher;
  readonly gameCopies: GameCopyStore;
}

export interface PublishedRead {
  readonly published: PublishedVersion;
  /** Why recording what was read failed, or null. Nothing waits on the record. */
  readonly recordError: string | null;
}

/**
 * Reads the version a game's publisher publishes, then records it when it is
 * readable. Every caller that reads goes through here, and journals what
 * failed under its own source.
 */
export async function readPublished(deps: PublishedVersionDeps, game: Game): Promise<PublishedRead> {
  const published = await deps.publisher.publishedVersion(game);
  if (!published.readable) return { published, recordError: null };
  try {
    await deps.gameCopies.recordPublished(game, published.version);
    return { published, recordError: null };
  } catch (error) {
    return { published, recordError: String(error) };
  }
}
