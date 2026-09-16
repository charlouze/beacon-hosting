import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, Session, World } from '@beacon/session';
import {
  displayedFactsFrom,
  idleServerDocument,
  openingFields,
  playerDocument,
  serverDocPath,
  sessionFrom,
  settingsFrom,
  worldDocument,
  worldFrom,
} from './fields.js';

const WORLD = World.from({
  worldId: 'les-copains',
  game: 'sunkenland',
  name: 'Les copains',
  inviteCode: 'c0de',
  players: ['u1'],
});
const clock = { now: () => new Date('2026-09-15T20:00:00Z') };

describe('paths under a world', () => {
  it('names the server document of a world', () => {
    expect(serverDocPath('les-copains')).toBe('worlds/les-copains/server/current');
  });
});

describe('worldFrom', () => {
  it('reads a world with its players', () => {
    const world = worldFrom(
      'les-copains',
      { game: 'sunkenland', name: 'Les copains', inviteCode: 'c0de' },
      ['u1', 'u2'],
    );
    expect(world?.game).toBe('sunkenland');
    expect(world?.hasPlayer('u2')).toBe(true);
  });

  it('reads nothing this vocabulary does not recognise', () => {
    expect(worldFrom('les-copains', { game: 'tetris', name: 'x', inviteCode: 'c' }, [])).toBeNull();
    expect(
      worldFrom('Les Copains', { game: 'enshrouded', name: 'x', inviteCode: 'c' }, []),
    ).toBeNull();
    expect(worldFrom('les-copains', { game: 'enshrouded', name: 'x' }, [])).toBeNull();
  });

  it('writes what it reads', () => {
    const data = worldDocument(WORLD, new Date('2026-09-15T20:00:00Z'));
    expect(worldFrom('les-copains', data, ['u1'])?.name).toBe('Les copains');
    expect(data['players']).toBeUndefined(); // les joueurs sont une sous-collection, jamais un champ
  });
});

describe('sessionFrom with a world', () => {
  it('takes the game and the world id from the world, never from the document', () => {
    const session = sessionFrom(
      {
        state: 'RUNNING',
        sessionId: 's1',
        startedAt: new Date(),
        deadline: new Date(),
        game: 'enshrouded',
      },
      WORLD,
    );
    expect(session?.game).toBe('sunkenland');
    expect(session?.worldId).toBe('les-copains');
  });
});

describe('what a client writes', () => {
  it('opens without writing the game', () => {
    const { session } = Session.opening(
      { sessionId: 's1', world: WORLD, actor: { uid: 'u1', name: 'Alice' } },
      clock,
      DEFAULT_SETTINGS,
    );
    expect(Object.keys(openingFields(session, 'now'))).not.toContain('game');
  });

  it('seeds a server document with every field present and null', () => {
    const doc = idleServerDocument(new Date());
    expect(doc['state']).toBe('IDLE');
    for (const key of [
      'sessionId',
      'startedBy',
      'startedAt',
      'deadline',
      'instanceId',
      'ipId',
      'ip',
      'joinInfo',
      'provisionClaimedAt',
      'lastError',
    ]) {
      expect(doc).toHaveProperty(key, null);
    }
    expect(doc).not.toHaveProperty('game');
  });

  it('writes a player with its uid as a field', () => {
    expect(playerDocument('u2', 'c0de', 'now')).toEqual({ uid: 'u2', code: 'c0de', joinedAt: 'now' });
  });
});

describe('displayedFactsFrom', () => {
  it('renders the three fields the screen shows, and no other', () => {
    const facts = displayedFactsFrom({
      state: 'RUNNING',
      instanceId: 'i-1',
      ipId: 'ip-1',
      provisionClaimedAt: new Date(),
      ip: '51.159.84.12',
      joinInfo: {
        game: 'enshrouded',
        hostname: 'enshrouded.beacon.charlouze.com',
        address: '51.159.84.12',
        port: 15637,
      },
      lastError: null,
    });
    expect(Object.keys(facts).sort()).toEqual(['ip', 'joinInfo', 'lastError']);
    expect(facts.ip).toBe('51.159.84.12');
    expect(facts.joinInfo).toEqual({
      game: 'enshrouded',
      hostname: 'enshrouded.beacon.charlouze.com',
      address: '51.159.84.12',
      port: 15637,
    });
  });

  /**
   * §8: a refused creation cleans up and returns to IDLE with lastError set.
   * That document is the most common failure screen there is, and a view that
   * dropped the field on an idle document would leave the screen unable to say
   * the previous attempt failed.
   */
  it('keeps lastError on an idle document, where it is the whole message', () => {
    const facts = displayedFactsFrom({
      state: 'IDLE',
      lastError: 'no capacity left for this machine size in the zone',
    });
    expect(facts.lastError).toBe('no capacity left for this machine size in the zone');
    expect(facts.joinInfo).toBeNull();
    expect(facts.ip).toBeNull();
  });

  it('says nothing rather than inventing, on a document that carries nothing', () => {
    expect(displayedFactsFrom({ state: 'IDLE' })).toEqual({
      ip: null,
      joinInfo: null,
      lastError: null,
    });
  });

  it('refuses a joinInfo whose game is not one this vocabulary knows', () => {
    expect(
      displayedFactsFrom({ joinInfo: { game: 'minecraft', hostname: 'x' } }).joinInfo,
    ).toBeNull();
  });

  // A shape half written is not a join point. The screen prints every field it
  // is handed, so half of one would be a line telling a player to copy
  // `undefined`.
  it('refuses a shape whose own game has not filled it in', () => {
    expect(displayedFactsFrom({ joinInfo: { game: 'enshrouded', hostname: 'h' } }).joinInfo).toBeNull();
    expect(
      displayedFactsFrom({ joinInfo: { game: 'sunkenland', serverId: 'a~b', region: 'Europe' } })
        .joinInfo,
    ).toBeNull();
  });

  it('refuses a lastError that is not a string, rather than rendering an object', () => {
    expect(displayedFactsFrom({ lastError: { code: 42 } }).lastError).toBeNull();
  });
});

describe('settingsFrom', () => {
  it('reads what an admin wrote', () => {
    const settings = settingsFrom({
      sessionDurationMs: 7_200_000,
      extensionStepMs: 1_800_000,
      extensionWindowMs: 600_000,
      defaultInstanceSize: 'DEV1-L',
      tariffPerHour: { 'DEV1-L': 0.06 },
    });
    expect(settings.sessionDurationMs).toBe(7_200_000);
    expect(settings.tariffPerHour['DEV1-L']).toBe(0.06);
  });

  // A missing document must not silently become a four-hour session with a
  // made-up price: the defaults are the spec's own values, and the seed writes
  // them, so falling back to them is falling back to what is deployed.
  it('falls back field by field on a document that is missing pieces', () => {
    expect(settingsFrom({ extensionStepMs: 1_800_000 })).toEqual({
      ...DEFAULT_SETTINGS,
      extensionStepMs: 1_800_000,
    });
  });

  it('ignores a tariff that is not a number', () => {
    expect(settingsFrom({ tariffPerHour: { 'DEV1-L': 'free' } }).tariffPerHour).toEqual({});
  });
});
