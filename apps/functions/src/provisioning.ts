import { renderCloudInit, type SaveAccess } from '@beacon/cloud-init';
import { newAgentToken } from '@beacon/agent-protocol';
import type {
  Clock,
  DomainEvent,
  ServerHost,
  Session,
} from '@beacon/session';
import type { ServerStateStore, SettingsStore } from '@beacon/session-record';
import { sessionTag } from '@beacon/scaleway-compute';
import type { AgentTokens } from './agent-tokens.js';
import type { ProvisioningLedger } from './provisioning-ledger.js';

export interface ProvisionDeps {
  readonly clock: Clock;
  readonly host: ServerHost;
  readonly state: ServerStateStore;
  readonly settings: SettingsStore;
  readonly ledger: ProvisioningLedger;
  /** From Secret Manager. It never leaves this process except in a cloud-init. */
  readonly serverPassword: () => string;
  readonly tokens: AgentTokens;
  /** Where the machine reports. A deployed value, never compiled in. */
  readonly agentEndpoint: string;
  /** From Secret Manager. It never leaves this process except in a cloud-init. */
  readonly saveKeys: () => SaveAccess;
}

/**
 * The only frontier to the secrets (§6). Two states do something; every other
 * one is a write this function has no business reacting to — including the
 * RUNNING that `agentReport` writes, which would otherwise re-enter here.
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

  // §6 étape 4: both documents in strict create, before the provider. A
  // sessionId already seen fails here, which is what closes the reuse of an id
  // a browser drew (§5).
  const agentToken = newAgentToken();
  await deps.tokens.issue(sessionId, agentToken, now);

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
        sessionId,
        agentToken,
        endpoint: deps.agentEndpoint,
        saves: deps.saveKeys(),
      }),
    });
  } catch (error) {
    await failed(deps, sessionId, now, error);
    return true;
  }

  // §5: the intent carries the two ids **and** the address.
  await deps.ledger.record(sessionId, { ...opened.references, ip: opened.address });
  return true;
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
        lastError: sanitizeLastError(detail),
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
      lastError: sanitizeLastError(detail),
      clearFacts: true,
      deadline: null,
      closeIntents: [],
      events: [{ type: 'ProvisioningFailed', sessionId, detail }],
    },
    now,
  );
  await deps.ledger.close(sessionId, now);
}

const MAX_LAST_ERROR_LENGTH = 500;

/**
 * `server/current.lastError` is read by every member's browser, live. The
 * failure it summarises can carry the cloud-init in its text — nothing
 * proves the provider's SDK keeps the agent token or the S3 secret key out of
 * an error message — so this is the one gate between an internal failure and
 * a client-readable field. `events` above keeps the full, un-sanitised
 * `detail`: only this field is bounded and scrubbed.
 */
function sanitizeLastError(detail: string): string {
  const scrubbed = detail.replace(/[A-Za-z0-9+/_=-]{20,}/g, '[redacted]');
  return scrubbed.length > MAX_LAST_ERROR_LENGTH
    ? `${scrubbed.slice(0, MAX_LAST_ERROR_LENGTH)}…`
    : scrubbed;
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
        lastError: sanitizeLastError(String(error)),
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
