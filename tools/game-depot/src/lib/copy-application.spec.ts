import { describe, expect, it } from 'vitest';
import { catalogFor } from '@beacon/cloud-init';
import { copyApplicationOf, gamesWithACopy } from './copy-application.js';

describe('copyApplicationOf', () => {
  it('names the application and the executable the catalogue gives the copy of a game', () => {
    const entry = catalogFor('sunkenland');
    expect(copyApplicationOf('sunkenland')).toEqual({ steamApp: entry.copySteamApp, executable: entry.copyExecutable });
  });

  it('refuses a game that goes through no copy', () => {
    expect(() => copyApplicationOf('enshrouded')).toThrow(/no copy/);
  });
});

describe('gamesWithACopy', () => {
  it('offers the games of the catalogue that go through a copy, and only those', () => {
    expect(gamesWithACopy()).toEqual(['sunkenland']);
  });
});
