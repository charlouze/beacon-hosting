import { describe, expect, it } from 'vitest';
import { abandonedAtPreflight } from './abandoned-at-preflight.js';
import { Deadline } from './deadline.js';
import { Session } from './session-aggregate.js';

const provisioning = () =>
  Session.from({
    state: 'PROVISIONING',
    sessionId: 's1',
    worldId: 'les-copains',
    game: 'sunkenland',
    startedBy: 'u1',
    startedAt: new Date('2026-10-15T20:00:00Z'),
    deadline: Deadline.at(new Date('2026-10-16T00:00:00Z')),
    instanceSize: null,
    hasJoinInfo: false,
  });

describe('abandonedAtPreflight', () => {
  it('writes the session out of service with the mark and its cause, empties what the claim set, and files the failure', () => {
    expect(abandonedAtPreflight(provisioning(), 'copy-behind')).toEqual({
      state: 'IDLE',
      lastError: null,
      clearFacts: true,
      clearLastError: false,
      closeIntents: [],
      events: [
        {
          type: 'ProvisioningFailed',
          sessionId: 's1',
          detail: 'preflight check failed: the copy of the game is behind what its publisher publishes',
        },
      ],
      deadline: null,
      abandonedSetup: { sessionId: 's1', cause: 'copy-behind' },
    });
  });
});
