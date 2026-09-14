import { describe, expect, it } from 'vitest';
import { emptyHistoryMessage } from './retrieve.js';

describe('emptyHistoryMessage', () => {
  // observe pour de vrai : --list sur un historique vide n imprimait rien,
  // ce qui se lit comme une panne plutot que comme la premiere soiree d un monde
  it('dit que le jeu n a pas encore de sauvegarde dans le seau, dans la voix d adopt', () => {
    expect(emptyHistoryMessage('sunkenland', 'beacon-saves-local')).toBe(
      'sunkenland has no save yet in beacon-saves-local: nothing to list',
    );
  });
});
