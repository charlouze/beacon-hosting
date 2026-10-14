import { describe, expect, it } from 'vitest';
import { type GameVersion, gameVersionFrom } from './game-version.js';

describe('gameVersionFrom', () => {
  it('builds a version from the digits a platform returns', () => {
    expect(gameVersionFrom('25746735')).toBe('25746735');
  });

  it('builds equal versions from equal digits, and different ones from different digits', () => {
    expect(gameVersionFrom('25746735')).toBe(gameVersionFrom('25746735'));
    expect(gameVersionFrom('25746735')).not.toBe(gameVersionFrom('23178631'));
  });

  it.each([
    ['an empty string', ''],
    ['a space inside', '25 746'],
    ['a sign', '-1'],
    ['a dot', '1.2'],
    ['surrounding blanks', ' 25746735 '],
    ['letters', 'abc'],
  ])('refuses %s', (_, value) => {
    expect(gameVersionFrom(value)).toBeNull();
  });

  it.each([
    ['a number', 25746735],
    ['undefined', undefined],
    ['null', null],
    ['an object', { buildid: '25746735' }],
  ])('refuses %s, which is not what a platform spells a version with', (_, value) => {
    expect(gameVersionFrom(value)).toBeNull();
  });

  it('does not accept a plain string as a version', () => {
    // @ts-expect-error a version is only built by gameVersionFrom
    const version: GameVersion = '25746735';
    expect(version).toBe('25746735');
  });
});
