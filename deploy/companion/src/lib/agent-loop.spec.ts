import { beforeEach, describe, expect, it, vi } from 'vitest';
import { REPORT_INTERVAL_MS } from '@beacon/agent-protocol';
import { runAgentLoop, type AgentLoopDeps } from './agent-loop.js';

let deps: AgentLoopDeps;

beforeEach(() => {
  // One minute per turn, so the push cadence is reached by counting turns and
  // never by waiting: a test that slept for real would be the slowest in the
  // repository and would prove nothing more.
  let tick = 0;
  deps = {
    probeReady: vi.fn(async () => ({ ready: true })),
    report: vi.fn(async () => ({ state: 'RUNNING' as const, deadlineIso: null })),
    onStopping: vi.fn(async () => undefined),
    onPushDue: vi.fn(async () => undefined),
    sleep: vi.fn(async () => undefined),
    log: vi.fn(),
    clock: { now: () => new Date(1_757_000_000_000 + tick++ * 60_000) },
    reportIntervalMs: REPORT_INTERVAL_MS,
    pushIntervalMs: 600_000,
  };
});

describe('runAgentLoop', () => {
  // §6 étape 7: the first thing the control plane hears is that the server
  // answers, and that write is what RUNNING means.
  it('reports ready the first time the server answers, and only once', async () => {
    let turns = 0;
    const probeReady = vi.fn(async () => ({ ready: ++turns > 1 }));
    await runAgentLoop({ ...deps, probeReady, until: () => turns >= 4 });

    const phases = (deps.report as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0].phase);
    expect(phases[0]).toBe('alive');
    expect(phases.filter((phase: string) => phase === 'ready')).toHaveLength(1);
  });

  // Every minute, whatever the server is doing. §6 hangs two guarantees on this
  // cadence: an extension is learned in under a minute, and the watchdog can
  // tell a slow machine from a mute one.
  it('reports on every turn, ready or not', async () => {
    // The turn counter lives in `probeReady`, not in `until`: a stop predicate
    // that mutates the very count it is asserted on would make the loop's
    // shape answer to the test, and `until` is documented as never true in
    // production — it should only ever read state, not drive it.
    let turns = 0;
    const probeReady = vi.fn(async () => {
      turns++;
      return { ready: false };
    });
    await runAgentLoop({ ...deps, probeReady, until: () => turns >= 3 });
    expect(deps.report).toHaveBeenCalledTimes(3);
  });

  // The state comes back on every answer, so the machine learns a stop within
  // one report — no notification to miss, no channel to keep open.
  it('hands the shutdown over as soon as the answer says STOPPING', async () => {
    const report = vi.fn(async () => ({ state: 'STOPPING' as const, deadlineIso: null }));
    await runAgentLoop({ ...deps, report, until: () => false });
    expect(deps.onStopping).toHaveBeenCalledTimes(1);
  });

  // A machine whose session is over has nothing left to do. The endpoint
  // answers IDLE to a stale token holder for exactly this reason.
  it('stops when it is told its session is over', async () => {
    const report = vi.fn(async () => ({ state: 'IDLE' as const, deadlineIso: null }));
    await runAgentLoop({ ...deps, report, until: () => false });
    expect(deps.onStopping).not.toHaveBeenCalled();
    expect(report).toHaveBeenCalledTimes(1);
  });

  // The endpoint is on the other side of a network and the session is not over
  // because one call failed. A loop that died here would stop pushing saves.
  it('survives a report that fails, and reports again', async () => {
    let turns = 0;
    const report = vi.fn(async () => {
      if (++turns === 1) throw new Error('ECONNRESET');
      return { state: 'RUNNING' as const, deadlineIso: null };
    });
    await runAgentLoop({ ...deps, report, until: () => turns >= 3 });
    expect(report).toHaveBeenCalledTimes(3);
  });

  // §6: the push cadence is what keeps the world backed up while the session
  // runs, and task 8 only fills in `onPushDue`'s body — this pins the branch
  // that decides whether it is ever called at all, and that it does not fire
  // on every turn once it has fired.
  it('pushes once the interval elapses, and not again before it elapses a second time', async () => {
    let turns = 0;
    const probeReady = vi.fn(async () => {
      turns++;
      return { ready: true };
    });
    await runAgentLoop({
      ...deps,
      probeReady,
      pushIntervalMs: 180_000,
      until: () => turns >= 4,
    });
    expect(deps.onPushDue).toHaveBeenCalledTimes(1);
  });

  // `lastPush` starts at boot, not at the moment the server announces — so a
  // session slow to answer pushes as soon as it announces, if the interval has
  // already elapsed since boot, rather than waiting a full interval from
  // readiness. Chosen deliberately: the cadence bounds how stale a backup can
  // get against wall-clock time, which is what a player's lost minutes are
  // measured in, not against how long the world took to load — and an early
  // save costs one extra write to a bucket that is always safe to add to.
  it('pushes as soon as it announces, if the interval already elapsed since boot', async () => {
    let turns = 0;
    const probeReady = vi.fn(async () => {
      turns++;
      return { ready: turns >= 3 }; // silent for the first two turns, then answers
    });
    await runAgentLoop({
      ...deps,
      probeReady,
      pushIntervalMs: 120_000,
      until: () => turns >= 3,
    });
    expect(deps.onPushDue).toHaveBeenCalledTimes(1);
  });

  // §6: RUNNING means "the join point is published". For this game, the only
  // source of that join point is what the probe read from the file.
  it('carries the identifier in the report that announces readiness', async () => {
    let turns = 0;
    await runAgentLoop({
      ...deps,
      probeReady: async () => ({ ready: true, serverId: 'w~1' }),
      until: () => ++turns >= 2,
    });
    const phases = (deps.report as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(phases[0]).toEqual({ phase: 'ready', serverId: 'w~1' });
  });

  // `ready` once and only once: a second would rewrite `stateSince`, and the
  // §6 delays are measured against it. The rule does not change because the
  // report now carries one more value.
  it('announces readiness once, identifier included', async () => {
    let turns = 0;
    await runAgentLoop({
      ...deps,
      probeReady: async () => ({ ready: true, serverId: 'w~1' }),
      until: () => ++turns >= 3,
    });
    const phases = (deps.report as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0].phase);
    expect(phases.filter((phase: string) => phase === 'ready')).toHaveLength(1);
  });

  // The game that publishes an address has no identifier, and the report must
  // not invent one.
  it('reports readiness without an identifier when the probe found none', async () => {
    let turns = 0;
    await runAgentLoop({
      ...deps,
      probeReady: async () => ({ ready: true }),
      until: () => ++turns >= 2,
    });
    const phases = (deps.report as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(phases[0]).toEqual({ phase: 'ready' });
  });
});
