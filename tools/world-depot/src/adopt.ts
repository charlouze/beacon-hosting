import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { refuseWorldLayout } from '@beacon/cloud-init';
import { isGame, isPlausibleSaveSize } from '@beacon/session';
import { adminSaveStore } from './lib/admin-store.js';
import { argValue } from './lib/args.js';
import { chooseSave } from './lib/choose.js';
import { buildWorldArchive } from './lib/world-archive.js';
import { worldIdentity } from './lib/world-identity.js';

/**
 * Every deposit is asked for, and there is no flag that answers for the
 * administrator: a tool that deposits on its own is a tool somebody runs twice
 * by accident. A shell with no terminal on its input cannot answer, so it is
 * refused rather than taken for a yes.
 */
async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    throw new Error('nothing on this input can answer the confirmation: run the adoption from a terminal');
  }
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await terminal.question(`${question} [o/N] `);
    return ['o', 'y'].includes(answer.trim().toLowerCase());
  } finally {
    terminal.close();
  }
}

/**
 * Brings a world that lived elsewhere into the bucket, as a `manual` save the
 * next session restores. **The only operation of the system that covers over
 * something** (§8): nothing is erased, but the world in place stops being the
 * one a session starts on.
 *
 * The three guards below are in the §8's order, and the order is the point.
 * The layout is judged before anything leaves the machine — an archive refused
 * further along has already left it. Then the floor, which is `Save.of`'s and
 * is asked here so that an empty folder is refused before the administrator is
 * asked to confirm it. Then the confirmation, which names what is about to be
 * covered.
 */
const staging = mkdtempSync(join(tmpdir(), 'beacon-adopt-'));
try {
  const game = argValue(process.argv, 'game');
  if (!isGame(game)) throw new Error(`--game must name a game, got "${game}"`);

  const from = argValue(process.argv, 'from');
  // Empty is as missing as absent, and it is not pedantry: `tar` reads an
  // empty `cwd` as the current directory, so a `--from=` left dangling in a
  // shell history would archive the whole repository before guard 1 has a word
  // to say about it.
  if (from === undefined || from === '') {
    throw new Error('--from is required: the folder that directly contains the world folder');
  }
  if (!statSync(from, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`--from must be a folder that directly contains a world folder, and ${from} is not one`);
  }

  const archive = join(staging, 'world.tar.gz');
  const entries = await buildWorldArchive(from, archive);

  // First guard. What each game's world looks like belongs to the catalogue
  // (§4) and is asked of it directly: a local wrapper would only forward its
  // arguments, and would put that knowledge in a second place.
  const refusal = refuseWorldLayout(game, entries);
  if (refusal !== null) throw new Error(`refusing to adopt this archive — ${refusal}`);

  // Second guard. The same floor `Save.of` applies inside `deposit`, asked one
  // step earlier so the refusal arrives before the question rather than after
  // the answer.
  const sizeBytes = statSync(archive).size;
  if (!isPlausibleSaveSize(sizeBytes)) {
    throw new Error(`refusing to adopt ${sizeBytes} bytes: that is under the floor a world can weigh`);
  }

  const adopted = await worldIdentity(archive);
  console.log(
    `about to adopt ${sizeBytes} bytes from ${from}` +
      (adopted === undefined ? '' : ` — ${adopted.name} ~ ${adopted.guid}`),
  );

  // Third guard, and it names what it covers. The newest save is chosen by the
  // same calculation the next session restores by, never a second one that
  // resembles it (§8) — otherwise the administrator is told about an archive
  // that is not the one being replaced. Naming the world it carries costs a
  // full fetch of that archive, deliberately: the key and the metadata do not
  // carry the name, so a cheaper read would print a name from the wrong object
  // — which is worse than printing none.
  const { store, bucket } = adminSaveStore();
  const covered = chooseSave(await store.list(game));
  if (covered === undefined) {
    console.log(`${game} has no save yet in ${bucket}: this adoption covers nothing`);
  } else {
    const previous = join(staging, 'covered.tar.gz');
    await store.fetch(covered, previous);
    const identity = await worldIdentity(previous);
    const covers = `${covered.sizeBytes} bytes, ${covered.createdAt.toISOString()}`;
    console.log(
      `this will become newer than ${covered.objectKey} (${covers})` +
        (identity === undefined ? '' : ` — ${identity.name} ~ ${identity.guid}`),
    );
    console.log('nothing is erased: that key stays in the bucket, and `retrieve --key=` brings it back');
  }

  // The bucket is in the question, and it is the most important word of it:
  // this project has one hosting account and no staging, so the one mistake
  // that has no undo is answering yes while looking at the wrong one.
  if (!(await confirm(`Deposit this world into ${bucket} as ${game}'s newest save?`))) {
    console.log('stopped, nothing was deposited');
  } else {
    // `bootstrap` stands where a session id would, and the key is built by
    // `objectKeyFor` inside the adapter — never spelled out here. The
    // PowerShell script this replaces spelled it and warned, in its own
    // comment, that nothing would break the day the two definitions diverged.
    const save = await store.deposit(archive, {
      game,
      sessionId: 'bootstrap',
      origin: 'manual',
      createdAt: new Date(),
    });

    console.log(`deposited ${save.objectKey} (${save.sizeBytes} bytes)`);
    console.log('this adoption is invisible to the audit: only the Functions write a saves/{id} document,');
    console.log('so the world just changed without the history carrying a single line about it (§8).');
  }
} catch (error) {
  console.error(`beacon: ${String(error)}`);
  process.exitCode = 1;
} finally {
  rmSync(staging, { recursive: true, force: true });
}
