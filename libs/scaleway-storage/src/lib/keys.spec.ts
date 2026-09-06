import { describe, expect, it } from 'vitest';
import { objectKeyFor, parseObjectKey } from './keys.js';

const DRAFT = {
  game: 'enshrouded' as const,
  sessionId: 'b19af9ed-c4de-49d0-bd7c-1eacd1624c55',
  origin: 'pre-shutdown' as const,
  createdAt: new Date('2026-09-07T20:04:26Z'),
};

describe('the object key', () => {
  // §5: game, then origin, then session, then instant. The order is what the
  // bucket's lifecycle rules prune on — they match a prefix, and origin has to
  // come before anything that varies per session or they could not.
  it('carries game, origin, session and instant, in that order', () => {
    expect(objectKeyFor(DRAFT)).toBe(
      'saves/enshrouded/pre-shutdown/b19af9ed-c4de-49d0-bd7c-1eacd1624c55/2026-09-07T20-04-26Z.tar.gz',
    );
  });

  // A colon is legal in an s3 key and unusable everywhere else — a shell, a
  // path on the machine that downloads it, a url. Replaced once, here.
  it('spells the instant without a colon', () => {
    expect(objectKeyFor(DRAFT)).not.toContain(':');
  });

  // Two deposits inside the same second would collide, and a collision is the
  // one thing immutable keys exist to prevent (§5). Nothing here guards it —
  // what protects is structural: the origin sits above the instant, so an
  // `auto` and a `pre-shutdown` deposit of the same second never share a
  // prefix, and two `auto` pushes are already a push interval apart. This
  // test only pins that two different instants of the same origin never
  // collide.
  it('gives two instants two keys', () => {
    const later = { ...DRAFT, createdAt: new Date('2026-09-07T20:04:27Z') };
    expect(objectKeyFor(later)).not.toBe(objectKeyFor(DRAFT));
  });

  it('reads back the game, the origin and the instant it wrote', () => {
    expect(parseObjectKey(objectKeyFor(DRAFT))).toEqual({
      game: 'enshrouded',
      origin: 'pre-shutdown',
      createdAt: new Date('2026-09-07T20:04:26Z'),
    });
  });

  // An object deposited by hand, or left by a version of this code that no
  // longer exists. Null and not a throw: `list()` skips what it cannot read
  // rather than making one stray object break every restoration.
  it('yields nothing for a key it did not write', () => {
    expect(parseObjectKey('games/sunkenland/Sunkenland_Data/level0')).toBeNull();
    expect(parseObjectKey('saves/enshrouded/whatever/s1/2026.tar.gz')).toBeNull();
  });
});
