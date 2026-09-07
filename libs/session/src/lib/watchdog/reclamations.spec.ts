import { describe, expect, it } from 'vitest';
import { Deadline } from '../deadline.js';
import type { HostedServer } from '../ports.js';
import { Session } from '../session-aggregate.js';
import type { SessionState } from '../session.js';
import { DEFAULT_SETTINGS } from '../settings.js';
import { reclamations } from './reclamations.js';
import { DEFAULT_LIMITS, type ServerRecord, type WatchdogView } from './view.js';

const NOW = new Date('2026-09-04T21:00:00Z');
const minutesAgo = (n: number) => new Date(NOW.getTime() - n * 60_000);

const hosted = (sessionId: string): HostedServer => ({
  sessionId,
  summary: `server for ${sessionId}`,
});

const record = (
  state: SessionState | null,
  sessionId: string | null,
  stateSince: Date | null,
): ServerRecord => ({ state, sessionId, stateSince, hasReservedFacts: false });

const view = (parts: Partial<WatchdogView> = {}): WatchdogView => ({
  now: NOW,
  server: null,
  hosted: [],
  openSessions: [],
  alreadyAnnounced: [],
  session: null,
  settings: DEFAULT_SETTINGS,
  ...parts,
});

const runningSession = (sessionId: string, deadlineIso: string) =>
  Session.from({
    state: 'RUNNING',
    sessionId,
    game: 'enshrouded',
    startedBy: 'u1',
    startedAt: new Date('2026-09-06T20:00:00Z'),
    deadline: Deadline.at(new Date(deadlineIso)),
    instanceSize: 'DEV1-L',
    hasJoinInfo: true,
  });

const reasons = (v: WatchdogView) =>
  reclamations(v, DEFAULT_LIMITS).destroy.map((r) => `${r.sessionId}:${r.reason}`);

const expired = (v: WatchdogView) => reclamations(v, DEFAULT_LIMITS).expired;

describe('reclamations', () => {
  it('reclaims nothing when every hosted session has an open intent', () => {
    expect(reasons(view({ hosted: [hosted('s1')], openSessions: ['s1'] }))).toEqual([]);
  });

  // The load-bearing rule of the whole tranche.
  it('reclaims a hosted session no open intent explains', () => {
    expect(reasons(view({ hosted: [hosted('s1')] }))).toEqual(['s1:no-open-session']);
  });

  it('reclaims every unexplained session, not just the first', () => {
    expect(reasons(view({ hosted: [hosted('s1'), hosted('s2')] }))).toEqual([
      's1:no-open-session',
      's2:no-open-session',
    ]);
  });

  it('reclaims a session stuck in PROVISIONING past the limit', () => {
    const v = view({
      hosted: [hosted('s1')],
      openSessions: ['s1'],
      server: record('PROVISIONING', 's1', minutesAgo(26)),
    });
    expect(reasons(v)).toEqual(['s1:provisioning-timeout']);
  });

  it('leaves a PROVISIONING session that is still within the limit', () => {
    const v = view({
      hosted: [hosted('s1')],
      openSessions: ['s1'],
      server: record('PROVISIONING', 's1', minutesAgo(24)),
    });
    expect(reasons(v)).toEqual([]);
  });

  it('reclaims a session stuck in STOPPING past its own, shorter limit', () => {
    const v = view({
      hosted: [hosted('s1')],
      openSessions: ['s1'],
      server: record('STOPPING', 's1', minutesAgo(11)),
    });
    expect(reasons(v)).toEqual(['s1:stopping-timeout']);
  });

  // FAILED is a waiting state, not a wall: it is retried on every pass.
  it('retries a FAILED record with no delay at all', () => {
    const v = view({
      hosted: [hosted('s1')],
      openSessions: ['s1'],
      server: record('FAILED', 's1', minutesAgo(0)),
    });
    expect(reasons(v)).toEqual(['s1:failed-retry']);
  });

  // §6 says "destruction, THEN IDLE". The "then" has to happen even when there
  // is nothing left to destroy: a crash before the first resource exists leaves
  // a PROVISIONING nobody can undo, since the browser may not write IDLE (§5).
  // close() is idempotent by contract, so reclaiming an empty session costs two
  // reads at the provider and is what lets reconcile ground the state.
  it('reclaims a stuck session even when the provider holds nothing', () => {
    const v = view({ openSessions: ['s1'], server: record('STOPPING', 's1', minutesAgo(30)) });
    expect(reasons(v)).toEqual(['s1:stopping-timeout']);
  });

  it('says as much in the detail, rather than inventing provider wording', () => {
    const v = view({ openSessions: ['s1'], server: record('PROVISIONING', 's1', minutesAgo(26)) });
    const [first] = reclamations(v, DEFAULT_LIMITS).destroy;
    expect(first.detail).toBe('the provider holds nothing for this session');
  });

  // A document that says something this vocabulary does not know is not a
  // reason to destroy: the tag-based line already covers what it owns.
  it('decides nothing from a record whose state it cannot read', () => {
    const v = view({
      hosted: [hosted('s1')],
      openSessions: ['s1'],
      server: record(null, 's1', minutesAgo(60)),
    });
    expect(reasons(v)).toEqual([]);
  });

  it('never reclaims the same session twice, and the specific reason wins', () => {
    const v = view({
      hosted: [hosted('s1')],
      openSessions: [],
      server: record('PROVISIONING', 's1', minutesAgo(26)),
    });
    expect(reasons(v)).toEqual(['s1:provisioning-timeout']);
  });

  // A record seeded before stateSince existed must not be read as "stuck since
  // the epoch" and destroyed on sight.
  it('applies no delay to a record with no stateSince', () => {
    const v = view({
      hosted: [hosted('s1')],
      openSessions: ['s1'],
      server: record('PROVISIONING', 's1', null),
    });
    expect(reasons(v)).toEqual([]);
  });

  it('carries the provider wording into the reclamation', () => {
    const [first] = reclamations(view({ hosted: [hosted('s1')] }), DEFAULT_LIMITS).destroy;
    expect(first.detail).toBe('server for s1');
  });

  // §6, and the load-bearing rule of task 9 bis: an elapsed deadline finishes a
  // session, it does not seize its resources. Destroying here is exactly the
  // bug the whole-branch review found — both stop paths tore the machine down
  // before the agent ever learned it was stopping.
  it('destroys nothing when a deadline passes the grace', () => {
    const v = view({
      server: record('RUNNING', 's1', null),
      session: runningSession('s1', '2026-09-07T00:00:00Z'),
      now: new Date('2026-09-07T00:02:01Z'),
    });
    expect(reclamations(v, DEFAULT_LIMITS).destroy).toEqual([]);
  });

  // In its place: a request to stop, so the watchdog can write STOPPING and
  // let the clean shutdown of §6 run — the agent stops the game, pushes the
  // last save, and reports it; that report is what destroys, in agentReport.
  it('asks a session to stop once its deadline passes the grace', () => {
    const v = view({
      server: record('RUNNING', 's1', null),
      session: runningSession('s1', '2026-09-07T00:00:00Z'),
      now: new Date('2026-09-07T00:02:01Z'),
    });
    expect(expired(v)).toEqual([{ sessionId: 's1', detail: 'closing time was 00:00 UTC' }]);
  });

  it('leaves a session alone inside the grace', () => {
    const v = view({
      server: record('RUNNING', 's1', null),
      session: runningSession('s1', '2026-09-07T00:00:00Z'),
      now: new Date('2026-09-07T00:01:59Z'),
    });
    expect(reclamations(v, DEFAULT_LIMITS)).toEqual({ destroy: [], expired: [] });
  });

  // The filet, and it must not move: an expired deadline no longer destroys,
  // so this is the only line left that ever does — a STOPPING session the
  // agent never reported back for.
  it('still destroys a session stuck in STOPPING past its own limit, deadline aside', () => {
    const v = view({
      hosted: [hosted('s1')],
      openSessions: ['s1'],
      server: record('STOPPING', 's1', minutesAgo(11)),
    });
    const decision = reclamations(v, DEFAULT_LIMITS);
    expect(decision.destroy).toEqual([
      { sessionId: 's1', reason: 'stopping-timeout', detail: 'server for s1' },
    ]);
    expect(decision.expired).toEqual([]);
  });
});
