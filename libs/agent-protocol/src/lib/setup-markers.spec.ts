import { describe, expect, it } from 'vitest';
import {
  declaredByMarkers,
  parseAgentSetup,
  renderAgentSetup,
  type AgentSetup,
} from './setup-markers.js';

const SETUP: AgentSetup = {
  startStep: 'fetching-game',
  markers: [
    { pattern: 'fetching: ([0-9.]+)%', step: 'fetching-game', activity: 'downloading' },
    { pattern: 'fetching', step: 'fetching-game' },
    { pattern: 'installed', step: 'starting-game' },
  ],
};

describe('the file a game server reads its markers from', () => {
  it('is read back as what was written', () => {
    expect(parseAgentSetup(renderAgentSetup(SETUP))).toEqual(SETUP);
  });

  it('is written on one line, so that it sits in a block of a larger file', () => {
    expect(renderAgentSetup(SETUP)).not.toContain('\n');
  });

  it('carries a game that has no marker at all', () => {
    const none: AgentSetup = { startStep: 'starting-game', markers: [] };

    expect(parseAgentSetup(renderAgentSetup(none))).toEqual(none);
  });

  const UNREADABLE: readonly (readonly [string, string])[] = [
    ['what is not json', '{ startStep'],
    ['what is not an object', '"fetching-game"'],
    ['a start step outside the list', '{"startStep":"booting","markers":[]}'],
    ['markers that are not a list', '{"startStep":"waking","markers":{}}'],
    ['a marker without a pattern', '{"startStep":"waking","markers":[{"step":"waking"}]}'],
    ['an empty pattern', '{"startStep":"waking","markers":[{"pattern":"","step":"waking"}]}'],
    [
      'a pattern that is no regular expression',
      '{"startStep":"waking","markers":[{"pattern":"(","step":"waking"}]}',
    ],
    [
      'a marker step outside the list',
      '{"startStep":"waking","markers":[{"pattern":"a","step":"booting"}]}',
    ],
    [
      'a marker activity outside the list',
      '{"startStep":"waking","markers":[{"pattern":"a","step":"waking","activity":"compiling"}]}',
    ],
  ];

  for (const [name, text] of UNREADABLE) {
    it(`refuses ${name}`, () => {
      expect(parseAgentSetup(text)).toBeNull();
    });
  }
});

describe('declaredByMarkers', () => {
  it('declares nothing while no line answers a marker', () => {
    expect(declaredByMarkers(SETUP, 'booting\nstill booting\n')).toBeNull();
    expect(declaredByMarkers(SETUP, '')).toBeNull();
  });

  it('follows the last line that answers a marker', () => {
    const output = 'fetching: 10%\ninstalled\nunrelated\n';

    expect(declaredByMarkers(SETUP, output)).toEqual({ step: 'starting-game' });
  });

  it('follows the first marker of the list on a line that answers several', () => {
    expect(declaredByMarkers(SETUP, 'fetching: 10%\n')).toEqual({
      step: 'fetching-game',
      activity: 'downloading',
      progress: 10,
    });
  });

  it('rounds the captured progress down, and keeps it between 0 and 100', () => {
    expect(declaredByMarkers(SETUP, 'fetching: 36.96%')?.progress).toBe(36);
    expect(declaredByMarkers(SETUP, 'fetching: 250%')?.progress).toBe(100);
  });

  // The game writes this prose, and nothing promises it stays a number.
  it('declares no progress when the capture is not a number', () => {
    const setup: AgentSetup = {
      startStep: 'waking',
      markers: [{ pattern: 'fetching: (\\S*)', step: 'fetching-game' }],
    };

    expect(declaredByMarkers(setup, 'fetching: soon')).toEqual({ step: 'fetching-game' });
    expect(declaredByMarkers(setup, 'fetching: ')).toEqual({ step: 'fetching-game' });
  });

  it('declares a marker without a capture as a step alone', () => {
    expect(declaredByMarkers(SETUP, 'installed')).toEqual({ step: 'starting-game' });
  });

  it('reads lines ended the way wine ends them', () => {
    expect(declaredByMarkers(SETUP, 'fetching: 10%\r\ninstalled\r\n')).toEqual({
      step: 'starting-game',
    });
  });
});
