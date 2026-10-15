import { describe, expect, it, vi } from 'vitest';
import { gameVersionFrom, type GameVersion, type PublishedVersion } from '@beacon/session';
import { runPublishedRefresh } from './published-refresh.js';

const version = (digits: string): GameVersion => {
  const built = gameVersionFrom(digits);
  if (built === null) throw new Error(`not a version: ${digits}`);
  return built;
};

const depsAnswering = (answer: PublishedVersion) => ({
  publisher: { publishedVersion: vi.fn(async () => answer) },
  gameCopies: { read: vi.fn(async () => null), recordPublished: vi.fn(async () => undefined) },
  journal: { failure: vi.fn(), setupChanged: vi.fn(), discarded: vi.fn() },
});

describe('runPublishedRefresh', () => {
  it('reads the publisher of a game that goes through a copy, and of no other', async () => {
    const deps = depsAnswering({ readable: true, version: version('25746735') });

    await runPublishedRefresh(deps);

    expect(deps.publisher.publishedVersion).toHaveBeenCalledWith('sunkenland');
    expect(deps.publisher.publishedVersion).not.toHaveBeenCalledWith('enshrouded');
  });

  it('records what it read, and journals nothing', async () => {
    const deps = depsAnswering({ readable: true, version: version('25746735') });

    await runPublishedRefresh(deps);

    expect(deps.gameCopies.recordPublished).toHaveBeenCalledWith('sunkenland', '25746735');
    expect(deps.journal.failure).not.toHaveBeenCalled();
  });

  it('writes nothing when the version is unreadable, and journals why', async () => {
    const deps = depsAnswering({ readable: false, cause: 'no answer within 10 s' });

    await runPublishedRefresh(deps);

    expect(deps.gameCopies.recordPublished).not.toHaveBeenCalled();
    expect(deps.journal.failure).toHaveBeenCalledWith({
      source: 'publishedRefresh.read',
      sessionId: null,
      error: 'no answer within 10 s',
    });
  });

  it('journals a reading it could not record', async () => {
    const deps = depsAnswering({ readable: true, version: version('25746735') });
    deps.gameCopies.recordPublished.mockRejectedValue(new Error('firestore is down'));

    await runPublishedRefresh(deps);

    expect(deps.journal.failure).toHaveBeenCalledWith({
      source: 'publishedRefresh.record',
      sessionId: null,
      error: 'Error: firestore is down',
    });
  });
});
