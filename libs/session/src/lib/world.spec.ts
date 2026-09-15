import { describe, expect, it } from 'vitest';
import { isWorldId, World, MAX_WORLD_NAME } from './world.js';

const ACTOR = { uid: 'u1', name: 'Alice' };
const fields = (parts: Partial<Parameters<typeof World.from>[0]> = {}) => ({
  worldId: 'les-copains',
  game: 'enshrouded' as const,
  name: 'Les copains',
  inviteCode: 'c0de',
  players: ['u1'],
  ...parts,
});

describe('isWorldId', () => {
  it('accepts a slug and nothing else', () => {
    expect(isWorldId('les-copains')).toBe(true);
    expect(isWorldId('a')).toBe(true);
    expect(isWorldId('x'.repeat(32))).toBe(true);
    for (const bad of ['', 'Les-Copains', 'les copains', '-les', 'les-', 'x'.repeat(33), 'a_b', 42]) {
      expect(isWorldId(bad)).toBe(false);
    }
  });
});

describe('World', () => {
  it('refuses an identifier that is not a slug, and an empty or overlong name', () => {
    expect(() => World.from(fields({ worldId: 'Les Copains' }))).toThrow(/worldId/);
    expect(() => World.from(fields({ name: '' }))).toThrow(/name/);
    expect(() => World.from(fields({ name: 'x'.repeat(MAX_WORLD_NAME + 1) }))).toThrow(/name/);
  });

  it('knows who plays in it', () => {
    const world = World.from(fields());
    expect(world.hasPlayer('u1')).toBe(true);
    expect(world.hasPlayer('u2')).toBe(false);
  });

  it('copies its players rather than sharing them', () => {
    const players = ['u1'];
    const world = World.from(fields({ players }));
    players.push('u2');
    expect(world.hasPlayer('u2')).toBe(false);
  });

  it('lets someone in with the right code, and files it', () => {
    const { world, events } = World.from(fields()).join('u2', 'c0de', { uid: 'u2', name: 'Bob' });
    expect(world.hasPlayer('u2')).toBe(true);
    expect(events).toEqual([{ type: 'PlayerJoined', sessionId: null, detail: 'Bob joined' }]);
  });

  it('refuses a wrong code and a player already in', () => {
    const world = World.from(fields());
    expect(() => world.join('u2', 'nope', { uid: 'u2', name: 'Bob' })).toThrow(/code/);
    expect(() => world.join('u1', 'c0de', ACTOR)).toThrow(/already/);
  });

  it('lets a player leave, and refuses someone who is not in', () => {
    const { world, events } = World.from(fields()).leave('u1', ACTOR);
    expect(world.hasPlayer('u1')).toBe(false);
    expect(events).toEqual([{ type: 'PlayerLeft', sessionId: null, detail: 'Alice left' }]);
    expect(() => world.leave('u1', ACTOR)).toThrow(/not a player/);
  });

  it('renames, within the bound, and files it', () => {
    const { world, events } = World.from(fields()).rename('Les bras cassés', ACTOR);
    expect(world.name).toBe('Les bras cassés');
    expect(events).toEqual([
      { type: 'WorldRenamed', sessionId: null, detail: 'Alice renamed it to Les bras cassés' },
    ]);
    expect(() => world.rename('', ACTOR)).toThrow(/name/);
  });

  it('takes a new invite code without filing anything', () => {
    const { world, events } = World.from(fields()).regenerateInvite('n3w', ACTOR);
    expect(world.inviteCode).toBe('n3w');
    expect(events).toEqual([]);
  });

  // Figé à l'adoption (§4) : aucune méthode ne le change, et le type le dit.
  it('has no way to change its game', () => {
    const world = World.from(fields());
    expect('changeGame' in world).toBe(false);
    expect(world.game).toBe('enshrouded');
  });
});
