import { describe, expect, it } from 'vitest';
import type { HostedServer, UnclaimedSweep } from '../ports.js';
import type { SessionState } from '../session.js';
import type { Reclamation } from './reclamations.js';
import { reconcile, type ReclaimOutcome } from './reconcile.js';
import type { ServerRecord, WatchdogView } from './view.js';

const NOW = new Date('2026-09-04T21:00:00Z');

const hosted = (sessionId: string): HostedServer => ({ sessionId, summary: `held ${sessionId}` });

const record = (
  state: SessionState,
  sessionId: string | null,
  hasReservedFacts = false,
): ServerRecord => ({ state, sessionId, stateSince: NOW, hasReservedFacts });

const view = (parts: Partial<WatchdogView> = {}): WatchdogView => ({
  now: NOW,
  server: null,
  hosted: [],
  openSessions: [],
  alreadyAnnounced: [],
  ...parts,
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

describe('reconcile', () => {
  it('corrects nothing when nothing happened', () => {
    const correction = reconcile(view(), [], quiet);
    expect(correction.state).toBeNull();
    expect(correction.clearFacts).toBe(false);
    expect(correction.events).toEqual([]);
    expect(correction.closeIntents).toEqual([]);
  });

  it('leaves the state alone when server/current does not exist', () => {
    const v = view({ hosted: [hosted('s1')] });
    const correction = reconcile(v, [outcome('s1', 'no-open-session', true)], quiet);
    expect(correction.state).toBeNull();
    expect(types(correction.events)).toEqual(['SessionReclaimed']);
    expect(correction.closeIntents).toEqual(['s1']);
  });

  it('closes the intent of a session it destroyed', () => {
    const v = view({ hosted: [hosted('s1')] });
    const correction = reconcile(v, [outcome('s1', 'no-open-session', true)], quiet);
    expect(correction.closeIntents).toEqual(['s1']);
  });

  // Leaving the intent open is what brings the watchdog back to it next pass.
  it('leaves the intent open when the destruction failed', () => {
    const v = view({ hosted: [hosted('s1')] });
    const correction = reconcile(v, [outcome('s1', 'no-open-session', false)], quiet);
    expect(correction.closeIntents).toEqual([]);
    expect(types(correction.events)).toEqual(['CleanupFailed']);
  });

  it('sends a timed-out PROVISIONING back to IDLE once destroyed', () => {
    const v = view({ server: record('PROVISIONING', 's1', true), hosted: [hosted('s1')] });
    const correction = reconcile(v, [outcome('s1', 'provisioning-timeout', true)], quiet);
    expect(correction.state).toBe('IDLE');
    expect(correction.clearFacts).toBe(true);
    expect(correction.lastError).toContain('provisioning');
    expect(types(correction.events)).toEqual(['ProvisioningFailed']);
  });

  // FAILED is for a cleanup that could not be guaranteed, never for an
  // ordinary failure — §5.
  it('sends a PROVISIONING whose cleanup failed to FAILED, keeping the facts', () => {
    const v = view({ server: record('PROVISIONING', 's1', true), hosted: [hosted('s1')] });
    const correction = reconcile(v, [outcome('s1', 'provisioning-timeout', false)], quiet);
    expect(correction.state).toBe('FAILED');
    expect(correction.clearFacts).toBe(false);
    expect(types(correction.events)).toEqual(['CleanupFailed']);
  });

  it('sends a timed-out STOPPING back to IDLE and says the session stopped', () => {
    const v = view({ server: record('STOPPING', 's1', true), hosted: [hosted('s1')] });
    const correction = reconcile(v, [outcome('s1', 'stopping-timeout', true)], quiet);
    expect(correction.state).toBe('IDLE');
    expect(correction.clearFacts).toBe(true);
    expect(types(correction.events)).toEqual(['SessionStopped']);
  });

  it('leaves FAILED once the retried destruction succeeds', () => {
    const v = view({ server: record('FAILED', 's1', true), hosted: [hosted('s1')] });
    const correction = reconcile(v, [outcome('s1', 'failed-retry', true)], quiet);
    expect(correction.state).toBe('IDLE');
    expect(correction.clearFacts).toBe(true);
    expect(types(correction.events)).toEqual(['SessionReclaimed']);
  });

  // Reachable only for a FAILED record naming no session: with one, the
  // failed-retry reclamation above has already answered for it.
  it('leaves FAILED when the record names no session to retry', () => {
    const v = view({ server: record('FAILED', null, true) });
    const correction = reconcile(v, [], quiet);
    expect(correction.state).toBe('IDLE');
    expect(correction.clearFacts).toBe(true);
  });

  // Null means "leave the recorded one alone", so the interface can still say
  // that the previous attempt failed once the state is back to IDLE.
  it('does not erase the recorded error on its way out of FAILED', () => {
    const v = view({ server: record('FAILED', null, true) });
    expect(reconcile(v, [], quiet).lastError).toBeNull();
  });

  it('stays in FAILED while the destruction keeps failing', () => {
    const v = view({ server: record('FAILED', 's1', true), hosted: [hosted('s1')] });
    const correction = reconcile(v, [outcome('s1', 'failed-retry', false)], quiet);
    expect(correction.state).toBe('FAILED');
    expect(types(correction.events)).toEqual(['CleanupFailed']);
  });

  // §5 draws no arrow from IDLE into FAILED, and there would be nothing to
  // show: the record already holds nothing. The failure is audited, and the
  // next pass retries it through the tag.
  it('does not send an IDLE record to FAILED when a residual cleanup fails', () => {
    const v = view({ server: record('IDLE', 's1', true), hosted: [hosted('s1')] });
    const correction = reconcile(v, [outcome('s1', 'no-open-session', false)], quiet);
    expect(correction.state).toBeNull();
    expect(types(correction.events)).toEqual(['CleanupFailed']);
  });

  // §5's state diagram: RUNNING --> IDLE, the machine vanished at the provider.
  it('sends RUNNING back to IDLE when the provider holds nothing for it', () => {
    const v = view({ server: record('RUNNING', 's1', true) });
    const correction = reconcile(v, [], quiet);
    expect(correction.state).toBe('IDLE');
    expect(correction.clearFacts).toBe(true);
    expect(types(correction.events)).toEqual(['SessionStopped']);
  });

  // An outcome is not an outcome for *this* record. `no-open-session` produces
  // reclamations for sessions the record never names, and one of them failing
  // must not drag a healthy RUNNING session to FAILED: FAILED is the exit from
  // a cleanup nobody could guarantee, never the entrance to someone else's.
  it('ignores an outcome that belongs to another session', () => {
    const v = view({
      server: record('RUNNING', 's1', true),
      hosted: [hosted('s1'), hosted('s2')],
      openSessions: ['s1'],
    });
    const correction = reconcile(v, [outcome('s2', 'no-open-session', false)], quiet);
    expect(correction.state).toBeNull();
    expect(types(correction.events)).toEqual(['CleanupFailed']);
  });

  it('leaves RUNNING alone while the provider still holds its session', () => {
    const v = view({ server: record('RUNNING', 's1', true), hosted: [hosted('s1')], openSessions: ['s1'] });
    const correction = reconcile(v, [], quiet);
    expect(correction.state).toBeNull();
    expect(correction.clearFacts).toBe(false);
  });

  it('empties the reserved facts left over on an IDLE record', () => {
    const v = view({ server: record('IDLE', null, true) });
    const correction = reconcile(v, [], quiet);
    expect(correction.state).toBeNull();
    expect(correction.clearFacts).toBe(true);
  });

  it('records the sweep of what no session claimed, with a null subject', () => {
    const correction = reconcile(view(), [], { ...quiet, destroyed: ['ip 51.15.0.1'] });
    expect(correction.events).toEqual([
      { type: 'SessionReclaimed', sessionId: null, detail: 'ip 51.15.0.1' },
    ]);
  });

  it('says nothing when the sweep found nothing', () => {
    expect(reconcile(view(), [], quiet).events).toEqual([]);
  });

  it('records a sweep that could not run', () => {
    const correction = reconcile(view(), [], { ...quiet, errors: ['api down'] });
    expect(types(correction.events)).toEqual(['CleanupFailed']);
  });

  // The whole reason the sweep reports three lists: what it destroyed has to
  // survive a refusal on what came after, or that spending is never audited.
  it('keeps what the sweep destroyed even when part of it refused', () => {
    const correction = reconcile(view(), [], {
      destroyed: ['ip 51.15.0.1'],
      stranded: [],
      errors: ['scaleway refused terminate s-1'],
    });
    expect(types(correction.events).sort()).toEqual(['CleanupFailed', 'SessionReclaimed']);
  });

  // §6: signalé, jamais détruit. Announcing is the entire action.
  it('announces a stranded volume on its appearance and destroys nothing', () => {
    const correction = reconcile(view(), [], { ...quiet, stranded: ['volume v-1 (80G)'] });
    expect(correction.events).toEqual([
      { type: 'ResourceStranded', sessionId: null, detail: 'volume v-1 (80G)' },
    ]);
    expect(correction.state).toBeNull();
    expect(correction.clearFacts).toBe(false);
  });

  // §4: an event is a fact in the past. Nothing will ever destroy a stranded
  // volume, so it is stranded again on every pass; announcing it every time
  // would file 288 facts a day in the journal §11 totals the month from.
  it('says nothing of a volume a previous pass already announced', () => {
    const v = view({ alreadyAnnounced: ['volume v-1 (80G)'] });

    const correction = reconcile(v, [], { ...quiet, stranded: ['volume v-1 (80G)'] });

    expect(correction.events).toEqual([]);
  });

  it('announces the volume that appeared beside one already announced', () => {
    const v = view({ alreadyAnnounced: ['volume v-1 (80G)'] });

    const correction = reconcile(v, [], {
      ...quiet,
      stranded: ['volume v-1 (80G)', 'volume v-2 (80G)'],
    });

    expect(correction.events).toEqual([
      { type: 'ResourceStranded', sessionId: null, detail: 'volume v-2 (80G)' },
    ]);
  });
});
