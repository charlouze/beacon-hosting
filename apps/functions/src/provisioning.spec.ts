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
    dns: { point: vi.fn(async () => undefined) },
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
      close: vi.fn(async () => undefined),
      openSessions: vi.fn(async () => []),
    },
    serverPassword: () => 'hunter2',
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

  it('points the record at the address, then publishes the join point', async () => {
    await runStateChange(deps, provisioning());
    expect(deps.dns.point).toHaveBeenCalledWith(
      'enshrouded.beacon.charlouze.com',
      '51.15.42.7',
    );
    expect(deps.state.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        ip: '51.15.42.7',
        instanceSize: 'DEV1-L',
        references: { instanceId: 'srv-1', ipId: 'ip-1' },
      }),
      NOW,
    );
  });

  // §8: dns failing does not interrupt the session — the interface shows the
  // raw ip, which is exactly the fallback the join point already carries.
  it('publishes anyway when dns refuses, and files the incident', async () => {
    deps.dns.point = vi.fn(async () => {
      throw new Error('badauth');
    });
    await runStateChange(deps, provisioning());
    expect(deps.state.publish).toHaveBeenCalled();
    expect(deps.state.apply).toHaveBeenCalledWith(
      expect.objectContaining({
        events: [expect.objectContaining({ type: 'ProvisioningFailed' })],
      }),
      NOW,
    );
  });

  // §5, §8: an ordinary refusal is not FAILED. Clean up, say why, and the
  // button is clickable again immediately.
  it('cleans up and returns to IDLE when the provider refuses', async () => {
    deps.host.open = vi.fn(async () => {
      throw new Error('no capacity');
    });
    await runStateChange(deps, provisioning());
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
    await runStateChange(deps, provisioning());
    expect(deps.state.apply).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'FAILED', clearFacts: false }),
      NOW,
    );
    // The intent stays open: something is still billed, and closing it would
    // hide the resources from the reconciliation that has to find them.
    expect(deps.ledger.close).not.toHaveBeenCalled();
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
    await runStateChange(deps, stopping());
    expect(deps.state.apply).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'FAILED' }),
      NOW,
    );
    // Same invariant as the provisioning side: something may still be billed,
    // and a closed intent is what makes the reconciliation stop looking.
    expect(deps.ledger.close).not.toHaveBeenCalled();
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
