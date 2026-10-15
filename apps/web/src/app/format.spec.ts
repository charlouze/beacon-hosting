import { SETUP_ACTIVITIES, SETUP_STEPS, World } from '@beacon/session';
import {
  activityLabel,
  euroLabel,
  gameLabel,
  hourLabel,
  inviteLink,
  splitCountdown,
  stateLabel,
  stepLabel,
  stoppedAt,
  windowLabel,
} from './format';

describe('gameLabel', () => {
  it('writes a game the way it is written on its own box', () => {
    expect(gameLabel('enshrouded')).toBe('Enshrouded');
    expect(gameLabel('sunkenland')).toBe('Sunkenland');
  });
});

describe('splitCountdown', () => {
  it('separates the falling second, because it is the only thing that is red', () => {
    expect(splitCountdown(2 * 3_600_000 + 47 * 60_000 + 12_000)).toEqual({
      hoursMinutes: '2:47',
      seconds: ':12',
    });
  });

  it('pads minutes and seconds, so the digits never shift under a tabular font', () => {
    expect(splitCountdown(9 * 60_000 + 5_000)).toEqual({ hoursMinutes: '0:09', seconds: ':05' });
  });

  it('never walks past zero: an elapsed deadline reads zero, not a negative', () => {
    expect(splitCountdown(-5_000)).toEqual({ hoursMinutes: '0:00', seconds: ':00' });
  });

  it('leaves the hours unpadded past ten, this being a duration and not a clock', () => {
    expect(splitCountdown(12 * 3_600_000 + 60_000)).toEqual({
      hoursMinutes: '12:01',
      seconds: ':00',
    });
  });
});

describe('hourLabel', () => {
  it('reads as a departure hour, zero-padded on both halves', () => {
    expect(hourLabel(new Date('2026-09-12T00:30:00'))).toBe('00:30');
    expect(hourLabel(new Date('2026-09-12T20:14:59'))).toBe('20:14');
  });
});

describe('euroLabel', () => {
  it('always shows two decimals: 0.1 euro is not "€0.1"', () => {
    expect(euroLabel(0.13)).toBe('€0.13');
    expect(euroLabel(0.1)).toBe('€0.10');
    expect(euroLabel(0)).toBe('€0.00');
  });
});

describe('windowLabel', () => {
  it('writes the two hours of a window, to the minute', () => {
    expect(
      windowLabel({
        from: new Date('2026-09-12T20:19:10'),
        to: new Date('2026-09-12T20:22:05'),
      }),
    ).toEqual({ from: '20:19', to: '20:22' });
  });

  it('writes a window that crosses midnight', () => {
    expect(
      windowLabel({
        from: new Date('2026-09-12T23:58:40'),
        to: new Date('2026-09-13T00:03:10'),
      }),
    ).toEqual({ from: '23:58', to: '00:03' });
  });
});

describe('stateLabel', () => {
  it.each([
    ['IDLE', 'Out of service', 'off'],
    ['PROVISIONING', 'Preparing', 'off'],
    ['RUNNING', 'In service', 'live'],
    ['STOPPING', 'Closing', 'off'],
    ['FAILED', 'Not cleared', 'warn'],
    ['unreadable', 'Unknown', 'warn'],
  ] as const)('announces %s as "%s", tone %s', (state, label, tone) => {
    expect(stateLabel(state)).toEqual({ label, tone });
  });
});

describe('inviteLink', () => {
  it('is the origin, the world id and the code, and nothing else', () => {
    const world = World.from({
      worldId: 'les-copains',
      game: 'enshrouded',
      name: 'Les copains',
      inviteCode: '7f3a9c2e',
      players: ['u1'],
    });
    expect(inviteLink('https://beacon.charlouze.com', world)).toBe(
      'https://beacon.charlouze.com/join/les-copains/7f3a9c2e',
    );
  });
});

describe('stepLabel', () => {
  it('names each of the four steps the way the board says them', () => {
    expect(SETUP_STEPS.map(stepLabel)).toEqual([
      'Waking the server',
      'Getting the game',
      'Bringing your world back',
      'Starting the game',
    ]);
  });
});

describe('activityLabel', () => {
  it('names each activity a game server can declare', () => {
    expect(SETUP_ACTIVITIES.map(activityLabel)).toEqual(['Downloading', 'Unpacking']);
  });
});

describe('stoppedAt', () => {
  const OPENED = new Date('2026-09-12T20:14:00');
  const STOPPED_AT = new Date('2026-09-12T20:39:00');
  const step = (name: 'waking' | 'fetching-game') => ({
    step: name,
    since: new Date('2026-09-12T20:16:00'),
    activity: null,
    progress: null,
  });

  it('says the hour, the rank in the order of the game and the name of the step', () => {
    expect(
      stoppedAt({
        stage: 'step',
        step: step('fetching-game'),
        order: ['waking', 'restoring-world', 'fetching-game', 'starting-game'],
        abandonedAt: STOPPED_AT,
      }),
    ).toEqual({ stage: 'step', at: '20:39', rank: 3, total: 4, name: 'Getting the game' });
  });

  it('says a setup abandoned before its first step stopped at the preflight check', () => {
    expect(stoppedAt({ stage: 'preflight', since: OPENED, abandonedAt: STOPPED_AT })).toEqual({
      stage: 'preflight',
      at: '20:39',
    });
  });

  it('says nothing of a preflight check under way', () => {
    expect(stoppedAt({ stage: 'preflight', since: OPENED, abandonedAt: null })).toBeNull();
  });

  it('says nothing of a step under way, nor of none', () => {
    expect(
      stoppedAt({
        stage: 'step',
        step: step('waking'),
        order: ['waking', 'restoring-world', 'fetching-game', 'starting-game'],
        abandonedAt: null,
      }),
    ).toBeNull();
    expect(stoppedAt(null)).toBeNull();
  });
});
