import type { GameVersion } from './game-version.js';
import { copyIsBehind, type GameCopy } from './preflight.js';
import type { AbandonedSetup } from './setup.js';

/** The last version the system read from a game's publisher, and when it read it. */
export interface PublisherReading {
  readonly version: GameVersion;
  readonly readAt: Date;
}

/** What decides, for one world, whether its game waits for its copy to be replaced. */
export interface CopyReplacementFacts {
  /** The copy the last recorded deposit put in place, or null when none is. */
  readonly copy: GameCopy | null;
  /** The last recorded reading of the publisher, or null when none is. */
  readonly lastReading: PublisherReading | null;
  /** The mark of the world's last setup when it was abandoned, or null. */
  readonly abandoned: AbandonedSetup | null;
}

/**
 * Whether a game waits for its copy to be replaced: its copy was behind the
 * last version read from its publisher, and no deposit followed that reading.
 *
 * A setup abandoned for a behind copy is such a reading, the preflight check's
 * own, and counts even when recording it failed, until a deposit or a recorded
 * reading follows the abandon.
 */
export function awaitsCopyReplacement(facts: CopyReplacementFacts): boolean {
  const { copy, lastReading, abandoned } = facts;
  if (
    abandoned?.cause === 'copy-behind' &&
    !follows(copy?.depositedAt, abandoned.at) &&
    !follows(lastReading?.readAt, abandoned.at)
  ) {
    return true;
  }
  if (lastReading === null) return false;
  const depositPrecedesReading = copy === null || copy.depositedAt.getTime() < lastReading.readAt.getTime();
  return depositPrecedesReading && copyIsBehind(copy, lastReading.version);
}

function follows(instant: Date | undefined, reference: Date): boolean {
  return instant !== undefined && instant.getTime() > reference.getTime();
}
