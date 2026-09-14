import { describe, expect, it } from 'vitest';
import { argValue, hasFlag } from './args.js';

describe('argValue', () => {
  it('rend la valeur qui suit le signe egal', () => {
    expect(argValue(['--game=sunkenland', '--to=./monde.tar.gz'], 'to')).toBe('./monde.tar.gz');
  });

  // Un dossier de monde porte une espace et une apostrophe : ce qui arrive
  // apres le premier '=' est la valeur entiere, pas son premier morceau.
  it('ne coupe pas une valeur qui contient un signe egal', () => {
    expect(argValue(["--from=C:/Worlds/Beacon's=World"], 'from')).toBe("C:/Worlds/Beacon's=World");
  });

  it('rend undefined pour une option absente', () => {
    expect(argValue(['--game=sunkenland'], 'from')).toBeUndefined();
  });
});

describe('hasFlag', () => {
  it('distingue un drapeau d une option qui commence pareil', () => {
    expect(hasFlag(['--list'], 'list')).toBe(true);
    expect(hasFlag(['--listing=x'], 'list')).toBe(false);
  });
});
