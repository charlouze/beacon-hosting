import type { DomainEvent, ServerHost, SessionId, WorldId } from '@beacon/session';
import type { WorldStateStores } from '@beacon/session-record';
import { expunged, type FailureSource, type PlatformJournal } from './platform-journal.js';
import type { ProvisioningLedger } from './provisioning-ledger.js';

export interface AbandonDeps {
  readonly host: ServerHost;
  readonly states: WorldStateStores;
  readonly ledger: ProvisioningLedger;
  readonly journal: PlatformJournal;
}

export interface Abandonment {
  readonly worldId: WorldId;
  readonly sessionId: SessionId;
  /** What the `ProvisioningFailed` event says. Every user reads it. */
  readonly detail: string;
  /**
   * What the host answered when the abandon is its own refusal of the opening,
   * already expunged, and null otherwise. It is what `lastError` then keeps.
   */
  readonly hostRefusal: string | null;
  /** Where a refused close is journalled from. */
  readonly cleanupSource: FailureSource;
}

/**
 * A setup that will not finish: close its server, then out of service — or
 * blocked, the one case that state exists for, when the close is refused.
 *
 * The close can last half a minute, so the record is read again after it and
 * nothing is written unless the session is still this one and still
 * preparing. A member who closed it meanwhile, or the delay that ran out,
 * already said what the world becomes.
 */
export async function abandonSetup(
  deps: AbandonDeps,
  abandonment: Abandonment,
  now: Date,
): Promise<void> {
  const { worldId, sessionId, detail, hostRefusal } = abandonment;
  const state = deps.states.for(worldId);

  let closeRefusal: string | null = null;
  try {
    await deps.host.close(sessionId);
  } catch (error) {
    closeRefusal = expunged(deps.journal, abandonment.cleanupSource, sessionId, error);
  }

  const current = await state.readSession();
  if (current === null || current.sessionId !== sessionId || current.state !== 'PROVISIONING') {
    return;
  }

  const failed: DomainEvent = { type: 'ProvisioningFailed', sessionId, detail };

  if (closeRefusal !== null) {
    await state.apply(
      {
        state: 'FAILED',
        lastError: hostRefusal ?? closeRefusal,
        clearFacts: false,
        deadline: null,
        closeIntents: [],
        abandonedSetup: sessionId,
        events: [failed, { type: 'CleanupFailed', sessionId, detail: closeRefusal }],
      },
      now,
    );
    // The intent stays open on purpose: something may still be billed, and a
    // closed intent is exactly what makes the reconciliation stop looking.
    return;
  }

  await state.apply(
    {
      state: 'IDLE',
      lastError: hostRefusal,
      clearFacts: true,
      deadline: null,
      closeIntents: [],
      abandonedSetup: sessionId,
      events: [failed],
    },
    now,
  );
  await deps.ledger.close(sessionId, now);
}
