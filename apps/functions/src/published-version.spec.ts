import { describe, expect, it, vi } from 'vitest';
import { gameVersionFrom, type GameVersion } from '@beacon/session';
import { readPublished } from './published-version.js';

const version = (digits: string): GameVersion => {
  const built = gameVersionFrom(digits);
  if (built === null) throw new Error(`not a version: ${digits}`);
  return built;
};

const depsAnswering = (answer: Awaited<ReturnType<typeof readPublished>>['published']) => ({
  publisher: { publishedVersion: vi.fn(async () => answer) },
  gameCopies: { read: vi.fn(async () => null), recordPublished: vi.fn(async () => undefined) },
});

describe('readPublished', () => {
  it('records what it read, and returns it', async () => {
    const deps = depsAnswering({ readable: true, version: version('25746735') });

    expect(await readPublished(deps, 'sunkenland')).toEqual({
      published: { readable: true, version: '25746735' },
      recordError: null,
    });
    expect(deps.gameCopies.recordPublished).toHaveBeenCalledWith('sunkenland', '25746735');
  });

  it('records nothing when the version is unreadable', async () => {
    const deps = depsAnswering({ readable: false, cause: 'no answer' });

    expect(await readPublished(deps, 'sunkenland')).toEqual({
      published: { readable: false, cause: 'no answer' },
      recordError: null,
    });
    expect(deps.gameCopies.recordPublished).not.toHaveBeenCalled();
  });

  it('returns what it read when recording it fails, with why', async () => {
    const deps = depsAnswering({ readable: true, version: version('25746735') });
    deps.gameCopies.recordPublished.mockRejectedValue(new Error('firestore is down'));

    expect(await readPublished(deps, 'sunkenland')).toEqual({
      published: { readable: true, version: '25746735' },
      recordError: 'Error: firestore is down',
    });
  });
});
