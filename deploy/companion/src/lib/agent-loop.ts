import type { AgentInstructions, AgentReport } from '@beacon/agent-protocol';
import type { Clock } from '@beacon/session';
import type { Readiness } from './readiness.js';

export interface AgentLoopDeps {
  /** Whether the server is ready to be joined, and by what — see `Readiness`. */
  readonly probeReady: () => Promise<Readiness>;
  readonly report: (report: Omit<AgentReport, 'sessionId'>) => Promise<AgentInstructions>;
  /** Stop the game and push the last save. Written in task 8. */
  readonly onStopping: () => Promise<void>;
  /** Push a save, on the regular cadence. Written in task 8. */
  readonly onPushDue: () => Promise<void>;
  readonly sleep: (ms: number) => Promise<void>;
  readonly log: (message: string) => void;
  /** The domain's port, and not a `now` of its own: one word per concept. */
  readonly clock: Clock;
  readonly reportIntervalMs: number;
  readonly pushIntervalMs: number;
  /** Ends the loop. In production it is never true; the tests bound it. */
  readonly until?: () => boolean;
  /** The world this machine itself restored, read from disk — see `readWorldIdentity`. */
  readonly readWorld: () => { readonly name: string; readonly guid: string } | null;
}

/**
 * One report a minute (§6). The cadence is not an implementation detail: two
 * measured guarantees hang on it — the machine learns an extension or a stop in
 * under a minute, and the watchdog can tell a slow machine from a mute one.
 *
 * Everything the control plane decides comes back in the answer, so there is no
 * channel to keep open and no notification to miss.
 */
export async function runAgentLoop(deps: AgentLoopDeps): Promise<void> {
  const until = deps.until ?? (() => false);
  let announced = false;
  let lastPush = deps.clock.now().getTime();

  while (!until()) {
    const readiness = await probe(deps);

    const outcome = !announced && readiness.ready ? readyOutcome(readiness, deps.readWorld) : ALIVE;

    let instructions: AgentInstructions;
    try {
      instructions = await deps.report(outcome.report);
      if (outcome.becomesReady) announced = true;
    } catch (error) {
      // The endpoint is across a network and the session is not over because
      // one call failed. A loop that died here would stop pushing saves — which
      // is the one thing this machine holds that nothing else can rebuild.
      deps.log(`report failed, trying again next turn: ${String(error)}`);
      await deps.sleep(deps.reportIntervalMs);
      continue;
    }

    if (instructions.state === 'IDLE') {
      // Whatever ran here is not the current session. Nothing left to do, and
      // nothing worth pushing: the world on this disk belongs to nobody.
      deps.log('the control plane says this session is over');
      return;
    }

    if (instructions.state === 'STOPPING') {
      await deps.onStopping();
      return;
    }

    const now = deps.clock.now().getTime();
    if (announced && now - lastPush >= deps.pushIntervalMs) {
      lastPush = now;
      await deps.onPushDue();
    }

    await deps.sleep(deps.reportIntervalMs);
  }
}

/** Not ready on any failure: for the first minutes nothing is listening, and that is normal. */
async function probe(deps: AgentLoopDeps): Promise<Readiness> {
  try {
    return await deps.probeReady();
  } catch (error) {
    deps.log(`probe failed: ${String(error)}`);
    return { ready: false };
  }
}

interface ReadyOutcome {
  readonly report: Omit<AgentReport, 'sessionId'>;
  /** Whether this outcome is the one `ready` that latches `announced`. */
  readonly becomesReady: boolean;
}

const ALIVE: ReadyOutcome = { report: { phase: 'alive' }, becomesReady: false };

/**
 * `ready` once the server answers, but a `serverId` is followed rather than
 * merely relayed (§6): it names the world the *game* generated, and the only
 * defence against a blank world is to compare it against the world *this
 * machine* restored. No match, no publish — the session then dies of the
 * provisioning deadline instead, with a legible reason.
 */
function readyOutcome(
  readiness: Readiness & { ready: true },
  readWorld: AgentLoopDeps['readWorld'],
): ReadyOutcome {
  if (readiness.serverId === undefined) {
    return { report: { phase: 'ready' }, becomesReady: true };
  }

  const world = readWorld();
  if (world !== null && readiness.serverId.startsWith(`${world.guid}~`)) {
    return { report: { phase: 'ready', serverId: readiness.serverId, world }, becomesReady: true };
  }

  return {
    report: {
      phase: 'failed',
      detail: `serverId does not name the world this machine restored: ${readiness.serverId}`,
    },
    becomesReady: false,
  };
}
