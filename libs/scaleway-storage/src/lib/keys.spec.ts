import { describe, expect, it } from 'vitest';
import { objectKeyFor, parseObjectKey } from './keys.js';

const DRAFT = {
  worldId: 'les-copains',
  sessionId: 'b19af9ed-c4de-49d0-bd7c-1eacd1624c55',
  origin: 'pre-shutdown' as const,
  createdAt: new Date('2026-09-07T20:04:26Z'),
};

describe('the object key', () => {
  // §5 : l'origine d'abord, parce que la règle d'élagage du seau filtre un
  // préfixe littéral et qu'il n'y en a qu'une, `auto/`, pour tous les mondes.
  it('carries origin, world, instant and session, in that order', () => {
    expect(objectKeyFor(DRAFT)).toBe(
      'pre-shutdown/les-copains/2026-09-07T20-04-26Z-b19af9ed-c4de-49d0-bd7c-1eacd1624c55.tar.gz',
    );
  });

  it('carries no session for an adoption', () => {
    expect(objectKeyFor({ ...DRAFT, sessionId: null, origin: 'manual' })).toBe(
      'manual/les-copains/2026-09-07T20-04-26Z.tar.gz',
    );
  });

  it('spells the instant without a colon', () => {
    expect(objectKeyFor(DRAFT)).not.toContain(':');
  });

  it('reads back what it wrote, session included or not', () => {
    expect(parseObjectKey(objectKeyFor(DRAFT))).toEqual({
      worldId: 'les-copains',
      origin: 'pre-shutdown',
      createdAt: new Date('2026-09-07T20:04:26Z'),
      sessionId: 'b19af9ed-c4de-49d0-bd7c-1eacd1624c55',
    });
    expect(parseObjectKey('manual/les-copains/2026-09-07T20-04-26Z.tar.gz')).toEqual({
      worldId: 'les-copains',
      origin: 'manual',
      createdAt: new Date('2026-09-07T20:04:26Z'),
      sessionId: null,
    });
  });

  // L'ancien format, et tout ce que ce module n'a pas écrit. Null et non un
  // throw : `list()` saute ce qu'il ne sait pas lire.
  it('yields nothing for a key of the previous format, or a foreign one', () => {
    expect(parseObjectKey('saves/enshrouded/pre-shutdown/s1/2026-09-07T20-04-26Z.tar.gz')).toBeNull();
    expect(parseObjectKey('games/sunkenland/Sunkenland_Data/level0')).toBeNull();
    expect(parseObjectKey('whatever/les-copains/2026-09-07T20-04-26Z.tar.gz')).toBeNull();
    expect(parseObjectKey('auto/Les Copains/2026-09-07T20-04-26Z.tar.gz')).toBeNull();
  });
});
