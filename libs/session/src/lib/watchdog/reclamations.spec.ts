import { describe, expect, it } from 'vitest';
import type { HostedServer } from '../ports.js';
import type { SessionState } from '../session.js';
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
  ...parts,
});

const reasons = (v: WatchdogView) =>
  reclamations(v, DEFAULT_LIMITS).map((r) => `${r.sessionId}:${r.reason}`);

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
      server: record('PROVISIONING', 's1', minutesAgo(16)),
    });
    expect(reasons(v)).toEqual(['s1:provisioning-timeout']);
  });

  it('leaves a PROVISIONING session that is still within the limit', () => {
    const v = view({
      hosted: [hosted('s1')],
      openSessions: ['s1'],
      server: record('PROVISIONING', 's1', minutesAgo(14)),
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
    const v = view({ openSessions: ['s1'], server: record('PROVISIONING', 's1', minutesAgo(16)) });
    const [first] = reclamations(v, DEFAULT_LIMITS);
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
      server: record('PROVISIONING', 's1', minutesAgo(20)),
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
    const [first] = reclamations(view({ hosted: [hosted('s1')] }), DEFAULT_LIMITS);
    expect(first.detail).toBe('server for s1');
  });
});
