import { describe, expect, it } from 'vitest';
import { emptyHistoryMessage } from './retrieve.js';

describe('emptyHistoryMessage', () => {
  // observe pour de vrai : --list sur un historique vide n imprimait rien,
  // ce qui se lit comme une panne plutot que comme la premiere soiree d un monde
  it('dit que le monde n a pas encore de sauvegarde dans le seau, dans la voix d adopt', () => {
    expect(emptyHistoryMessage('les-copains', 'b')).toBe('les-copains has no save yet in b: nothing to list');
  });
});
