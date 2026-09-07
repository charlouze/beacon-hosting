import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Clock, Save, SaveStore } from '@beacon/session';
import { clearDirectory, unpackInto } from './archive.js';
import type { CompanionConfig } from './config.js';
import type { Reporter } from './reporter.js';

export interface RestoreDeps {
  readonly store: SaveStore;
  readonly report: Reporter['send'];
  readonly takeOwnership: (directory: string, owner: string) => Promise<void>;
  readonly log: (message: string) => void;
  readonly config: Pick<CompanionConfig, 'game' | 'saveDir' | 'saveOwner' | 'workDir'>;
  readonly clock: Clock;
}

/**
 * The first of the three defenses of the golden rule (§8), and the one that
 * actually protects: §6 puts the ordering in the compose rather than in a
 * convention, so as long as this exits non-zero the game container never
 * starts, and nobody can join a world that is not the right one.
 *
 * What it must get right is one distinction: "this game has never been saved"
 * and "the bucket did not answer" are different answers. Taking the second for
 * the first would let the game generate a fresh world, which the next push
 * would deposit as the newest save, which the session after would restore. No
 * line of code would have overwritten anything, and the world would be gone.
 */
export async function runRestore(deps: RestoreDeps): Promise<void> {
  const { config } = deps;
  try {
    mkdirSync(config.workDir, { recursive: true });
  } catch (error) {
    await tell(deps, `restore refused: could not prepare the work directory — ${String(error)}`);
    throw error;
  }

  let newest: Save | undefined;
  try {
    // A throw propagates. It is the whole point of this function.
    const saves = await deps.store.list(config.game);
    // Newest by `createdAt` and not `saves[0]`: the port's contract is "newest
    // first" (§4), but trusting an adapter's order here would make a restore
    // depend on an invariant this function cannot check.
    newest = saves.reduce<Save | undefined>(
      (latest, save) => (latest === undefined || save.createdAt > latest.createdAt ? save : latest),
      undefined,
    );
  } catch (error) {
    await tell(deps, `restore refused: the bucket did not answer — ${String(error)}`);
    throw error;
  }

  if (newest === undefined) {
    // Legitimate, and only for the first evening of a world: the game generates
    // one. It is a *listed* absence, which is what makes it safe to act on.
    //
    // Still needs the chown: a fresh volume hands this folder to nobody, and
    // without it the autosave writes nothing at all, silently — the one boot
    // with no earlier save to fall back on. Made, not merely found: the folder
    // the game will write its first world into may not exist yet either.
    try {
      mkdirSync(config.saveDir, { recursive: true });
      await deps.takeOwnership(config.saveDir, config.saveOwner);
    } catch (error) {
      await tell(deps, `restore refused: could not prepare a fresh world — ${String(error)}`);
      throw error;
    }
    deps.log(`no save for ${config.game} yet: the game will generate a world`);
    return;
  }

  const archive = join(config.workDir, 'restore.tar.gz');
  try {
    // Made here and not trusted to a preexisting mount: without it, an
    // unpopulated volume fails the extract below instead of receiving it.
    mkdirSync(config.saveDir, { recursive: true });
    await deps.store.fetch(newest, archive);
    // Cleared, not merged into: a world from a session that restored a
    // different save must not survive next to the one just fetched.
    clearDirectory(config.saveDir);
    await unpackInto(archive, config.saveDir);
  } catch (error) {
    // A half-written world is worse than none: the game would load it, someone
    // would play on it, and the push at the end would make it the newest save.
    await tell(deps, `restore refused: ${newest.objectKey} — ${String(error)}`);
    throw error;
  }

  try {
    await deps.takeOwnership(config.saveDir, config.saveOwner);
  } catch (error) {
    await tell(
      deps,
      `restore refused: ${newest.objectKey} — could not take ownership — ${String(error)}`,
    );
    throw error;
  }
  deps.log(`restored ${newest.objectKey} (${newest.sizeBytes} bytes)`);
}

/**
 * Best effort, and deliberately swallowed: the control plane not hearing why is
 * bad, and this process staying alive to say so would be worse. What ends the
 * session either way is the provisioning delay of §6.
 */
async function tell(deps: RestoreDeps, detail: string): Promise<void> {
  try {
    await deps.report({ phase: 'failed', detail: detail.slice(0, 1024) });
  } catch (error) {
    deps.log(`could not report the failure: ${String(error)}`);
  }
}
