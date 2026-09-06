import { describe, expect, it } from 'vitest';
import { isEnshroudedJoinInfo, publishedAddressOf, type JoinInfo } from './join-info.js';

describe('JoinInfo', () => {
  it('recognises the shape that carries an address', () => {
    const info: JoinInfo = {
      game: 'enshrouded',
      hostname: 'enshrouded.beacon.charlouze.com',
      address: '51.15.42.7',
      port: 15637,
    };
    expect(isEnshroudedJoinInfo(info)).toBe(true);
  });

  // The measurement of 2026-09-05: this game announces no address at all, and
  // the player finds the server in a list. Nothing here is pointable by dns,
  // which is why `DnsUpdater` is not called for it (§4).
  it('recognises the shape that carries none', () => {
    const info: JoinInfo = {
      game: 'sunkenland',
      serverId: '4db51c84-24cf-459e-9e9e-88b8c3a7ce3b~1757102400',
      region: 'eu',
      worldName: "Beacon's World",
    };
    expect(isEnshroudedJoinInfo(info)).toBe(false);
  });

  it('yields the address a dns record must point at, when there is one', () => {
    const info: JoinInfo = {
      game: 'enshrouded',
      hostname: 'enshrouded.beacon.charlouze.com',
      address: '51.15.42.7',
      port: 15637,
    };
    expect(publishedAddressOf(info)).toBe('51.15.42.7');
  });

  it('yields none for a game joined without an address', () => {
    const info: JoinInfo = {
      game: 'sunkenland',
      serverId: '4db51c84-24cf-459e-9e9e-88b8c3a7ce3b~1757102400',
      region: 'eu',
      worldName: "Beacon's World",
    };
    expect(publishedAddressOf(info)).toBeNull();
  });
});
