import { describe, expect, it } from 'vitest';
import { Deadline } from '../deadline.js';
import type { HostedServer, UnclaimedSweep } from '../ports.js';
import { Session } from '../session-aggregate.js';
import type { SessionState } from '../session.js';
import { DEFAULT_SETTINGS } from '../settings.js';
import type { Expiration, Reclamation } from './reclamations.js';
import { reconcileWorld, sweepEvents, type ReclaimOutcome, type StateCorrection } from './reconcile.js';
import type { ServerRecord, WatchdogView, WorldView } from './view.js';

const NOW = new Date('2026-09-04T21:00:00Z');

const hosted = (sessionId: string): HostedServer => ({ sessionId, summary: `held ${sessionId}` });

const record = (
  state: SessionState,
  sessionId: string | null,
  hasReservedFacts = false,
): ServerRecord => ({ state, sessionId, stateSince: NOW, hasReservedFacts });

// The one-world shape most scenarios need — a world named 'w' carrying
// whatever record and session that scenario is about.
const singleWorld = (server: ServerRecord | null, session: Session | null = null): WorldView => ({
  worldId: 'w',
  server,
  session,
});

const view = (parts: Partial<WatchdogView> = {}): WatchdogView => ({
  now: NOW,
  worlds: [singleWorld(null)],
  hosted: [],
  openSessions: [],
  alreadyAnnounced: [],
  settings: DEFAULT_SETTINGS,
  ...parts,
});

const runningSession = (sessionId: string, deadlineIso: string) =>
  Session.from({
    state: 'RUNNING',
    sessionId,
    worldId: 'enshrouded-world',
    game: 'enshrouded',
    startedBy: 'u1',
    startedAt: new Date('2026-09-06T20:00:00Z'),
    deadline: Deadline.at(new Date(deadlineIso)),
    instanceSize: 'DEV1-L',
    hasJoinInfo: true,
  });

const outcome = (
  sessionId: string,
  reason: Reclamation['reason'],
  closed: boolean,
): ReclaimOutcome => {
  const reclamation = { sessionId, reason, detail: `held ${sessionId}` };
  return closed ? { reclamation, closed: true } : { reclamation, closed: false, error: 'boom' };
};

const quiet: UnclaimedSweep = { destroyed: [], stranded: [], errors: [] };
const types = (events: readonly { type: string }[]) => events.map((e) => e.type);

describe('reconcileWorld', () => {
  it('corrects nothing when nothing happened', () => {
    const v = view();
    const correction = reconcileWorld(v, v.worlds[0], [], []);
    expect(correction.state).toBeNull();
    expect(correction.clearFacts).toBe(false);
    expect(correction.events).toEqual([]);
    expect(correction.closeIntents).toEqual([]);
  });

  it('leaves the state alone when server/current does not exist', () => {
    const v = view({ hosted: [hosted('s1')] });
    const correction = reconcileWorld(v, v.worlds[0], [outcome('s1', 'no-open-session', true)], []);
    expect(correction.state).toBeNull();
    expect(types(correction.events)).toEqual(['SessionReclaimed']);
    expect(correction.closeIntents).toEqual(['s1']);
  });

  it('closes the intent of a session it destroyed', () => {
    const v = view({ hosted: [hosted('s1')] });
    const correction = reconcileWorld(v, v.worlds[0], [outcome('s1', 'no-open-session', true)], []);
    expect(correction.closeIntents).toEqual(['s1']);
  });

  // Leaving the intent open is what brings the watchdog back to it next pass.
  it('leaves the intent open when the destruction failed', () => {
    const v = view({ hosted: [hosted('s1')] });
    const correction = reconcileWorld(v, v.worlds[0], [outcome('s1', 'no-open-session', false)], []);
    expect(correction.closeIntents).toEqual([]);
    expect(types(correction.events)).toEqual(['CleanupFailed']);
  });

  it('sends a timed-out PROVISIONING back to IDLE once destroyed', () => {
    const v = view({ worlds: [singleWorld(record('PROVISIONING', 's1', true))], hosted: [hosted('s1')] });
    const correction = reconcileWorld(v, v.worlds[0], [outcome('s1', 'provisioning-timeout', true)], []);
    expect(correction.state).toBe('IDLE');
    expect(correction.clearFacts).toBe(true);
    expect(correction.lastError).toContain('provisioning');
    expect(types(correction.events)).toEqual(['ProvisioningFailed']);
  });

  // FAILED is for a cleanup that could not be guaranteed, never for an
  // ordinary failure — §5.
  it('sends a PROVISIONING whose cleanup failed to FAILED, keeping the facts', () => {
    const v = view({ worlds: [singleWorld(record('PROVISIONING', 's1', true))], hosted: [hosted('s1')] });
    const correction = reconcileWorld(v, v.worlds[0], [outcome('s1', 'provisioning-timeout', false)], []);
    expect(correction.state).toBe('FAILED');
    expect(correction.clearFacts).toBe(false);
    expect(types(correction.events)).toEqual(['CleanupFailed']);
  });

  it('sends a timed-out STOPPING back to IDLE and says the session stopped', () => {
    const v = view({ worlds: [singleWorld(record('STOPPING', 's1', true))], hosted: [hosted('s1')] });
    const correction = reconcileWorld(v, v.worlds[0], [outcome('s1', 'stopping-timeout', true)], []);
    expect(correction.state).toBe('IDLE');
    expect(correction.clearFacts).toBe(true);
    expect(types(correction.events)).toEqual(['SessionStopped']);
  });

  it('leaves FAILED once the retried destruction succeeds', () => {
    const v = view({ worlds: [singleWorld(record('FAILED', 's1', true))], hosted: [hosted('s1')] });
    const correction = reconcileWorld(v, v.worlds[0], [outcome('s1', 'failed-retry', true)], []);
    expect(correction.state).toBe('IDLE');
    expect(correction.clearFacts).toBe(true);
    expect(types(correction.events)).toEqual(['SessionReclaimed']);
  });

  // Reachable only for a FAILED record naming no session: with one, the
  // failed-retry reclamation above has already answered for it.
  it('leaves FAILED when the record names no session to retry', () => {
    const v = view({ worlds: [singleWorld(record('FAILED', null, true))] });
    const correction = reconcileWorld(v, v.worlds[0], [], []);
    expect(correction.state).toBe('IDLE');
    expect(correction.clearFacts).toBe(true);
  });

  // Null means "leave the recorded one alone", so the interface can still say
  // that the previous attempt failed once the state is back to IDLE.
  it('does not erase the recorded error on its way out of FAILED', () => {
    const v = view({ worlds: [singleWorld(record('FAILED', null, true))] });
    expect(reconcileWorld(v, v.worlds[0], [], []).lastError).toBeNull();
  });

  it('stays in FAILED while the destruction keeps failing', () => {
    const v = view({ worlds: [singleWorld(record('FAILED', 's1', true))], hosted: [hosted('s1')] });
    const correction = reconcileWorld(v, v.worlds[0], [outcome('s1', 'failed-retry', false)], []);
    expect(correction.state).toBe('FAILED');
    expect(types(correction.events)).toEqual(['CleanupFailed']);
  });

  // §5 draws no arrow from IDLE into FAILED, and there would be nothing to
  // show: the record already holds nothing. The failure is audited, and the
  // next pass retries it through the tag.
  it('does not send an IDLE record to FAILED when a residual cleanup fails', () => {
    const v = view({ worlds: [singleWorld(record('IDLE', 's1', true))], hosted: [hosted('s1')] });
    const correction = reconcileWorld(v, v.worlds[0], [outcome('s1', 'no-open-session', false)], []);
    expect(correction.state).toBeNull();
    expect(types(correction.events)).toEqual(['CleanupFailed']);
  });

  // §5's state diagram: RUNNING --> IDLE, the machine vanished at the provider.
  it('sends RUNNING back to IDLE when the provider holds nothing for it', () => {
    const v = view({ worlds: [singleWorld(record('RUNNING', 's1', true))] });
    const correction = reconcileWorld(v, v.worlds[0], [], []);
    expect(correction.state).toBe('IDLE');
    expect(correction.clearFacts).toBe(true);
    expect(types(correction.events)).toEqual(['SessionStopped']);
  });

  // An intent left open outlives the session it was opened for: `openSessions()`
  // hands the id back on every pass, and a resource that surfaces under its tag
  // afterwards is then reclaimed by nobody — held off by the intent, skipped by
  // the sweep. §4: no Scaleway resource outlives its session.
  it('closes the intent of the session whose machine vanished', () => {
    const v = view({ worlds: [singleWorld(record('RUNNING', 's1', true))], openSessions: ['s1'] });
    const correction = reconcileWorld(v, v.worlds[0], [], []);
    expect(correction.state).toBe('IDLE');
    expect(correction.closeIntents).toEqual(['s1']);
  });

  // An outcome is not an outcome for *this* record. `no-open-session` produces
  // reclamations for sessions the record never names, and one of them failing
  // must not drag a healthy RUNNING session to FAILED: FAILED is the exit from
  // a cleanup nobody could guarantee, never the entrance to someone else's.
  it('ignores an outcome that belongs to another session', () => {
    const v = view({
      worlds: [singleWorld(record('RUNNING', 's1', true))],
      hosted: [hosted('s1'), hosted('s2')],
      openSessions: ['s1'],
    });
    const correction = reconcileWorld(v, v.worlds[0], [outcome('s2', 'no-open-session', false)], []);
    expect(correction.state).toBeNull();
    expect(types(correction.events)).toEqual(['CleanupFailed']);
  });

  it('leaves RUNNING alone while the provider still holds its session', () => {
    const v = view({
      worlds: [singleWorld(record('RUNNING', 's1', true))],
      hosted: [hosted('s1')],
      openSessions: ['s1'],
    });
    const correction = reconcileWorld(v, v.worlds[0], [], []);
    expect(correction.state).toBeNull();
    expect(correction.clearFacts).toBe(false);
  });

  it('empties the reserved facts left over on an IDLE record', () => {
    const v = view({ worlds: [singleWorld(record('IDLE', null, true))] });
    const correction = reconcileWorld(v, v.worlds[0], [], []);
    expect(correction.state).toBeNull();
    expect(correction.clearFacts).toBe(true);
    expect(correction.closeIntents).toEqual([]);
  });

  // Same reason as above: the facts go, and the intent goes with them. An IDLE
  // record still naming a session is the one shape where clearing the facts
  // alone would leave the id open for every pass to come.
  it('closes the intent of an IDLE record it empties', () => {
    const v = view({ worlds: [singleWorld(record('IDLE', 's1', true))], openSessions: ['s1'] });
    const correction = reconcileWorld(v, v.worlds[0], [], []);
    expect(correction.clearFacts).toBe(true);
    expect(correction.closeIntents).toEqual(['s1']);
  });

  // §6: a forged deadline is brought back to the bound, and the gap is audited.
  // It is never displayed: the interface already bounds on read (§4).
  it('brings a forged deadline back and files the fact', () => {
    // Hosted, so the machine is genuinely alive: without it, the "machine
    // disappeared at the provider" branch above would fire first and this one
    // would never run.
    const v = view({
      worlds: [singleWorld(record('RUNNING', 's1'), runningSession('s1', '2026-09-07T12:00:00Z'))],
      hosted: [hosted('s1')],
      now: new Date('2026-09-06T20:00:00Z'),
    });
    const correction = reconcileWorld(v, v.worlds[0], [], []);
    expect(correction.deadline?.at).toEqual(new Date('2026-09-07T00:00:00Z'));
    expect(correction.events).toEqual([
      { type: 'DeadlineClamped', sessionId: 's1', detail: 'brought back from 12:00 UTC to 00:00 UTC' },
    ]);
  });

  it('leaves an honest deadline alone, and files nothing', () => {
    const v = view({
      worlds: [singleWorld(record('RUNNING', 's1'), runningSession('s1', '2026-09-06T23:00:00Z'))],
      hosted: [hosted('s1')],
      now: new Date('2026-09-06T20:00:00Z'),
    });
    const correction = reconcileWorld(v, v.worlds[0], [], []);
    expect(correction.deadline).toBeNull();
    expect(correction.events).toEqual([]);
  });

  // §11: SessionStopped is the one event carrying a figure, and the month's
  // total is summed from it. A stop that files no cost is a month that is wrong.
  it('hangs the estimated cost on the stop it files', () => {
    const v = view({
      worlds: [singleWorld(record('RUNNING', 's1'), runningSession('s1', '2026-09-07T00:00:00Z'))],
      now: new Date('2026-09-07T00:03:00Z'),
    });
    const outcomes: ReclaimOutcome[] = [
      { reclamation: { sessionId: 's1', reason: 'stopping-timeout', detail: 'server x' }, closed: true },
    ];
    const stopped = reconcileWorld(v, v.worlds[0], outcomes, []).events.find(
      (e) => e.type === 'SessionStopped',
    );
    // Five started hours between 20:00 and 00:03, at the DEV1-L rate.
    expect(stopped).toMatchObject({ sessionId: 's1', costEuros: 0.27 });
  });

  it('files a zero cost when no session explains the reclamation', () => {
    const v = view({ worlds: [singleWorld(record('STOPPING', 's1'), null)] });
    const outcomes: ReclaimOutcome[] = [
      { reclamation: { sessionId: 's1', reason: 'stopping-timeout', detail: 'server x' }, closed: true },
    ];
    const stopped = reconcileWorld(v, v.worlds[0], outcomes, []).events.find(
      (e) => e.type === 'SessionStopped',
    );
    expect(stopped).toMatchObject({ costEuros: 0 });
  });

  // The load-bearing rule of this task: the cost of a stop is read from the
  // session of the world it belongs to, never from another's — the trap the
  // plural set, since `costEuros` used to be computed once, on `view.session`.
  it('costs a stop from the session of that world, not another', () => {
    const stoppingSession = (sessionId: string, startedAtIso: string) =>
      Session.from({
        state: 'STOPPING',
        sessionId,
        worldId: 'w',
        game: 'enshrouded',
        startedBy: 'u1',
        startedAt: new Date(startedAtIso),
        deadline: Deadline.at(new Date('2026-09-05T01:00:00Z')),
        instanceSize: 'DEV1-L',
        hasJoinInfo: true,
      });
    const cheap = stoppingSession('s-a', '2026-09-04T20:30:00Z'); // une heure facturée
    const expensive = stoppingSession('s-b', '2026-09-04T10:00:00Z'); // onze
    const v = view({
      worlds: [
        { worldId: 'a', server: record('STOPPING', 's-a', true), session: cheap },
        { worldId: 'b', server: record('STOPPING', 's-b', true), session: expensive },
      ],
      hosted: [],
      openSessions: [],
    });
    const stopA = reconcileWorld(v, v.worlds[0], [outcome('s-a', 'stopping-timeout', true)], []);
    const stopB = reconcileWorld(v, v.worlds[1], [outcome('s-b', 'stopping-timeout', true)], []);
    const cost = (c: StateCorrection) =>
      (c.events.find((e) => e.type === 'SessionStopped') as { costEuros: number }).costEuros;
    expect(cost(stopB)).toBeGreaterThan(cost(stopA));
  });

  // Review finding 2: a session `reclamations()` puts in `expired` still has
  // to become something server/current can hold. Folded into reconcileWorld so
  // a single function owns the answer, rather than a second write racing this
  // one from the caller.
  describe('with an expired session', () => {
    const expiring = (sessionId: string): Expiration[] => [
      { worldId: 'w', sessionId, detail: 'closing time was 00:00 UTC' },
    ];

    it('writes STOPPING and files SessionExpired for a session the provider still holds', () => {
      const v = view({ worlds: [singleWorld(record('RUNNING', 's1'))], hosted: [hosted('s1')] });
      const correction = reconcileWorld(v, v.worlds[0], [], expiring('s1'));
      expect(correction.state).toBe('STOPPING');
      expect(correction.clearFacts).toBe(false);
      expect(correction.events).toEqual([
        { type: 'SessionExpired', sessionId: 's1', detail: 'closing time was 00:00 UTC' },
      ]);
    });

    // The case the review found: a machine already gone at the provider must
    // ground to IDLE, never park in STOPPING waiting on an agent that no
    // longer exists — that grounding already carries the cost, and writing
    // STOPPING over it would leave a second, contradictory SessionStopped for
    // the ten-minute net to file later, doubling the cost §11 sums.
    it('grounds a vanished session to IDLE even when its deadline has also passed', () => {
      const v = view({ worlds: [singleWorld(record('RUNNING', 's1'))] });
      const correction = reconcileWorld(v, v.worlds[0], [], expiring('s1'));
      expect(correction.state).toBe('IDLE');
      expect(correction.clearFacts).toBe(true);
      expect(types(correction.events)).toEqual(['SessionStopped']);
    });

    it('leaves an unrelated session alone', () => {
      const v = view({ worlds: [singleWorld(record('RUNNING', 's1'))], hosted: [hosted('s1')] });
      const correction = reconcileWorld(v, v.worlds[0], [], expiring('s2'));
      expect(correction.state).toBeNull();
    });
  });
});

describe('sweepEvents', () => {
  it('records the sweep of what no session claimed, with a null subject', () => {
    const events = sweepEvents({ ...quiet, destroyed: ['ip 51.15.0.1'] }, []);
    expect(events).toEqual([{ type: 'SessionReclaimed', sessionId: null, detail: 'ip 51.15.0.1' }]);
  });

  it('says nothing when the sweep found nothing', () => {
    expect(sweepEvents(quiet, [])).toEqual([]);
  });

  it('records a sweep that could not run', () => {
    const events = sweepEvents({ ...quiet, errors: ['api down'] }, []);
    expect(types(events)).toEqual(['CleanupFailed']);
  });

  // The whole reason the sweep reports three lists: what it destroyed has to
  // survive a refusal on what came after, or that spending is never audited.
  it('keeps what the sweep destroyed even when part of it refused', () => {
    const events = sweepEvents(
      { destroyed: ['ip 51.15.0.1'], stranded: [], errors: ['scaleway refused terminate s-1'] },
      [],
    );
    expect(types(events).sort()).toEqual(['CleanupFailed', 'SessionReclaimed']);
  });

  // §6: signalé, jamais détruit. Announcing is the entire action.
  it('announces a stranded volume on its appearance and destroys nothing', () => {
    const events = sweepEvents({ ...quiet, stranded: ['volume v-1 (80G)'] }, []);
    expect(events).toEqual([{ type: 'ResourceStranded', sessionId: null, detail: 'volume v-1 (80G)' }]);
  });

  // §4: an event is a fact in the past. Nothing will ever destroy a stranded
  // volume, so it is stranded again on every pass; announcing it every time
  // would file 288 facts a day in the journal §11 totals the month from.
  it('says nothing of a volume a previous pass already announced', () => {
    const events = sweepEvents({ ...quiet, stranded: ['volume v-1 (80G)'] }, ['volume v-1 (80G)']);
    expect(events).toEqual([]);
  });

  it('announces the volume that appeared beside one already announced', () => {
    const events = sweepEvents(
      { ...quiet, stranded: ['volume v-1 (80G)', 'volume v-2 (80G)'] },
      ['volume v-1 (80G)'],
    );
    expect(events).toEqual([{ type: 'ResourceStranded', sessionId: null, detail: 'volume v-2 (80G)' }]);
  });

  // The sense of the split: what the sweep files never depends on which world
  // is being reconciled, and it is written once, whatever the number of worlds
  // — see `sweepEvents` in reconcile.ts for the constraint this fixes.
  it('files what the sweep destroyed, refused and newly stranded, and nothing already announced', () => {
    const events = sweepEvents(
      { destroyed: ['ip 1.2.3.4'], stranded: ['vol-old', 'vol-new'], errors: ['refused vol-x'] },
      ['vol-old'],
    );
    expect(events.map((e) => e.type)).toEqual(['CleanupFailed', 'SessionReclaimed', 'ResourceStranded']);
    expect(events.every((e) => e.sessionId === null)).toBe(true);
  });
});
