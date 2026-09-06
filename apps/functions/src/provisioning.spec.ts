import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Deadline, DEFAULT_SETTINGS, Session } from '@beacon/session';
import { runStateChange, type ProvisionDeps } from './provisioning.js';

const NOW = new Date('2026-09-06T20:00:00Z');

const provisioning = () =>
  Session.from({
    state: 'PROVISIONING',
    sessionId: 's1',
    game: 'enshrouded',
    startedBy: 'u1',
    startedAt: NOW,
    deadline: Deadline.at(new Date('2026-09-07T00:00:00Z')),
    instanceSize: 'DEV1-L',
    hasJoinInfo: false,
  });

const stopping = () => Session.from({ ...fieldsOf(provisioning()), state: 'STOPPING' });

let deps: ProvisionDeps;

beforeEach(() => {
  deps = {
    clock: { now: () => NOW },
    host: {
      open: vi.fn(async () => ({
        address: '51.15.42.7',
        size: 'DEV1-L',
        references: { instanceId: 'srv-1', ipId: 'ip-1' },
      })),
      close: vi.fn(async () => undefined),
      list: vi.fn(async () => []),
      sweepUnclaimed: vi.fn(async () => ({ destroyed: [], stranded: [], errors: [] })),
    },
    state: {
      claimProvisioning: vi.fn(async () => true),
      publish: vi.fn(async () => undefined),
      apply: vi.fn(async () => undefined),
      read: vi.fn(async () => null),
      readSession: vi.fn(async () => null),
    },
    settings: { read: vi.fn(async () => DEFAULT_SETTINGS) },
    ledger: {
      open: vi.fn(async () => undefined),
      record: vi.fn(async () => undefined),
      read: vi.fn(async () => null),
      close: vi.fn(async () => undefined),
      openSessions: vi.fn(async () => []),
    },
    serverPassword: () => 'hunter2',
    tokens: { issue: vi.fn(async () => undefined), verify: vi.fn(async () => false) },
    agentEndpoint: 'https://europe-west1-beacon.cloudfunctions.net/agentReport',
    saveKeys: () => ({
      endpoint: 'https://s3.fr-par.scw.cloud',
      region: 'fr-par',
      savesBucket: 'beacon-saves',
      gamesBucket: 'beacon-games',
      accessKey: 'SCWXXXXXXXXXXXXXXXXX',
      secretKey: 's3cr3t',
    }),
  };
});

describe('provisioning', () => {
  // §6 étape 3, §8: triggers are delivered at least once. Without the claim, a
  // double delivery creates two billed machines.
  it('does nothing at all when another delivery already claimed it', async () => {
    deps.state.claimProvisioning = vi.fn(async () => false);
    await runStateChange(deps, provisioning());
    expect(deps.ledger.open).not.toHaveBeenCalled();
    expect(deps.host.open).not.toHaveBeenCalled();
  });

  // The order that protects the budget: the intent exists before anything is
  // billed, so a crash right after `open()` still leaves something to reap.
  it('writes the intent before it calls the provider', async () => {
    const order: string[] = [];
    deps.ledger.open = vi.fn(async () => void order.push('intent'));
    deps.host.open = vi.fn(async () => {
      order.push('provider');
      return { address: '51.15.42.7', size: 'DEV1-L', references: { instanceId: 'srv-1', ipId: 'ip-1' } };
    });
    await runStateChange(deps, provisioning());
    expect(order).toEqual(['intent', 'provider']);
  });

  it('hands the provider the cloud-init the catalogue rendered', async () => {
    await runStateChange(deps, provisioning());
    const request = (deps.host.open as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(request.bootstrap).toContain('#cloud-config');
    expect(request.bootstrap).toContain('SERVER_PASSWORD=hunter2');
    expect(request.sessionId).toBe('s1');
    expect(request.size).toBe('DEV1-L');
  });

  // The heart of this tranche. RUNNING means the join point is published, and
  // §6 makes the agent the one who knows it — the function knew only that an ip
  // had been reserved, which is why RUNNING lied for five to eight minutes.
  it('leaves the state in PROVISIONING, and publishes nothing', async () => {
    await runStateChange(deps, provisioning());
    expect(deps.state.publish).not.toHaveBeenCalled();
  });

  // §6 étape 4: the token is issued in the same breath as the intent, before
  // anything is created. A machine that booted before its token existed would
  // report into a 401 and never be able to say it is ready.
  it('issues the session token before it calls the provider', async () => {
    const order: string[] = [];
    deps.tokens.issue = vi.fn(async () => void order.push('token'));
    deps.ledger.open = vi.fn(async () => void order.push('intent'));
    deps.host.open = vi.fn(async () => {
      order.push('provider');
      return {
        address: '51.15.42.7',
        size: 'DEV1-L',
        references: { instanceId: 'srv-1', ipId: 'ip-1' },
      };
    });
    await runStateChange(deps, provisioning());
    expect(order).toEqual(['token', 'intent', 'provider']);
  });

  it('hands the machine a token, and never the same one twice', async () => {
    await runStateChange(deps, provisioning());
    const first = (deps.host.open as ReturnType<typeof vi.fn>).mock.calls[0][0].bootstrap;
    expect(first).toMatch(/BEACON_TOKEN=[0-9a-f]{64}/);

    await runStateChange(deps, provisioning());
    const second = (deps.host.open as ReturnType<typeof vi.fn>).mock.calls[1][0].bootstrap;
    expect(tokenIn(second)).not.toBe(tokenIn(first));
  });

  // The crux of this tranche: the token the control plane holds and the token
  // the machine boots with must be the same value. An implementation that
  // issued one token and sowed another would leave every other test here
  // green, and the machine's first report would meet a 401 it can never
  // recover from — twenty-five minutes in PROVISIONING for nothing.
  it('issues the very token it sows, not merely a token', async () => {
    await runStateChange(deps, provisioning());
    const bootstrap = (deps.host.open as ReturnType<typeof vi.fn>).mock.calls[0][0].bootstrap;
    expect(deps.tokens.issue).toHaveBeenCalledWith('s1', tokenIn(bootstrap), NOW);
  });

  // The intent still carries what the provider answered — the watchdog compares
  // against it, and agentReport publishes from it.
  it('records what the provider answered, address included', async () => {
    await runStateChange(deps, provisioning());
    expect(deps.ledger.record).toHaveBeenCalledWith('s1', {
      instanceId: 'srv-1',
      ipId: 'ip-1',
      ip: '51.15.42.7',
    });
  });

  // §5, §8: an ordinary refusal is not FAILED. Clean up, say why, and the
  // button is clickable again immediately.
  it('cleans up and returns to IDLE when the provider refuses', async () => {
    deps.host.open = vi.fn(async () => {
      throw new Error('no capacity');
    });
    // Precisely where a pass has work to do: a boot that failed is retried at
    // once rather than waiting out the schedule.
    expect(await runStateChange(deps, provisioning())).toBe(true);
    expect(deps.host.close).toHaveBeenCalledWith('s1');
    expect(deps.state.apply).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'IDLE', clearFacts: true }),
      NOW,
    );
    expect(deps.ledger.close).toHaveBeenCalledWith('s1', NOW);
  });

  // FAILED is for exactly one case: a cleanup that could not be guaranteed.
  it('goes to FAILED when the cleanup itself fails', async () => {
    deps.host.open = vi.fn(async () => {
      throw new Error('no capacity');
    });
    deps.host.close = vi.fn(async () => {
      throw new Error('api unreachable');
    });
    // A cleanup that could not be guaranteed is exactly when a pass must run
    // again — the resource may still be billed, and nothing else will retry.
    expect(await runStateChange(deps, provisioning())).toBe(true);
    expect(deps.state.apply).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'FAILED', clearFacts: false }),
      NOW,
    );
    // The intent stays open: something is still billed, and closing it would
    // hide the resources from the reconciliation that has to find them.
    expect(deps.ledger.close).not.toHaveBeenCalled();
  });

  // `server/current.lastError` is read by every member's browser, live —
  // nothing proves the provider's SDK keeps a cloud-init's secret out of an
  // error's text.
  describe('what reaches the client-readable field', () => {
    const secret = 'a'.repeat(64);

    it('redacts anything long enough to be a credential out of lastError', async () => {
      deps.host.open = vi.fn(async () => {
        throw new Error(`user data rejected: BEACON_TOKEN=${secret}`);
      });
      await runStateChange(deps, provisioning());
      const applied = (deps.state.apply as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(applied.lastError).not.toContain(secret);
      expect(applied.lastError).toContain('[redacted]');
    });

    it('keeps the full detail in the journalled event', async () => {
      deps.host.open = vi.fn(async () => {
        throw new Error(`user data rejected: BEACON_TOKEN=${secret}`);
      });
      await runStateChange(deps, provisioning());
      const applied = (deps.state.apply as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(applied.events[0].detail).toContain(secret);
    });

    it('truncates a very long lastError', async () => {
      deps.host.open = vi.fn(async () => {
        throw new Error('refused '.repeat(200));
      });
      await runStateChange(deps, provisioning());
      const applied = (deps.state.apply as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(applied.lastError.length).toBeLessThan(600);
    });

    it('sanitises lastError on a failed teardown too', async () => {
      deps.host.close = vi.fn(async () => {
        throw new Error(`could not destroy: BEACON_TOKEN=${secret}`);
      });
      await runStateChange(deps, stopping());
      const applied = (deps.state.apply as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(applied.lastError).not.toContain(secret);
    });
  });
});

describe('stopping', () => {
  it('destroys, returns to IDLE, and hangs the cost on the audit line', async () => {
    await runStateChange(deps, stopping());
    expect(deps.host.close).toHaveBeenCalledWith('s1');
    expect(deps.state.apply).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'IDLE',
        clearFacts: true,
        events: [expect.objectContaining({ type: 'SessionStopped', costEuros: 0.05 })],
      }),
      NOW,
    );
    expect(deps.ledger.close).toHaveBeenCalledWith('s1', NOW);
  });

  it('goes to FAILED when the destruction is refused', async () => {
    deps.host.close = vi.fn(async () => {
      throw new Error('refused');
    });
    // Same reason as the provisioning side: a cleanup that could not be
    // guaranteed is exactly when a pass has work to do.
    expect(await runStateChange(deps, stopping())).toBe(true);
    expect(deps.state.apply).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'FAILED' }),
      NOW,
    );
    // Same invariant as the provisioning side: something may still be billed,
    // and a closed intent is what makes the reconciliation stop looking.
    expect(deps.ledger.close).not.toHaveBeenCalled();
  });
});

describe('what the caller learns', () => {
  it('says it acted when it provisioned', async () => {
    expect(await runStateChange(deps, provisioning())).toBe(true);
  });

  // A clean teardown already destroyed everything by tag, and would have
  // thrown otherwise — nothing is left for an immediate pass to find, and
  // asking for one anyway is what raced `terminate`, still in flight, into a
  // CleanupFailed on the first real session.
  it('asks for no immediate pass when it destroyed cleanly', async () => {
    expect(await runStateChange(deps, stopping())).toBe(false);
  });

  // A double delivery claimed by someone else did nothing, so there is nothing
  // for a pass to look at either.
  it('says it did not act when another delivery had claimed it', async () => {
    deps.state.claimProvisioning = vi.fn(async () => false);
    expect(await runStateChange(deps, provisioning())).toBe(false);
  });

  // What bounds the loop: a pass writes IDLE, FAILED or RUNNING, and none of
  // the three is a state this function acts on — so the trigger it fires dies
  // here instead of asking for another pass.
  it.each(['IDLE', 'RUNNING', 'FAILED'] as const)('says it did not act on %s', async (state) => {
    expect(
      await runStateChange(deps, Session.from({ ...fieldsOf(provisioning()), state })),
    ).toBe(false);
  });
});

describe('every other state', () => {
  it.each(['IDLE', 'RUNNING', 'FAILED'] as const)('does nothing on %s', async (state) => {
    await runStateChange(deps, Session.from({ ...fieldsOf(provisioning()), state }));
    expect(deps.host.open).not.toHaveBeenCalled();
    expect(deps.host.close).not.toHaveBeenCalled();
  });
});

/**
 * `Session` keeps its fields private, so a test that needs a variant rebuilds
 * them. Kept here and not exposed on the class: opening a domain object's
 * insides for a test's convenience is how an aggregate becomes a data bag.
 */
const fieldsOf = (session: Session) => ({
  sessionId: session.sessionId as string,
  game: session.game as 'enshrouded',
  startedBy: session.startedBy,
  startedAt: NOW,
  deadline: session.deadline,
  instanceSize: session.instanceSize,
  hasJoinInfo: false,
});

const tokenIn = (bootstrap: string): string =>
  /BEACON_TOKEN=([0-9a-f]{64})/.exec(bootstrap)?.[1] ?? '';
