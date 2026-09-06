import { catalogFor, renderCloudInit } from '@beacon/cloud-init';
import {
  publishedAddressOf,
  type Clock,
  type DnsUpdater,
  type DomainEvent,
  type JoinInfo,
  type ServerHost,
  type Session,
} from '@beacon/session';
import type { ServerStateStore, SettingsStore } from '@beacon/session-record';
import { sessionTag } from '@beacon/scaleway-compute';
import type { ProvisioningLedger } from './provisioning-ledger.js';

export interface ProvisionDeps {
  readonly clock: Clock;
  readonly host: ServerHost;
  readonly dns: DnsUpdater;
  readonly state: ServerStateStore;
  readonly settings: SettingsStore;
  readonly ledger: ProvisioningLedger;
  /** From Secret Manager. It never leaves this process except in a cloud-init. */
  readonly serverPassword: () => string;
}

/**
 * The only frontier to the secrets (§6). Two states do something; every other
 * one is a write this function has no business reacting to — including the
 * RUNNING it writes itself, which would otherwise re-enter here.
 *
 * It answers whether a pass has something to do right away, not whether this
 * function acted: a successful teardown already destroyed everything it could
 * find, by tag, and would have thrown otherwise — there is nothing left for a
 * pass to sweep, and asking for one anyway races the provider's still
 * in-flight destruction. Every failure path leaves a resource whose fate a
 * pass still has to settle, so those keep asking.
 */
export async function runStateChange(deps: ProvisionDeps, session: Session): Promise<boolean> {
  if (session.state === 'PROVISIONING') return provision(deps, session);
  if (session.state === 'STOPPING') return tearDown(deps, session);
  return false;
}

async function provision(deps: ProvisionDeps, session: Session): Promise<boolean> {
  const sessionId = session.sessionId;
  const game = session.game;
  if (sessionId === null || game === null) return false;
  const now = deps.clock.now();

  // Nothing before this line spends money, and nothing after it runs twice.
  const claimed = await deps.state.claimProvisioning(sessionId, now);
  if (!claimed) return false;

  const size = session.instanceSize ?? (await deps.settings.read()).defaultInstanceSize;

  // Before the provider, always (§6 étape 4).
  await deps.ledger.open(sessionId, { tag: sessionTag(sessionId), instanceSize: size }, now);

  let opened;
  try {
    opened = await deps.host.open({
      sessionId,
      game,
      size,
      bootstrap: renderCloudInit(game, {
        serverName: 'Beacon',
        serverPassword: deps.serverPassword(),
        slotCount: 4,
      }),
    });
  } catch (error) {
    await failed(deps, sessionId, now, error);
    return true;
  }

  // §5: the intent carries the two ids **and** the address.
  await deps.ledger.record(sessionId, { ...opened.references, ip: opened.address });

  const entry = catalogFor(game);
  const joinInfo = entry.joinInfo(opened.address);
  await announce(deps, sessionId, entry.hostname, joinInfo, now);

  // RUNNING means the join point is published (§4). For this game the function
  // knows it the moment the ip is reserved — the agent that watches the server
  // actually answer arrives with the companion, in tranche 3.
  await deps.state.publish(
    {
      ip: opened.address,
      joinInfo,
      instanceSize: opened.size,
      references: opened.references,
    },
    now,
  );
  return true;
}

/**
 * Point the dns record, when this game has one to point. §8: a failure here
 * does **not** interrupt the session — the interface shows the raw ip, which is
 * precisely the fallback the join point already carries. So it is a fact to
 * file, not a reason to destroy a working machine.
 */
async function announce(
  deps: ProvisionDeps,
  sessionId: string,
  hostname: string | null,
  joinInfo: JoinInfo,
  now: Date,
): Promise<void> {
  const address = publishedAddressOf(joinInfo);
  if (address === null || hostname === null) return;

  try {
    await deps.dns.point(hostname, address);
  } catch (error) {
    await deps.state.apply(
      {
        state: null,
        lastError: `dns update failed: ${String(error)}`,
        clearFacts: false,
        deadline: null,
        closeIntents: [],
        events: [{ type: 'ProvisioningFailed', sessionId, detail: `dns: ${String(error)}` }],
      },
      now,
    );
  }
}

/**
 * An ordinary refusal is not FAILED (§5): clean up, say why, and the button is
 * clickable again. FAILED is kept for the one case it exists for — a cleanup
 * that could not be guaranteed.
 */
async function failed(
  deps: ProvisionDeps,
  sessionId: string,
  now: Date,
  cause: unknown,
): Promise<void> {
  const detail = String(cause);
  try {
    await deps.host.close(sessionId);
  } catch (cleanupError) {
    await deps.state.apply(
      {
        state: 'FAILED',
        lastError: detail,
        clearFacts: false,
        deadline: null,
        closeIntents: [],
        events: [
          { type: 'ProvisioningFailed', sessionId, detail },
          { type: 'CleanupFailed', sessionId, detail: String(cleanupError) },
        ],
      },
      now,
    );
    // The intent stays open on purpose: something may still be billed, and a
    // closed intent is exactly what makes the reconciliation stop looking.
    return;
  }

  await deps.state.apply(
    {
      state: 'IDLE',
      lastError: detail,
      clearFacts: true,
      deadline: null,
      closeIntents: [],
      events: [{ type: 'ProvisioningFailed', sessionId, detail }],
    },
    now,
  );
  await deps.ledger.close(sessionId, now);
}

async function tearDown(deps: ProvisionDeps, session: Session): Promise<boolean> {
  const sessionId = session.sessionId;
  if (sessionId === null) return false;
  const now = deps.clock.now();
  const settings = await deps.settings.read();

  try {
    await deps.host.close(sessionId);
  } catch (error) {
    await deps.state.apply(
      {
        state: 'FAILED',
        lastError: String(error),
        clearFacts: false,
        deadline: null,
        closeIntents: [],
        events: [{ type: 'CleanupFailed', sessionId, detail: String(error) }],
      },
      now,
    );
    return true;
  }

  const stopped: DomainEvent = {
    type: 'SessionStopped',
    sessionId,
    detail: 'stopped on request',
    // §11: the started hour is due. Computed here and not at the deadline,
    // because what is billed is what the machine actually lived.
    costEuros: session.estimatedCost(deps.clock, settings),
  };

  await deps.state.apply(
    {
      state: 'IDLE',
      lastError: null,
      clearFacts: true,
      deadline: null,
      closeIntents: [],
      events: [stopped],
    },
    now,
  );
  await deps.ledger.close(sessionId, now);
  // Not true: the destruction just succeeded, by tag, and threw if it could
  // not — there is nothing left for an immediate pass to find. Tonight's
  // first real session asked for one anyway and it raced `terminate`, still
  // in flight, into a CleanupFailed that lied about a teardown that had
  // already worked.
  return false;
}
