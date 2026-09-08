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

    let instructions: AgentInstructions;
    try {
      instructions = await deps.report(
        // `ready` once and only once. A second one would rewrite `stateSince`,
        // and the delays of §6 are measured on it. `serverId` rides along only
        // when the probe found one — the game that publishes an address has
        // none, and the report must not invent one.
        !announced && readiness.ready
          ? { phase: 'ready', ...(readiness.serverId !== undefined ? { serverId: readiness.serverId } : {}) }
          : { phase: 'alive' },
      );
      if (!announced && readiness.ready) announced = true;
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
