import { catalogFor } from '@beacon/cloud-init';
import type { AgentInstructions, AgentReport } from '@beacon/agent-protocol';
import {
  Save,
  type Clock,
  type DnsUpdater,
  type DomainEvent,
  type Game,
  type SaveOrigin,
  type ServerHost,
  type Session,
  type SessionId,
} from '@beacon/session';
import type { ServerStateStore, SettingsStore } from '@beacon/session-record';
import type { AgentTokens } from './agent-tokens.js';
import type { ProvisioningLedger } from './provisioning-ledger.js';
import { sanitizeLastError } from './sanitize-last-error.js';
import type { SaveRecords } from './save-records.js';

export interface AgentReportDeps {
  readonly clock: Clock;
  readonly tokens: AgentTokens;
  readonly state: ServerStateStore;
  readonly settings: SettingsStore;
  readonly ledger: ProvisioningLedger;
  readonly saves: SaveRecords;
  readonly dns: DnsUpdater;
  /**
   * §6 étape 3. Task 9 bis moved the destruction here from
   * `onServerStateChange`: that trigger fired the instant STOPPING was
   * written, before the agent had a chance to learn it was stopping — the
   * machine was gone before `pre-shutdown` could ever mean anything.
   */
  readonly host: ServerHost;
}

/** Nothing to do, and nothing to keep doing. What a stale machine is told. */
const STAND_DOWN: AgentInstructions = { state: 'IDLE', deadlineIso: null };

/**
 * The single endpoint the game machine talks to (§7). Null means the token did
 * not verify, and the caller answers 401 — every other outcome answers
 * instructions, because a machine that is told nothing keeps running.
 *
 * It decides and never transports: the http wrapper next door holds nothing,
 * which is what lets every rule below be tested without a network.
 */
export async function runAgentReport(
  deps: AgentReportDeps,
  token: string,
  report: AgentReport,
): Promise<AgentInstructions | null> {
  if (!(await deps.tokens.verify(report.sessionId, token))) return null;

  const session = await deps.state.readSession();
  // A report about a session that is no longer the current one. The machine is
  // told to stand down rather than being handed the running session's state —
  // which would tell an orphan to keep going, on a world that is not its own.
  if (session === null || session.sessionId !== report.sessionId)
    return STAND_DOWN;

  const now = deps.clock.now();
  if (report.phase === 'ready') await becomeRunning(deps, session, report, now);
  if (report.phase === 'saved') await recordSave(deps, session, report, now);
  if (report.phase === 'failed') await fileFailure(deps, session, report, now);

  // From the session as it was read, not as this call may have just left it: a
  // `ready` that published RUNNING answers PROVISIONING, and the machine learns
  // RUNNING one report later. That costs nothing — the agent acts on STOPPING
  // and on IDLE, and on nothing else — and it saves a second read of the
  // document on every heartbeat of every session.
  return await instructionsFor(deps, session);
}

async function instructionsFor(
  deps: AgentReportDeps,
  session: Session,
): Promise<AgentInstructions> {
  if (session.state === 'IDLE') return STAND_DOWN;
  const settings = await deps.settings.read();
  return {
    state: session.state,
    // The bound applied on read (§4), exactly as the screen applies it. Telling
    // the agent a closing time the watchdog is about to pull back would make it
    // plan a shutdown for an hour that never comes.
    deadlineIso: session
      .displayedDeadline(deps.clock, settings)
      .at.toISOString(),
  };
}

/**
 * §6 étape 7. `RUNNING` means the join point is published, and this is the one
 * place that publishes it — the address comes from what the function reserved,
 * never from what the machine declares (§7).
 */
async function becomeRunning(
  deps: AgentReportDeps,
  session: Session,
  report: AgentReport,
  now: Date,
): Promise<void> {
  const sessionId = report.sessionId;
  // Only from PROVISIONING. A second `ready` on a running session would rewrite
  // stateSince, and the delays of §6 are measured on it.
  if (session.state !== 'PROVISIONING') return;

  const facts = await deps.ledger.read(sessionId);
  // Nothing was recorded as created, so there is nothing to publish. The
  // provisioning delay reaps this session; announcing a join point built on
  // half an intent would put an address on screen that answers nothing.
  if (facts === null || session.game === null) return;

  if (report.ip !== undefined && report.ip !== facts.ip) {
    await fileEvent(deps, now, {
      type: 'AgentContradicted',
      sessionId,
      detail: `reported ip ${report.ip}, reserved ${facts.ip}`,
    });
  }

  const entry = catalogFor(session.game);
  const joinInfo = entry.joinInfo(facts.ip);

  if (entry.hostname !== null) {
    try {
      await deps.dns.point(entry.hostname, facts.ip);
    } catch (error) {
      // §8: the session is not interrupted. The join point already carries the
      // raw address as its fallback, and the evening of 2026-09-06 was played
      // through it.
      await fileEvent(deps, now, {
        type: 'DnsUpdateFailed',
        sessionId,
        detail: String(error),
      });
    }
  }

  await deps.state.publish(
    {
      ip: facts.ip,
      joinInfo,
      instanceSize: facts.instanceSize,
      references: { instanceId: facts.instanceId, ipId: facts.ipId },
    },
    now,
  );
}

/**
 * §8, third defense. `Save.of` is the floor; a refusal is journalled and the
 * document is not written, so a suspect archive never appears on the list a
 * human would restore from.
 */
async function recordSave(
  deps: AgentReportDeps,
  session: Session,
  report: AgentReport,
  now: Date,
): Promise<void> {
  const sessionId = report.sessionId;
  if (report.save === undefined || session.game === null) return;

  let save: Save;
  try {
    assertOwnKey(
      report.save.objectKey,
      session.game,
      report.save.origin,
      sessionId,
    );
    save = Save.of({
      // The instant this control plane recorded it, not one the machine chose:
      // the key already carries the machine's, and two clocks that disagree
      // must not both be authoritative.
      createdAt: now,
      game: session.game,
      objectKey: report.save.objectKey,
      sizeBytes: report.save.sizeBytes,
      origin: report.save.origin,
    });
  } catch (error) {
    await fileEvent(deps, now, {
      type: 'SaveRefused',
      sessionId,
      detail: String(error),
    });
    return;
  }

  // The destruction is one more consequence of the deposit, never a
  // replacement for it: the save is recorded whether or not the session is
  // the one about to be destroyed.
  await deps.saves.record(save);

  // §6 étape 3, and the reason this task exists: `session` is read from
  // `server/current`, never from anything the report claims, so a `saved`
  // report cannot destroy anything by itself — only the control plane's own
  // STOPPING can. Without this guard, the cadence push that reports `saved`
  // every ten minutes of ordinary play would kill the machine mid-game.
  //
  // STOPPING alone is not enough (spec fix ed130a8): the agent loop is
  // sequential, so a cadence push can be mid-flight — archived and uploaded —
  // the instant a stop is requested, and it reports `saved` with origin
  // `auto` right after STOPPING is written. Destroying on that report would
  // skip §6 étape 2 entirely: the game never stopped, the final save never
  // pushed, `pre-shutdown` naming nothing. The origin is the guard that tells
  // the final save from one merely arriving during the wait; a final save
  // that never comes is still covered, by the stopping-timeout net.
  if (session.state === 'STOPPING' && report.save.origin === 'pre-shutdown') {
    await destroy(deps, session, now);
  }
}

/**
 * §6 étape 3-4. Idempotent through `ServerHost.close()`: the watchdog's
 * `stopping-timeout` net can still fire on the same session, and the two
 * destructions must not disagree about what `server/current` becomes — both
 * compute the same target, IDLE with the facts cleared.
 *
 * That covers the *state*, not the *audit*. Each destroyer also files its own
 * `SessionStopped` carrying `costEuros`, and §11 sums that field — two of them
 * for one stop is a wrong month, not just a harmless repeat. The window is
 * seconds wide (an agent has to be minutes late reporting `pre-shutdown` for
 * the net to have already fired), but real, so the re-read below is the
 * no-op: if the net got here first, `server/current` is no longer STOPPING
 * for this session by the time this call is ready to write, and there is
 * nothing left for it to record — the net's own apply and `ledger.close`
 * already did it.
 */
async function destroy(deps: AgentReportDeps, session: Session, now: Date): Promise<void> {
  const sessionId = session.sessionId;
  if (sessionId === null) return;
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
    return;
  }

  const current = await deps.state.readSession();
  if (current === null || current.sessionId !== sessionId || current.state !== 'STOPPING') {
    return;
  }

  const stopped: DomainEvent = {
    type: 'SessionStopped',
    sessionId,
    detail: 'stopped after the final save',
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
}

/**
 * A token proves it belongs to `sessionId`, and nothing about which game or
 * origin the machine may claim — so a valid token can name a key under
 * *any* prefix, and the `game` field of the record it produces would vouch for
 * whatever it named. Refusing anything but the machine's own prefix closes
 * that: a session may only ever register a key that names itself.
 *
 * `saves/{game}/{origin}/{sessionId}/…` is `objectKeyFor` in
 * `libs/scaleway-storage/src/lib/keys.ts`, the one place that *builds* it.
 * This is a second place that only *recognises* it, and that duplication is
 * accepted debt: the domain must not hold an adapter's key format (§4,
 * `SaveFields.objectKey`), `@beacon/agent-protocol` is `scope:protocol` and
 * may only see `scope:domain`, and importing `@beacon/scaleway-storage` here
 * would drag its `@aws-sdk/client-s3` dependency into the Functions bundle,
 * on the wrong side of §7. They share no fixture — what holds them together is
 * that `keys.spec.ts` pins the whole literal key string, so any change to
 * `objectKeyFor` reddens there first.
 */
function assertOwnKey(
  objectKey: string,
  game: Game,
  origin: SaveOrigin,
  sessionId: SessionId,
): void {
  const prefix = `saves/${game}/${origin}/${sessionId}/`;
  if (!objectKey.startsWith(prefix)) {
    throw new Error(`object key ${objectKey} does not start with ${prefix}`);
  }
}

/**
 * `ProvisioningFailed` only from PROVISIONING, exactly as `becomeRunning`
 * gates on it above: a session already RUNNING did not fail to *provision*,
 * whatever else it failed at — a crashed game process, a failed push. Filing
 * that as a provisioning failure is the dishonesty `DnsUpdateFailed`'s comment
 * already names, and it would read the same way to whoever opens the journal.
 */
async function fileFailure(
  deps: AgentReportDeps,
  session: Session,
  report: AgentReport,
  now: Date,
): Promise<void> {
  const sessionId = report.sessionId;
  const detail =
    report.detail ?? 'the machine reported a failure without saying which';
  const event: DomainEvent =
    session.state === 'PROVISIONING'
      ? { type: 'ProvisioningFailed', sessionId, detail }
      : { type: 'AgentReportedFailure', sessionId, detail };
  await fileEvent(deps, now, event);
}

/**
 * One audit line, and nothing else touched. `state: null` is what keeps
 * `stateSince` where it is — the delays of §6 are measured on it, and a fact
 * filed about a session must not reset the clock that decides its fate.
 */
async function fileEvent(
  deps: AgentReportDeps,
  now: Date,
  event: DomainEvent,
): Promise<void> {
  await deps.state.apply(
    {
      state: null,
      lastError: null,
      clearFacts: false,
      deadline: null,
      closeIntents: [],
      events: [event],
    },
    now,
  );
}
