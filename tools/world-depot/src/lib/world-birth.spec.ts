import { describe, expect, it } from 'vitest';
import { World } from '@beacon/session';
import { newInviteCode, worldBirth } from './world-birth.js';

const world = (game: 'enshrouded' | 'sunkenland') =>
  World.from({ worldId: 'les-copains', game, name: 'Les copains', inviteCode: 'c0de', players: [] });

describe('worldBirth', () => {
  it('prints the invite link, and the record to create for a game joined by address', () => {
    const lines = worldBirth(world('enshrouded'), 'les-copains.beacon.charlouze.com');
    expect(lines[0]).toBe('invite link: https://beacon.charlouze.com/join/les-copains/c0de');
    expect(lines[1]).toMatch(/create the A record les-copains\.beacon\.charlouze\.com/);
    expect(lines[1]).toMatch(/never creates/);
  });

  it('prints only the link when nothing points at the world', () => {
    expect(worldBirth(world('sunkenland'), null)).toHaveLength(1);
  });
});

describe('newInviteCode', () => {
  it('is twelve url-safe characters, and never the same twice', () => {
    const code = newInviteCode();
    expect(code).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(newInviteCode()).not.toBe(code);
  });
});
