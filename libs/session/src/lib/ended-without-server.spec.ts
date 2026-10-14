import { describe, expect, it } from 'vitest';
import { Deadline } from './deadline.js';
import { endedWithoutServer } from './ended-without-server.js';
import { Session } from './session-aggregate.js';

const stopping = () =>
  Session.from({
    state: 'STOPPING',
    sessionId: 's1',
    worldId: 'les-copains',
    game: 'enshrouded',
    startedBy: 'u1',
    startedAt: new Date('2026-10-15T20:00:00Z'),
    deadline: Deadline.at(new Date('2026-10-16T00:00:00Z')),
    instanceSize: null,
    hasJoinInfo: false,
  });

describe('endedWithoutServer', () => {
  it('writes the session out of service, empties what the claim set, and files its stop', () => {
    expect(endedWithoutServer(stopping())).toEqual({
      state: 'IDLE',
      lastError: null,
      clearFacts: true,
      clearLastError: true,
      closeIntents: [],
      events: [
        {
          type: 'SessionStopped',
          sessionId: 's1',
          detail: 'closed before any server was created',
          costEuros: 0,
        },
      ],
      deadline: null,
      abandonedSetup: null,
    });
  });
});
