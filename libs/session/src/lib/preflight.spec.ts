import { describe, expect, it } from 'vitest';
import { gameVersionFrom, type GameVersion } from './game-version.js';
import {
  copyIsBehind,
  isPreflightFailure,
  preflightOutcome,
  type GameCopy,
  type PublishedVersion,
} from './preflight.js';

const version = (digits: string): GameVersion => {
  const built = gameVersionFrom(digits);
  if (built === null) throw new Error(`not a version: ${digits}`);
  return built;
};

const DEPOSITED_AT = new Date('2026-10-14T18:00:00Z');
const copyAt = (digits: string): GameCopy => ({ version: version(digits), depositedAt: DEPOSITED_AT });
const readable = (digits: string): PublishedVersion => ({ readable: true, version: version(digits) });

describe('copyIsBehind', () => {
  it('is not behind a version it is at', () => {
    expect(copyIsBehind(copyAt('25746735'), version('25746735'))).toBe(false);
  });

  it('is behind a version it is not at', () => {
    expect(copyIsBehind(copyAt('25746735'), version('25800001'))).toBe(true);
  });

  // Versions are compared for equality only: a publisher that rolls back
  // leaves a copy ahead of it, and that copy is behind like any other.
  it('is behind when it is ahead of the publisher', () => {
    expect(copyIsBehind(copyAt('25800001'), version('25746735'))).toBe(true);
  });

  it('is behind when no copy is recorded', () => {
    expect(copyIsBehind(null, version('25746735'))).toBe(true);
  });
});

describe('preflightOutcome', () => {
  it('passes for a game that goes through no copy', () => {
    expect(preflightOutcome({ throughCopy: false })).toEqual({ passed: true });
  });

  it('fails for an unreadable version when the publisher returned nothing', () => {
    expect(
      preflightOutcome({
        throughCopy: true,
        published: { readable: false, cause: 'no answer within 10000 ms' },
        copy: copyAt('25746735'),
      }),
    ).toEqual({ passed: false, failure: 'version-unreadable' });
  });

  it('fails for a copy behind the published version', () => {
    expect(
      preflightOutcome({ throughCopy: true, published: readable('25800001'), copy: copyAt('25746735') }),
    ).toEqual({ passed: false, failure: 'copy-behind' });
  });

  it('fails for a copy behind when no copy is recorded', () => {
    expect(preflightOutcome({ throughCopy: true, published: readable('25746735'), copy: null })).toEqual({
      passed: false,
      failure: 'copy-behind',
    });
  });

  it('passes for a copy at the published version', () => {
    expect(
      preflightOutcome({ throughCopy: true, published: readable('25746735'), copy: copyAt('25746735') }),
    ).toEqual({ passed: true });
  });
});

describe('isPreflightFailure', () => {
  it('knows the two failures, and nothing else', () => {
    expect(isPreflightFailure('copy-behind')).toBe(true);
    expect(isPreflightFailure('version-unreadable')).toBe(true);
    expect(isPreflightFailure('disk-full')).toBe(false);
    expect(isPreflightFailure(null)).toBe(false);
  });
});
