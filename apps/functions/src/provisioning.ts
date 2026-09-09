import { renderCloudInit, type SaveAccess } from '@beacon/cloud-init';
import { newAgentToken } from '@beacon/agent-protocol';
import type { AdminMembershipRecord } from '@beacon/membership-record/admin';
import type { Clock, ServerHost, Session } from '@beacon/session';
import type { ServerStateStore, SettingsStore } from '@beacon/session-record';
import { sessionTag } from '@beacon/scaleway-compute';
import type { AgentTokens } from './agent-tokens.js';
import type { ProvisioningLedger } from './provisioning-ledger.js';
import { sanitizeLastError } from './sanitize-last-error.js';

export interface ProvisionDeps {
  readonly clock: Clock;
  readonly host: ServerHost;
  readonly state: ServerStateStore;
  readonly settings: SettingsStore;
  readonly ledger: ProvisioningLedger;
  /** From Secret Manager. It never leaves this process except in a cloud-init. */
  readonly serverPassword: () => string;
  /** The Steam accounts the members declared (§5). `members` says, nobody else. */
  readonly members: AdminMembershipRecord;
  readonly tokens: AgentTokens;
  /** Where the machine reports. A deployed value, never compiled in. */
  readonly agentEndpoint: string;
  /** From Secret Manager. It never leaves this process except in a cloud-init. */
  readonly saveKeys: () => SaveAccess;
}

/**
 * The only frontier to the secrets (§6). One state does something; every
 * other one is a write this function has no business reacting to — including
 * the RUNNING that `agentReport` writes, which would otherwise re-enter here.
 *
 * **STOPPING triggers nothing here (task 9 bis).** It used to destroy on
 * sight — the instant the browser or the watchdog wrote STOPPING, before the
 * agent had a chance to learn it was stopping at all. §6 now makes the
 * agent's `saved` report the one trigger of the destruction: it runs from
 * `agentReport` (agent-report.ts), once the game has stopped and the last
 * save is pushed. This branch stays absent on purpose — adding it back
 * un-fixes the bug this task exists for.
 */
export async function runStateChange(deps: ProvisionDeps, session: Session): Promise<boolean> {
  if (session.state === 'PROVISIONING') return provision(deps, session);
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
    // Inside the try on purpose: a register that cannot be read is an ordinary
    // refusal like any other, and the cleanup below is what closes the intent
    // this function has already opened. Thrown from above it, the session would
    // stay claimed in PROVISIONING with nothing left to retry it.
    // The seam between the two vocabularies, and the only line that crosses it:
    // what `members` holds is a list of declared Steam accounts, what the game
    // is handed is its `-adminSteamIDs`. §2 makes the two the same list — every
    // member administers the server in the game, whatever their Beacon role —
    // and §4 forbids confusing the words that name them. Nothing downstream
    // needs to know a role exists at all.
    const declaredSteamIds = await deps.members.declaredSteamIds();
    opened = await deps.host.open({
      sessionId,
      game,
      size,
      bootstrap: renderCloudInit(game, {
        serverName: 'Beacon',
        serverPassword: deps.serverPassword(),
        slotCount: 4,
        adminSteamIds: declaredSteamIds,
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
