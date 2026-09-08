import { mkdirSync, statSync } from 'node:fs';
import { unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { AgentInstructions, AgentReport } from '@beacon/agent-protocol';
import {
  isPlausibleSaveSize,
  type Clock,
  type Save,
  type SaveOrigin,
  type SaveStore,
} from '@beacon/session';
import { packDirectory } from './archive.js';
import type { CompanionConfig } from './config.js';
import type { Readiness } from './readiness.js';

export interface PushDeps {
  readonly store: SaveStore;
  readonly report: (report: Omit<AgentReport, 'sessionId'>) => Promise<AgentInstructions>;
  readonly probeReady: () => Promise<Readiness>;
  /** Create the file the host's one-verb unit watches. */
  readonly touch: (path: string) => Promise<void>;
  readonly sleep: (ms: number) => Promise<void>;
  readonly log: (message: string) => void;
  readonly clock: Clock;
  readonly config: Pick<
    CompanionConfig,
    'game' | 'sessionId' | 'saveDir' | 'workDir' | 'stopFlag'
  >;
  readonly shutdownGraceMs: number;
}

/** How often the shutdown wait re-asks whether the server has gone quiet. */
const QUIET_POLL_MS = 5_000;

/**
 * Archive the world and deposit it (§8, first defense).
 *
 * It never throws. A push that fails is a push that fails: the world is still on
 * the disk, the previous key is untouched, and the next push is one interval
 * away. Letting this kill the loop would give up every save that follows, which
 * is the opposite of what it is for.
 */
export async function pushSave(deps: PushDeps, origin: SaveOrigin): Promise<void> {
  const { config } = deps;
  const now = deps.clock.now();
  const archive = join(config.workDir, `save-${now.getTime()}.tar.gz`);

  let save: Save;
  try {
    mkdirSync(config.workDir, { recursive: true });
    await packDirectory(config.saveDir, archive);

    // Asked before acting, and that is the difference between this defense and
    // the third one: an archive refused downstream has already left the
    // machine. This one never does.
    const sizeBytes = statSync(archive).size;
    if (!isPlausibleSaveSize(sizeBytes)) {
      const detail = `not pushing ${sizeBytes} bytes: it is under the floor of a save`;
      deps.log(detail);
      await tell(deps, detail);
      return;
    }

    save = await deps.store.deposit(archive, {
      game: config.game,
      sessionId: config.sessionId,
      origin,
      createdAt: now,
    });
  } catch (error) {
    // Only the archive and the deposit land here: whatever fails before this
    // point, the world never left the machine, the previous key is untouched,
    // and the next push is one interval away. The success report below is
    // deliberately outside this catch — a deposit that already succeeded must
    // never be turned into a reported failure by this branch.
    const detail = `archive or deposit refused, the world never left the machine: ${String(error)}`;
    deps.log(detail);
    await tell(deps, detail);
    return;
  }

  try {
    // A work file, not the bucket: unlinking it is not the destructive
    // gesture §8 forbids. Roughly twenty-four of these accumulate over a
    // four-hour session, on the same disk that holds the world and the game.
    await unlink(archive);
  } catch (error) {
    deps.log(`could not remove the local archive ${archive}: ${String(error)}`);
  }

  deps.log(`pushed ${save.objectKey} (${save.sizeBytes} bytes)`);
  try {
    await deps.report({
      phase: 'saved',
      save: { objectKey: save.objectKey, sizeBytes: save.sizeBytes, origin: save.origin },
    });
  } catch (error) {
    // The deposit already succeeded — the world is safe in the bucket. A
    // report that fails here must stay a local trace: turning it into
    // `phase: 'failed'` would file an AgentReportedFailure about a save that
    // exists, on the one path this task exists to protect (§8).
    deps.log(`could not report a successful push: ${String(error)}`);
  }
}

/**
 * Best effort, and deliberately swallowed: the control plane not hearing why a
 * push failed is bad, and this process staying alive to insist on telling it
 * would be worse — the vm is minutes from being destroyed either way, and the
 * next push, if there is one, carries the world forward regardless.
 */
async function tell(deps: PushDeps, detail: string): Promise<void> {
  try {
    await deps.report({ phase: 'failed', detail: detail.slice(0, 1024) });
  } catch (error) {
    deps.log(`could not report the failure: ${String(error)}`);
  }
}

/**
 * §6, clean shutdown, step 2: stop the game server **then** push the last save,
 * in that order, so the archive is coherent.
 *
 * The stop travels through a channel with one verb — this touches a file, and a
 * systemd unit on the host, written by the cloud-init, does nothing but
 * `docker stop`. The docker socket would have given the same result and root on
 * the machine with it (§7).
 */
export async function stopAndPush(deps: PushDeps): Promise<void> {
  try {
    mkdirSync(dirname(deps.config.stopFlag), { recursive: true });
    await deps.touch(deps.config.stopFlag);
    deps.log('asked the host to stop the game server');
  } catch (error) {
    // A stop that could not even be asked for is not a reason to give up the
    // evening's last save: the same reasoning that pushes anyway when the
    // server never goes quiet, below, applies one step earlier — a torn
    // archive is a risk, an absent one is a loss.
    deps.log(`could not ask the host to stop the game server: ${String(error)}`);
  }

  // For the game whose readiness comes from a file rather than a query, this
  // probe never turns false again once the identifier has been read: the
  // file stays on disk. This loop still runs out its grace period below and
  // archives anyway — deliberately, and accepted by §8 for that game: a torn
  // archive is a risk, an absent one is a loss, and nothing here can ask that
  // server for a save on demand.
  const deadline = deps.clock.now().getTime() + deps.shutdownGraceMs;
  let quiet = false;
  while (deps.clock.now().getTime() < deadline) {
    if (!(await deps.probeReady()).ready) {
      quiet = true;
      break;
    }
    await deps.sleep(QUIET_POLL_MS);
  }

  if (!quiet) {
    // Bounded, and it pushes anyway. A container that will not die must not
    // cost the evening's last save: a torn archive is a risk, an absent one is
    // a loss, and the previous key is untouched either way (§5).
    deps.log('the server is still answering after the grace period, archiving regardless');
  }

  await pushSave(deps, 'pre-shutdown');
}
