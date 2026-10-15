import type { GameVersion } from './game-version.js';

/** Why a preflight check failed. A closed list: the screen says each one in its own words. */
export const PREFLIGHT_FAILURES = ['copy-behind', 'version-unreadable'] as const;

export type PreflightFailure = (typeof PREFLIGHT_FAILURES)[number];

export function isPreflightFailure(value: unknown): value is PreflightFailure {
  return PREFLIGHT_FAILURES.includes(value as PreflightFailure);
}

/** The files of a game Beacon keeps for its servers: the version its last deposit put in place, and when. */
export interface GameCopy {
  readonly version: GameVersion;
  readonly depositedAt: Date;
}

/**
 * What asking a game's publisher returns. The cause of an unreadable version
 * is for the platform journal only.
 */
export type PublishedVersion =
  | { readonly readable: true; readonly version: GameVersion }
  | { readonly readable: false; readonly cause: string };

/** Missing, or at any other version than the published one: versions are only compared for equality. */
export function copyIsBehind(copy: GameCopy | null, published: GameVersion): boolean {
  return copy === null || copy.version !== published;
}

/** What the preflight check of a session knows of its game. A game that goes through no copy brings nothing. */
export type PreflightFacts =
  | { readonly throughCopy: false }
  | {
      readonly throughCopy: true;
      readonly published: PublishedVersion;
      readonly copy: GameCopy | null;
    };

export type PreflightOutcome =
  | { readonly passed: true }
  | { readonly passed: false; readonly failure: PreflightFailure };

export function preflightOutcome(facts: PreflightFacts): PreflightOutcome {
  if (!facts.throughCopy) return { passed: true };
  if (!facts.published.readable) return { passed: false, failure: 'version-unreadable' };
  if (copyIsBehind(facts.copy, facts.published.version)) return { passed: false, failure: 'copy-behind' };
  return { passed: true };
}
