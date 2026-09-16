import { Deadline, Session, World } from '@beacon/session';
import type { WorldSummary } from '@beacon/session-record/client';
import { byUrgency, overview } from './overview';

const NO_FACTS = { ip: null, joinInfo: null, lastError: null };

const world = (worldId: string, name: string) =>
  World.from({ worldId, game: 'enshrouded', name, inviteCode: 'c0de', players: ['u1'] });

const summary = (
  worldId: string,
  name: string,
  state: 'IDLE' | 'PROVISIONING' | 'RUNNING' | 'STOPPING' | 'FAILED' | null,
): WorldSummary => ({
  world: world(worldId, name),
  server:
    state === null
      ? null
      : {
          session:
            state === 'IDLE'
              ? Session.idle()
              : Session.from({
                  state,
                  worldId,
                  sessionId: `s-${worldId}`,
                  game: 'enshrouded',
                  startedBy: 'u1',
                  startedAt: new Date('2026-09-12T20:14:00'),
                  deadline: Deadline.at(new Date('2026-09-13T00:14:00')),
                  instanceSize: 'DEV1-L',
                  hasJoinInfo: state === 'RUNNING',
                }),
          facts: NO_FACTS,
          stateSince: new Date('2026-09-12T20:14:00'),
        },
});

describe('overview', () => {
  it('says there is no world yet, quietly', () => {
    expect(overview([])).toEqual({ label: 'No world yet', tone: 'off' });
  });

  it('says nothing is running when no world is in service', () => {
    expect(overview([summary('a', 'A', 'IDLE'), summary('b', 'B', 'PROVISIONING')])).toEqual({
      label: 'Nothing running',
      tone: 'off',
    });
  });

  it('counts the worlds in service, and only those', () => {
    expect(overview([summary('a', 'A', 'RUNNING'), summary('b', 'B', 'PROVISIONING')])).toEqual({
      label: '1 in service',
      tone: 'live',
    });
    expect(
      overview([summary('a', 'A', 'RUNNING'), summary('b', 'B', 'RUNNING'), summary('c', 'C', null)]),
    ).toEqual({ label: '2 in service', tone: 'live' });
  });
});

describe('byUrgency', () => {
  it('puts what runs first, what moves next, what sleeps after, and the unreadable last', () => {
    const ordered = byUrgency([
      summary('d', 'Dormant', 'IDLE'),
      summary('u', 'Unknown', null),
      summary('p', 'Preparing', 'PROVISIONING'),
      summary('r', 'Running', 'RUNNING'),
    ]);
    expect(ordered.map((s) => s.world.worldId)).toEqual(['r', 'p', 'd', 'u']);
  });

  it('orders all six urgency levels correctly: running, preparing, closing, failed, idle, unreadable', () => {
    const ordered = byUrgency([
      summary('i', 'Idle', 'IDLE'),
      summary('u', 'Unknown', null),
      summary('f', 'Failed', 'FAILED'),
      summary('c', 'Closing', 'STOPPING'),
      summary('p', 'Preparing', 'PROVISIONING'),
      summary('r', 'Running', 'RUNNING'),
    ]);
    expect(ordered.map((s) => s.world.worldId)).toEqual(['r', 'p', 'c', 'f', 'i', 'u']);
  });

  it('breaks ties on the name, and leaves the given array alone', () => {
    const given = [summary('b', 'Beta', 'IDLE'), summary('a', 'Alpha', 'IDLE')];
    const ordered = byUrgency(given);
    expect(ordered.map((s) => s.world.name)).toEqual(['Alpha', 'Beta']);
    expect(given.map((s) => s.world.name)).toEqual(['Beta', 'Alpha']);
  });
});
