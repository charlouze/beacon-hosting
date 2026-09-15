import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { catalogFor, refuseWorldLayout } from '@beacon/cloud-init';
import { isGame, isPlausibleSaveSize, isWorldId, World } from '@beacon/session';
import { adminWorldRecord, saveRecords } from '@beacon/session-record';
import { adminFirestore } from './lib/admin-firestore.js';
import { adminSaveStore } from './lib/admin-store.js';
import { argValue } from './lib/args.js';
import { chooseSave } from './lib/choose.js';
import { buildWorldArchive } from './lib/world-archive.js';
import { worldIdentity } from './lib/world-identity.js';
import { newInviteCode, worldBirth } from './lib/world-birth.js';

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
 * The one gesture that brings a world into existence (§2): its Firestore
 * document, its `server/current` already `IDLE`, and — for a game that does
 * not generate one on its own — the world it is handed by `--from`, deposited
 * as the `manual` save the first session restores.
 *
 * The world is created before the deposit, and only once (§8). A world that
 * already exists is never renamed and never recoded here: running this again
 * on it is the recovery gesture of §8, not a second birth, and it only
 * proceeds once `--game` is shown to agree with the world it names.
 *
 * The three guards below keep the §8 order they always have, and the order is
 * the point. The layout is judged before anything leaves the machine — an
 * archive refused further along has already left it. Then the floor, which is
 * `Save.of`'s and is asked here so that an empty folder is refused before the
 * administrator is asked to confirm it. Then the confirmation, which now
 * names the world, the bucket and the Firebase project: this project has one
 * hosting account, one Firebase project and no staging, so the one mistake
 * with no undo is answering yes while looking at the wrong one.
 */
const staging = mkdtempSync(join(tmpdir(), 'beacon-adopt-'));
try {
  const worldId = argValue(process.argv, 'world');
  if (!isWorldId(worldId)) throw new Error(`--world must name a world, got "${worldId}"`);

  const game = argValue(process.argv, 'game');
  if (!isGame(game)) throw new Error(`--game must name a game, got "${game}"`);

  const name = argValue(process.argv, 'name');
  if (name === undefined || name === '') {
    throw new Error('--name is required: it is what players read in the server list');
  }

  const from = argValue(process.argv, 'from');
  const catalogEntry = catalogFor(game);
  // `--from` is the catalogue's call, not a name compared here: a game that
  // lays down no world of its own dies without one instead of booting a blank
  // save (§2), so nothing short of an archive can start its first session.
  if (!catalogEntry.generatesWorlds && (from === undefined || from === '')) {
    throw new Error(`--from is required for ${game}: it does not generate a world on its own`);
  }

  let archive: string | undefined;
  if (from !== undefined && from !== '') {
    // Empty is as missing as absent, and it is not pedantry: `tar` reads an
    // empty `cwd` as the current directory, so a `--from=` left dangling in a
    // shell history would archive the whole repository before guard 1 has a
    // word to say about it.
    if (!statSync(from, { throwIfNoEntry: false })?.isDirectory()) {
      throw new Error(`--from must be a folder that directly contains a world folder, and ${from} is not one`);
    }

    archive = join(staging, 'world.tar.gz');
    const entries = await buildWorldArchive(from, archive);

    // First guard. What each game's world looks like belongs to the
    // catalogue (§4) and is asked of it directly: a local wrapper would only
    // forward its arguments, and would put that knowledge in a second place.
    const refusal = refuseWorldLayout(game, entries);
    if (refusal !== null) throw new Error(`refusing to adopt this archive — ${refusal}`);
  }

  const db = adminFirestore(process.env);
  const worlds = adminWorldRecord(db);
  const existing = await worlds.read(worldId);

  let world: World;
  if (existing !== null) {
    if (existing.game !== game) {
      throw new Error(
        `refusing: ${worldId} already exists as ${existing.game}, not ${game} — this adoption would put the world and its record out of step`,
      );
    }
    world = existing;
    console.log(`${worldId} already exists: this adoption is the §8 recovery gesture, not a birth`);
  } else {
    world = World.from({ worldId, game, name, inviteCode: newInviteCode(), players: [] });
    await worlds.create(world, new Date());
    for (const line of worldBirth(world, catalogEntry.hostname(worldId))) {
      console.log(line);
    }
  }

  if (archive === undefined) {
    // Nothing to deposit: the first session this world opens is left to
    // generate it, which is exactly what the companion already knows how to
    // do for a game the catalogue says generates one.
    console.log(`no --from given: the first session will generate ${worldId}`);
  } else {
    // Second guard. The same floor `Save.of` applies inside `deposit`, asked
    // one step earlier so the refusal arrives before the question rather than
    // after the answer.
    const sizeBytes = statSync(archive).size;
    if (!isPlausibleSaveSize(sizeBytes)) {
      throw new Error(`refusing to adopt ${sizeBytes} bytes: that is under the floor a world can weigh`);
    }

    const adopted = await worldIdentity(archive);
    console.log(
      `about to adopt ${sizeBytes} bytes from ${from}` +
        (adopted === undefined ? '' : ` — ${adopted.name} ~ ${adopted.guid}`),
    );

    // Third guard, and it names what it covers. The newest save is chosen by
    // the same calculation the next session restores by, never a second one
    // that resembles it (§8) — otherwise the administrator is told about an
    // archive that is not the one being replaced. Naming the world it carries
    // costs a full fetch of that archive, deliberately: the key and the
    // metadata do not carry the name, so a cheaper read would print a name
    // from the wrong object — which is worse than printing none.
    const { store, bucket } = adminSaveStore();
    const covered = chooseSave(await store.list(worldId));
    if (covered === undefined) {
      console.log(`${worldId} has no save yet in ${bucket}: this adoption covers nothing`);
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

    // The world, the bucket and the Firebase project are all in the
    // question, because each is the one word that turns a right answer into
    // the wrong deposit if it were the wrong one.
    const question = `Deposit ${worldId} into ${bucket} (Firebase project ${process.env['BEACON_FIREBASE_PROJECT']}) as its newest save?`;
    if (!(await confirm(question))) {
      console.log('stopped, nothing was deposited');
    } else {
      const save = await store.deposit(archive, {
        worldId,
        sessionId: null,
        origin: 'manual',
        createdAt: new Date(),
      });
      // The write that closes the §8 gap: an adoption used to leave no line
      // in the audit at all, because only the Functions wrote a `saves/{id}`
      // document. It writes its own now.
      await saveRecords(db).record(save);
      console.log(`deposited ${save.objectKey} (${save.sizeBytes} bytes), recorded under saves/{id}`);
    }
  }
} catch (error) {
  console.error(`beacon: ${String(error)}`);
  process.exitCode = 1;
} finally {
  rmSync(staging, { recursive: true, force: true });
}
