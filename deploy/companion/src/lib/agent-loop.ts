import {
  GAME_LOG_MAX_CHARS,
  type AgentInstructions,
  type AgentReport,
} from '@beacon/agent-protocol';
import type { Clock } from '@beacon/session';
import type { Readiness } from './readiness.js';
import type { SetupWatch } from './setup-watch.js';

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
  /**
   * The setup this server goes through, followed until it is announced: what
   * to declare on each turn, and how long a turn waits. `reportIntervalMs`
   * takes over from there.
   */
  readonly setup: SetupWatch;
  /** The end of what the game printed. Read only for a failure declared before the server is announced. */
  readonly readGameLog: () => string;
}

/**
 * One report a minute once the server is announced (§6). That cadence is not
 * an implementation detail: two measured guarantees hang on it — the machine
 * learns an extension or a stop in under a minute, and the watchdog can tell a
 * slow machine from a mute one.
 *
 * Until then every report also declares the step the setup is on, and the
 * turns follow the setup interval: a step is only worth telling while it is
 * the current one. Once announced the loop declares nothing more and reads the
 * game's output no longer.
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

    const report = announced ? outcome.report : beforeAnnounced(outcome.report, deps);

    let instructions: AgentInstructions;
    try {
      instructions = await deps.report(report);
      if (outcome.becomesReady) announced = true;
    } catch (error) {
      // The endpoint is across a network and the session is not over because
      // one call failed. A loop that died here would stop pushing saves — which
      // is the one thing this machine holds that nothing else can rebuild.
      deps.log(`report failed, trying again next turn: ${String(error)}`);
      await deps.sleep(turnInterval(deps, announced));
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

    await deps.sleep(turnInterval(deps, announced));
  }
}

const turnInterval = (deps: AgentLoopDeps, announced: boolean): number =>
  announced ? deps.reportIntervalMs : deps.setup.intervalMs;

/**
 * What a report carries on top of its phase while the server sets itself up:
 * the step it is on, and on a failure the end of what the game printed — the
 * one trace of it that outlives the machine.
 */
function beforeAnnounced(
  report: Omit<AgentReport, 'sessionId'>,
  deps: AgentLoopDeps,
): Omit<AgentReport, 'sessionId'> {
  const declaring = { ...report, setup: deps.setup.declared() };
  if (report.phase !== 'failed') return declaring;

  const gameLog = deps.readGameLog().slice(-GAME_LOG_MAX_CHARS);
  return gameLog === '' ? declaring : { ...declaring, gameLog };
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
 * machine* restored. No match, no publish — the report makes the control
 * plane abandon the setup instead, with a legible reason.
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
