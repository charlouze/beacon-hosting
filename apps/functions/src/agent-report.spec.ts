import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Deadline, DEFAULT_SETTINGS, Session, type Game } from '@beacon/session';
import { runAgentReport, type AgentReportDeps } from './agent-report.js';

/**
 * The catalogue is imported and not injected: game knowledge lives there and
 * nowhere else (§4). All this function does with a refusal is *notice* it, so
 * the refusing entry is doubled here rather than borrowed from a real game —
 * what makes a real entry refuse is a world guid, and pinning that guid twice
 * is how two places end up disagreeing about the same value. The entry that
 * actually decides is tested in `cloud-init`.
 */
vi.mock('@beacon/cloud-init', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@beacon/cloud-init')>();
  const refusesEverything = {
    game: 'sunkenland',
    hostname: null,
    compose: () => '',
    render: () => '',
    joinInfo: () => null,
  };
  return {
    ...actual,
    catalogFor: (game: Game) =>
      game === 'sunkenland' ? refusesEverything : actual.catalogFor(game),
  };
});

const NOW = new Date('2026-09-06T20:10:00Z');
const TOKEN = 'a'.repeat(64);

const sessionIn = (state: 'PROVISIONING' | 'RUNNING' | 'STOPPING') =>
  Session.from({
    state,
    sessionId: 's1',
    game: 'enshrouded',
    startedBy: 'u1',
    startedAt: new Date('2026-09-06T20:00:00Z'),
    deadline: Deadline.at(new Date('2026-09-07T00:00:00Z')),
    instanceSize: 'DEV1-L',
    hasJoinInfo: false,
  });

let deps: AgentReportDeps;

beforeEach(() => {
  deps = {
    clock: { now: () => NOW },
    tokens: {
      issue: vi.fn(async () => undefined),
      verify: vi.fn(async () => true),
    },
    state: {
      readSession: vi.fn(async () => sessionIn('PROVISIONING')),
      publish: vi.fn(async () => undefined),
      apply: vi.fn(async () => undefined),
      read: vi.fn(async () => null),
      claimProvisioning: vi.fn(async () => false),
    },
    settings: { read: vi.fn(async () => DEFAULT_SETTINGS) },
    ledger: {
      open: vi.fn(async () => undefined),
      record: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
      openSessions: vi.fn(async () => []),
      read: vi.fn(async () => ({
        instanceId: 'srv-1',
        ipId: 'ip-1',
        ip: '51.15.42.7',
        instanceSize: 'DEV1-L',
      })),
    },
    saves: { record: vi.fn(async () => undefined) },
    dns: { point: vi.fn(async () => undefined) },
    host: {
      open: vi.fn(),
      close: vi.fn(async () => undefined),
      list: vi.fn(async () => []),
      sweepUnclaimed: vi.fn(async () => ({ destroyed: [], stranded: [], errors: [] })),
    },
  };
});

describe('agentReport', () => {
  // The whole barrier. Without it, anyone on the internet writes RUNNING.
  it('answers nothing at all when the token does not verify', async () => {
    deps.tokens.verify = vi.fn(async () => false);
    const answer = await runAgentReport(deps, TOKEN, {
      sessionId: 's1',
      phase: 'ready',
    });
    expect(answer).toBeNull();
    expect(deps.state.publish).not.toHaveBeenCalled();
  });

  // §6 étape 7: the join point is published, and *this* is what RUNNING means.
  it('publishes the join point from what the ledger reserved', async () => {
    await runAgentReport(deps, TOKEN, { sessionId: 's1', phase: 'ready' });
    expect(deps.state.publish).toHaveBeenCalledWith(
      {
        ip: '51.15.42.7',
        joinInfo: {
          game: 'enshrouded',
          hostname: 'enshrouded.beacon.charlouze.com',
          address: '51.15.42.7',
          port: 15637,
        },
        instanceSize: 'DEV1-L',
        references: { instanceId: 'srv-1', ipId: 'ip-1' },
      },
      NOW,
    );
  });

  it('points the dns record before it publishes', async () => {
    const order: string[] = [];
    deps.dns.point = vi.fn(async () => void order.push('dns'));
    deps.state.publish = vi.fn(async () => void order.push('publish'));
    await runAgentReport(deps, TOKEN, { sessionId: 's1', phase: 'ready' });
    expect(order).toEqual(['dns', 'publish']);
  });

  // §8: a dns failure does not interrupt the session — the join point already
  // carries the raw address, and the first real session was played through it.
  it('publishes anyway when dns refuses, and files the right event', async () => {
    deps.dns.point = vi.fn(async () => {
      throw new Error('http 404');
    });
    await runAgentReport(deps, TOKEN, { sessionId: 's1', phase: 'ready' });
    expect(deps.state.publish).toHaveBeenCalled();
    const correction = (deps.state.apply as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(correction.events[0].type).toBe('DnsUpdateFailed');
    expect(correction.state).toBeNull();
  });

  // §6, §7: the machine is the least trusted element of the system. Its address
  // corroborates and is never followed — otherwise a compromised vm aims the
  // dns record wherever it likes.
  it('follows the reserved address and not the reported one, and says so', async () => {
    await runAgentReport(deps, TOKEN, {
      sessionId: 's1',
      phase: 'ready',
      ip: '10.0.0.1',
    });
    expect(deps.dns.point).toHaveBeenCalledWith(
      'enshrouded.beacon.charlouze.com',
      '51.15.42.7',
    );
    const correction = (deps.state.apply as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(correction.events[0].type).toBe('AgentContradicted');
  });

  // §6 étape 7: RUNNING means "the join point is published". When the catalogue
  // cannot build one there is nothing to publish — and the session dies of the
  // provisioning delay, which already exists and covers exactly this case. A
  // second path to death would buy nothing.
  it('publishes nothing when the catalogue refuses what the machine declared', async () => {
    deps.state.readSession = vi.fn(async () =>
      Session.from({ ...fieldsOf(sessionIn('PROVISIONING')), game: 'sunkenland' }),
    );
    await runAgentReport(deps, TOKEN, {
      sessionId: 's1',
      phase: 'ready',
      serverId: 'forged',
    });
    expect(deps.state.publish).not.toHaveBeenCalled();
    const correction = (deps.state.apply as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(correction.events[0].type).toBe('AgentContradicted');
    // The audit line, and nothing else: `stateSince` stays where it is, so the
    // provisioning delay keeps counting from the boot and not from this report.
    expect(correction.state).toBeNull();
  });

  // The path that already existed, unchanged: an entry that yields a join point
  // publishes RUNNING as before.
  it('still publishes for a game whose join point comes from the address', async () => {
    await runAgentReport(deps, TOKEN, {
      sessionId: 's1',
      phase: 'ready',
      ip: '51.15.42.7',
    });
    expect(deps.state.publish).toHaveBeenCalled();
  });

  // A ready that arrives after the world moved on. Publishing here would put a
  // join point on a session that is not the one running.
  it('publishes nothing when the current session is another one', async () => {
    deps.state.readSession = vi.fn(async () =>
      Session.from({ ...fieldsOf(sessionIn('RUNNING')), sessionId: 's2' }),
    );
    const answer = await runAgentReport(deps, TOKEN, {
      sessionId: 's1',
      phase: 'ready',
    });
    expect(deps.state.publish).not.toHaveBeenCalled();
    // And it is told to stop, rather than being left to run: a machine whose
    // session is over has nothing left to do.
    expect(answer).toEqual({ state: 'IDLE', deadlineIso: null });
  });

  it('records a deposit the machine reports', async () => {
    await runAgentReport(deps, TOKEN, {
      sessionId: 's1',
      phase: 'saved',
      save: {
        objectKey: 'saves/enshrouded/auto/s1/2026-09-06T20-10-00Z.tar.gz',
        sizeBytes: 50_000,
        origin: 'auto',
      },
    });
    const recorded = (deps.saves.record as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(recorded.objectKey).toBe(
      'saves/enshrouded/auto/s1/2026-09-06T20-10-00Z.tar.gz',
    );
    expect(recorded.sizeBytes).toBe(50_000);
  });

  // §8, third defense, and the last of the three. The real protection is on the
  // machine; this one exists so that a companion that lost its own guard cannot
  // put an implausible save on the list a human restores from.
  it('refuses a deposit under the floor, and journals the refusal', async () => {
    await runAgentReport(deps, TOKEN, {
      sessionId: 's1',
      phase: 'saved',
      save: {
        objectKey: 'saves/enshrouded/auto/s1/x.tar.gz',
        sizeBytes: 12,
        origin: 'auto',
      },
    });
    expect(deps.saves.record).not.toHaveBeenCalled();
    const correction = (deps.state.apply as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(correction.events[0].type).toBe('SaveRefused');
  });

  // A valid token only proves the machine belongs to this session — nothing
  // about which key it may name. Without this, that token could register a
  // document pointing at another session's archive, and `game` — taken from
  // this session, not from the key — would vouch for it.
  it('refuses a deposit whose key names another session, and journals the refusal', async () => {
    await runAgentReport(deps, TOKEN, {
      sessionId: 's1',
      phase: 'saved',
      save: {
        objectKey: 'saves/enshrouded/auto/s2/2026-09-06T20-10-00Z.tar.gz',
        sizeBytes: 50_000,
        origin: 'auto',
      },
    });
    expect(deps.saves.record).not.toHaveBeenCalled();
    const correction = (deps.state.apply as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(correction.events[0].type).toBe('SaveRefused');
  });

  it('refuses a deposit whose key names another game, and journals the refusal', async () => {
    await runAgentReport(deps, TOKEN, {
      sessionId: 's1',
      phase: 'saved',
      save: {
        objectKey: 'saves/sunkenland/auto/s1/2026-09-06T20-10-00Z.tar.gz',
        sizeBytes: 50_000,
        origin: 'auto',
      },
    });
    expect(deps.saves.record).not.toHaveBeenCalled();
    const correction = (deps.state.apply as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(correction.events[0].type).toBe('SaveRefused');
  });

  // Pinned exactly as `keys.spec.ts` pins the whole key: this is the second
  // place that recognises `objectKeyFor`'s format, and the two must not drift
  // apart silently. A session id that is merely a *prefix* of the real one —
  // `s1` inside `s10` — must not pass a check that forgets the trailing slash.
  it('refuses a key whose session id only resembles its own, and records the honest one', async () => {
    await runAgentReport(deps, TOKEN, {
      sessionId: 's1',
      phase: 'saved',
      save: {
        objectKey: 'saves/enshrouded/auto/s10/2026-09-06T20-10-00Z.tar.gz',
        sizeBytes: 50_000,
        origin: 'auto',
      },
    });
    expect(deps.saves.record).not.toHaveBeenCalled();

    await runAgentReport(deps, TOKEN, {
      sessionId: 's1',
      phase: 'saved',
      save: {
        objectKey: 'saves/enshrouded/auto/s1/2026-09-06T20-10-00Z.tar.gz',
        sizeBytes: 50_000,
        origin: 'auto',
      },
    });
    expect(deps.saves.record).toHaveBeenCalled();
  });

  // §6: the deadline rides on every answer, which is what makes "the agent
  // learns an extension in under a minute" a property of the protocol.
  it('answers the state and the closing time on a plain heartbeat', async () => {
    deps.state.readSession = vi.fn(async () => sessionIn('RUNNING'));
    const answer = await runAgentReport(deps, TOKEN, {
      sessionId: 's1',
      phase: 'alive',
    });
    expect(answer).toEqual({
      state: 'RUNNING',
      deadlineIso: '2026-09-07T00:00:00.000Z',
    });
  });

  // §4: the bound is applied on read, the same way the screen applies it. The
  // agent must not be told a closing time the watchdog is about to pull back.
  it('answers a forged closing time already brought back to the bound', async () => {
    deps.state.readSession = vi.fn(async () =>
      Session.from({
        ...fieldsOf(sessionIn('RUNNING')),
        deadline: Deadline.at(new Date('2026-09-08T00:00:00Z')),
      }),
    );
    const answer = await runAgentReport(deps, TOKEN, {
      sessionId: 's1',
      phase: 'alive',
    });
    expect(answer?.deadlineIso).toBe('2026-09-07T00:10:00.000Z');
  });

  it('tells a machine to stop as soon as the state says STOPPING', async () => {
    deps.state.readSession = vi.fn(async () => sessionIn('STOPPING'));
    const answer = await runAgentReport(deps, TOKEN, {
      sessionId: 's1',
      phase: 'alive',
    });
    expect(answer?.state).toBe('STOPPING');
  });

  // §6 étape 3, and the whole point of task 9 bis: the final save is the only
  // trigger destruction waits for — the machine has stopped the game and
  // pushed it by the time it reports this. The save is recorded first: the
  // destruction is one more consequence of the deposit, never a replacement
  // for it (brief bullet 4, review finding 5).
  it('records the save, then destroys the instance and the ip, once the final save is reported on a STOPPING session', async () => {
    deps.state.readSession = vi.fn(async () => sessionIn('STOPPING'));
    const order: string[] = [];
    deps.saves.record = vi.fn(async () => void order.push('record'));
    deps.host.close = vi.fn(async () => void order.push('destroy'));
    await runAgentReport(deps, TOKEN, {
      sessionId: 's1',
      phase: 'saved',
      save: {
        objectKey: 'saves/enshrouded/pre-shutdown/s1/2026-09-06T20-10-00Z.tar.gz',
        sizeBytes: 50_000,
        origin: 'pre-shutdown',
      },
    });
    expect(order).toEqual(['record', 'destroy']);
    expect(deps.host.close).toHaveBeenCalledWith('s1');
    const correction = (deps.state.apply as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(correction.state).toBe('IDLE');
    expect(correction.clearFacts).toBe(true);
    expect(correction.events[0].type).toBe('SessionStopped');
    expect(deps.ledger.close).toHaveBeenCalledWith('s1', NOW);
  });

  // Review finding: idempotence through `ServerHost.close()` covers the
  // *state* both destroyers compute, never the *audit* — each would otherwise
  // file its own `SessionStopped` carrying `costEuros`, and §11 sums that
  // field twice for one stop. This is the window closing: the
  // stopping-timeout net gets there first — `server/current` is no longer
  // STOPPING for this session by the time the re-read runs — and this call
  // has nothing left to record.
  it('destroys the machine but records nothing when the stopping-timeout net already moved the session on', async () => {
    deps.state.readSession = vi
      .fn()
      .mockResolvedValueOnce(sessionIn('STOPPING'))
      .mockResolvedValueOnce(Session.idle());
    await runAgentReport(deps, TOKEN, {
      sessionId: 's1',
      phase: 'saved',
      save: {
        objectKey: 'saves/enshrouded/pre-shutdown/s1/2026-09-06T20-10-00Z.tar.gz',
        sizeBytes: 50_000,
        origin: 'pre-shutdown',
      },
    });
    expect(deps.host.close).toHaveBeenCalledWith('s1');
    expect(deps.state.apply).not.toHaveBeenCalled();
    expect(deps.ledger.close).not.toHaveBeenCalled();
  });

  // The most important test of this task. The cadence push reports `saved`
  // every ten minutes of ordinary play — confusing it with the last one would
  // kill the machine mid-game, every session.
  it('destroys nothing when a saved report arrives while RUNNING', async () => {
    deps.state.readSession = vi.fn(async () => sessionIn('RUNNING'));
    await runAgentReport(deps, TOKEN, {
      sessionId: 's1',
      phase: 'saved',
      save: {
        objectKey: 'saves/enshrouded/auto/s1/2026-09-06T20-10-00Z.tar.gz',
        sizeBytes: 50_000,
        origin: 'auto',
      },
    });
    expect(deps.host.close).not.toHaveBeenCalled();
    expect(deps.saves.record).toHaveBeenCalled();
  });

  // Review finding 1, spec fix ed130a8: the agent loop is sequential, so a
  // cadence push can be mid-flight — archived and uploaded — the instant a
  // stop is requested, and it reports `saved` with origin `auto` after
  // STOPPING has already been written. Destroying on it would skip §6 étape 2
  // entirely: the game never stopped, the final save never pushed, and
  // `pre-shutdown` naming nothing. The ten-minute stopping-timeout net still
  // covers a final save that never arrives at all.
  it('destroys nothing when an in-flight cadence save reports saved on a STOPPING session', async () => {
    deps.state.readSession = vi.fn(async () => sessionIn('STOPPING'));
    await runAgentReport(deps, TOKEN, {
      sessionId: 's1',
      phase: 'saved',
      save: {
        objectKey: 'saves/enshrouded/auto/s1/2026-09-06T20-10-00Z.tar.gz',
        sizeBytes: 50_000,
        origin: 'auto',
      },
    });
    expect(deps.host.close).not.toHaveBeenCalled();
    expect(deps.saves.record).toHaveBeenCalled();
  });

  // Moved here with the destruction it guards: `server/current.lastError` is
  // read by every member's browser, live, and nothing proves the provider's
  // SDK keeps a secret out of an error's text.
  it('sanitises lastError when the destruction itself is refused', async () => {
    deps.state.readSession = vi.fn(async () => sessionIn('STOPPING'));
    const secret = 'a'.repeat(64);
    deps.host.close = vi.fn(async () => {
      throw new Error(`could not destroy: BEACON_TOKEN=${secret}`);
    });
    await runAgentReport(deps, TOKEN, {
      sessionId: 's1',
      phase: 'saved',
      save: {
        objectKey: 'saves/enshrouded/pre-shutdown/s1/2026-09-06T20-10-00Z.tar.gz',
        sizeBytes: 50_000,
        origin: 'pre-shutdown',
      },
    });
    const correction = (deps.state.apply as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(correction.state).toBe('FAILED');
    expect(correction.lastError).not.toContain(secret);
  });

  // As stale as any other report about a session that has moved on — the
  // session-equality guard above answers for it before destruction is ever a
  // question.
  it('destroys nothing when a saved report names a session that is not the current one', async () => {
    deps.state.readSession = vi.fn(async () =>
      Session.from({ ...fieldsOf(sessionIn('STOPPING')), sessionId: 's2' }),
    );
    const answer = await runAgentReport(deps, TOKEN, {
      sessionId: 's1',
      phase: 'saved',
      save: {
        objectKey: 'saves/enshrouded/pre-shutdown/s1/2026-09-06T20-10-00Z.tar.gz',
        sizeBytes: 50_000,
        origin: 'pre-shutdown',
      },
    });
    expect(deps.host.close).not.toHaveBeenCalled();
    expect(deps.saves.record).not.toHaveBeenCalled();
    expect(answer).toEqual({ state: 'IDLE', deadlineIso: null });
  });

  // The default session in `deps` is PROVISIONING: a `failed` reported before
  // the machine ever became RUNNING genuinely is a provisioning failure.
  it('files what the machine says went wrong, while it is still provisioning', async () => {
    await runAgentReport(deps, TOKEN, {
      sessionId: 's1',
      phase: 'failed',
      detail: 'restore refused: the bucket did not answer',
    });
    const correction = (deps.state.apply as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(correction.events[0]).toEqual({
      type: 'ProvisioningFailed',
      sessionId: 's1',
      detail: 'restore refused: the bucket did not answer',
    });
    // Not FAILED, and not IDLE. §5 keeps FAILED for a cleanup that could not be
    // guaranteed; here nothing has been destroyed and nothing has been tried.
    // The provisioning delay of §6 is what ends this session, and it destroys.
    expect(correction.state).toBeNull();
  });

  // §6 repair, again: a session already RUNNING did not fail to *provision* —
  // a crashed game process or a failed push reported mid-session must not be
  // journalled as the dishonesty `DnsUpdateFailed`'s comment already names.
  it('files an operational failure, not a provisioning one, once the machine is running', async () => {
    deps.state.readSession = vi.fn(async () => sessionIn('RUNNING'));
    await runAgentReport(deps, TOKEN, {
      sessionId: 's1',
      phase: 'failed',
      detail: 'the game process crashed',
    });
    const correction = (deps.state.apply as ReturnType<typeof vi.fn>).mock
      .calls[0][0];
    expect(correction.events[0]).toEqual({
      type: 'AgentReportedFailure',
      sessionId: 's1',
      detail: 'the game process crashed',
    });
    expect(correction.state).toBeNull();
  });
});

/** The aggregate exposes no field bag; this rebuilds one for the variants above. */
function fieldsOf(session: Session) {
  return {
    state: session.state,
    sessionId: session.sessionId as string,
    game: session.game as Game,
    startedBy: session.startedBy,
    startedAt: new Date('2026-09-06T20:00:00Z'),
    deadline: session.deadline,
    instanceSize: session.instanceSize,
    hasJoinInfo: false,
  };
}
