import { describe, expect, it } from 'vitest';
import {
  GAME_LOG_MAX_CHARS,
  parseReport,
  REPORT_INTERVAL_MS,
  SETUP_REPORT_INTERVAL_MS,
} from './report.js';

describe('parseReport', () => {
  it('reads the heartbeat, which carries nothing but a session', () => {
    expect(parseReport({ sessionId: 's1', phase: 'alive' })?.report).toEqual({
      sessionId: 's1',
      phase: 'alive',
    });
  });

  // §6 étape 7: the ip corroborates and is never followed. It travels because
  // a mismatch is an incident worth filing, not because anything acts on it.
  it('reads the readiness, and the address it merely corroborates', () => {
    expect(parseReport({ sessionId: 's1', phase: 'ready', ip: '51.15.42.7' })?.report).toEqual({
      sessionId: 's1',
      phase: 'ready',
      ip: '51.15.42.7',
    });
  });

  it('reads a deposit, with the key, the size and the origin it claims', () => {
    const save = {
      objectKey: 'saves/enshrouded/pre-shutdown/s1/x.tar.gz',
      sizeBytes: 50_000,
      origin: 'pre-shutdown',
    };
    expect(parseReport({ sessionId: 's1', phase: 'saved', save })?.report).toEqual({
      sessionId: 's1',
      phase: 'saved',
      save,
    });
  });

  // The origin travels rather than being derived on the other side, because the
  // machine already wrote it into the object key — the adapter that deposits
  // builds the key (§5). Deriving it twice is how the record and the key end up
  // disagreeing about the same archive. What a lying machine gains is a
  // pruning window, which is bounded and visible.
  it('refuses an origin the vocabulary does not have', () => {
    expect(
      parseReport({
        sessionId: 's1',
        phase: 'saved',
        save: { objectKey: 'k', sizeBytes: 50_000, origin: 'forever' },
      }),
    ).toBeNull();
  });

  // This is an anti-corruption layer (§4) and the machine on the other side is
  // the least trusted element of the system (§7). Everything it does not
  // recognise, it refuses — it never repairs, and it never passes through.
  it('refuses a phase it does not know', () => {
    expect(parseReport({ sessionId: 's1', phase: 'RUNNING' })).toBeNull();
  });

  it('refuses a report with no session', () => {
    expect(parseReport({ phase: 'alive' })).toBeNull();
    expect(parseReport({ sessionId: 42, phase: 'alive' })).toBeNull();
  });

  it('refuses what is not an object at all', () => {
    expect(parseReport(null)).toBeNull();
    expect(parseReport('alive')).toBeNull();
  });

  // A deposit whose size is not a number would reach `Save.of` as NaN, and NaN
  // passes no comparison — including the floor. Refused at the frontier.
  it('refuses a deposit whose size is not a number', () => {
    expect(
      parseReport({
        sessionId: 's1',
        phase: 'saved',
        save: { objectKey: 'k', sizeBytes: 'big', origin: 'auto' },
      }),
    ).toBeNull();
  });

  // Bounded, like every string a client writes (§5). An unbounded detail on a
  // public endpoint is a way to make somebody else's bill grow.
  it('refuses a detail longer than the bound', () => {
    expect(parseReport({ sessionId: 's1', phase: 'failed', detail: 'x'.repeat(1025) })).toBeNull();
  });

  // §6 étape 7. A game whose join point is an identifier: what the player copies
  // is a value only the vm discovers, and which exists neither in the provider's
  // api nor on a port anything could query.
  it('reads the readiness of a game whose join point is an identifier', () => {
    expect(
      parseReport({
        sessionId: 's1',
        phase: 'ready',
        serverId: '4db51c84-24cf-459e-9e9e-88b8c3a7ce3b~639242318300625638',
      })?.report,
    ).toEqual({
      sessionId: 's1',
      phase: 'ready',
      serverId: '4db51c84-24cf-459e-9e9e-88b8c3a7ce3b~639242318300625638',
    });
  });

  // The game that publishes an address sends none, and the parser invents
  // nothing: an absent field stays absent.
  it('leaves the identifier out when the machine sent none', () => {
    expect(parseReport({ sessionId: 's1', phase: 'ready', ip: '51.15.42.7' })?.report).toEqual({
      sessionId: 's1',
      phase: 'ready',
      ip: '51.15.42.7',
    });
  });

  // Bounded, like every string a client writes (§5). An unbounded detail on a
  // public endpoint is a way to make somebody else's bill grow.
  it('refuses an identifier longer than the bound', () => {
    expect(parseReport({ sessionId: 's1', phase: 'ready', serverId: 'x'.repeat(1025) })).toBeNull();
  });

  // Empty or of another type: refused, never repaired. §4 makes this an
  // anti-corruption layer, and §7 makes the machine the least trusted element.
  it('refuses an identifier that is not a string, and an empty one', () => {
    expect(parseReport({ sessionId: 's1', phase: 'ready', serverId: '' })).toBeNull();
    expect(parseReport({ sessionId: 's1', phase: 'ready', serverId: 42 })).toBeNull();
  });

  it('lit le monde que la machine declare avoir restaure', () => {
    const world = { name: "Beacon's World", guid: '4db51c84-24cf-459e-9e9e-88b8c3a7ce3b' };
    expect(parseReport({ sessionId: 's1', phase: 'ready', serverId: `${world.guid}~12h`, world })?.report).toEqual({
      sessionId: 's1',
      phase: 'ready',
      serverId: `${world.guid}~12h`,
      world,
    });
  });

  // Un guid sans nom publierait un point de jonction sans le recours du §2 :
  // le nom dans la liste est ce qui reste quand l'identifiant se perd.
  it('refuse un monde a moitie declare', () => {
    expect(parseReport({ sessionId: 's1', phase: 'ready', world: { guid: 'g' } })).toBeNull();
    expect(parseReport({ sessionId: 's1', phase: 'ready', world: { name: 'n' } })).toBeNull();
  });

  it('refuse un monde qui n est pas un objet', () => {
    expect(parseReport({ sessionId: 's1', phase: 'ready', world: 'Beacon' })).toBeNull();
    expect(parseReport({ sessionId: 's1', phase: 'ready', world: null })).toBeNull();
  });

  it('refuse un nom de monde sans borne', () => {
    expect(
      parseReport({ sessionId: 's1', phase: 'ready', world: { name: 'x'.repeat(1025), guid: 'g' } }),
    ).toBeNull();
  });

  it('reads the setup a game server declares, with its activity and its progress', () => {
    const setup = { step: 'fetching-game', activity: 'downloading', progress: 41 };

    expect(parseReport({ sessionId: 's1', phase: 'alive', setup })).toEqual({
      report: { sessionId: 's1', phase: 'alive', setup },
      discarded: [],
    });
  });

  it('reads a setup that declares a step and nothing else', () => {
    const parsed = parseReport({ sessionId: 's1', phase: 'alive', setup: { step: 'waking' } });

    expect(parsed?.report.setup).toEqual({ step: 'waking' });
  });

  it('says it discarded nothing when the report carries no setup', () => {
    expect(parseReport({ sessionId: 's1', phase: 'alive' })?.discarded).toEqual([]);
  });

  const MALFORMED_SETUPS: readonly (readonly [string, unknown])[] = [
    ['a step outside the list', { step: 'booting' }],
    ['no step at all', { activity: 'downloading' }],
    ['an activity outside the list', { step: 'fetching-game', activity: 'compiling' }],
    ['a progress above a hundred', { step: 'fetching-game', progress: 101 }],
    ['a progress below zero', { step: 'fetching-game', progress: -1 }],
    ['a progress that is not whole', { step: 'fetching-game', progress: 41.5 }],
    ['a progress that is not a number', { step: 'fetching-game', progress: '41' }],
    ['a setup that is not an object', 'fetching-game'],
    ['a null setup', null],
  ];

  for (const [name, setup] of MALFORMED_SETUPS) {
    it(`discards ${name} without refusing the report`, () => {
      expect(parseReport({ sessionId: 's1', phase: 'alive', setup })).toEqual({
        report: { sessionId: 's1', phase: 'alive' },
        discarded: ['setup'],
      });
    });
  }

  // What is displayed must not cost a session: a server that became joinable
  // is put into service whatever it said of its setup.
  it('lets a ready report through with a malformed setup, and names what it discarded', () => {
    expect(
      parseReport({ sessionId: 's1', phase: 'ready', ip: '51.15.42.7', setup: { step: 42 } }),
    ).toEqual({
      report: { sessionId: 's1', phase: 'ready', ip: '51.15.42.7' },
      discarded: ['setup'],
    });
  });

  it('reads the end of the game output a failed report carries', () => {
    const body = { sessionId: 's1', phase: 'failed', detail: 'boom', gameLog: 'line 1\nline 2' };

    expect(parseReport(body)).toEqual({ report: body, discarded: [] });
  });

  it('takes a game output of exactly the bound', () => {
    const gameLog = 'x'.repeat(GAME_LOG_MAX_CHARS);

    expect(parseReport({ sessionId: 's1', phase: 'failed', gameLog })?.report.gameLog).toBe(gameLog);
  });

  // The cause of a failure must reach the control plane whatever the machine
  // attached to it.
  it('discards a game output over the bound without refusing the report', () => {
    const gameLog = 'x'.repeat(GAME_LOG_MAX_CHARS + 1);

    expect(parseReport({ sessionId: 's1', phase: 'failed', detail: 'boom', gameLog })).toEqual({
      report: { sessionId: 's1', phase: 'failed', detail: 'boom' },
      discarded: ['gameLog'],
    });
  });

  it('discards a game output that is not a string', () => {
    expect(parseReport({ sessionId: 's1', phase: 'failed', gameLog: ['line 1'] })).toEqual({
      report: { sessionId: 's1', phase: 'failed' },
      discarded: ['gameLog'],
    });
  });

  it('names every field it discarded', () => {
    const parsed = parseReport({
      sessionId: 's1',
      phase: 'failed',
      setup: { step: 'booting' },
      gameLog: 42,
    });

    expect(parsed?.discarded).toEqual(['setup', 'gameLog']);
  });
});

describe('the cadences of the protocol', () => {
  it('reports every ten seconds while a setup is followed, and once a minute otherwise', () => {
    expect(SETUP_REPORT_INTERVAL_MS).toBe(10_000);
    expect(REPORT_INTERVAL_MS).toBe(60_000);
  });
});
