import { getFirestore } from 'firebase-admin/firestore';
import { defaultApp } from './firebase-app.js';

/**
 * What §5 means by "seeded at deployment": the one document no client may
 * create — a `create` would be born past every field-by-field check at once,
 * so someone above the rules has to write it first.
 *
 * A world's own `server/current` is not seeded here: a world is born of an
 * adoption (`world-depot`), and that write brings its `server/current` IDLE
 * with it. There is no `server/current` at the root any more — every session
 * context lives under `worlds/{worldId}` (§5).
 *
 * `members` is not one of them either, though it is just as unwritable by a
 * client: its first document names a Google `uid`, which does not exist until
 * someone has signed in against this very project. A deployment cannot know
 * it, so the first admin is a console gesture after the first merge (§5, §10).
 *
 * Never touches an existing document: re-running it after an incident is the
 * recovery path, not a hazard.
 */
export async function seed(): Promise<void> {
  const db = getFirestore(defaultApp());

  // §5: seeded at deployment, and never created by a client — `resource` is
  // null on a create, so a document a client could create would bypass every
  // field-by-field restriction at once.
  const settings = db.doc('config/settings');
  if ((await settings.get()).exists) {
    console.log('config/settings already exists — left untouched');
  } else {
    await settings.create({
      sessionDurationMs: 4 * 60 * 60_000,
      extensionStepMs: 60 * 60_000,
      extensionWindowMs: 30 * 60_000,
      defaultInstanceSize: 'DEV1-L',
      // All-inclusive per size: instance, a 40 GB block volume and flexible
      // ip, each billed by the started hour (§11). 40 GB is the largest disk
      // a game boots on, so a larger one moves these rates. The ip rate is
      // matched by an invoice; the block volume one, 0.000130 €/GB/h, is the
      // public price read on 2026-10-08 and matched by none.
      tariffPerHour: { 'DEV1-L': 0.05304, 'PLAY2-MICRO': 0.06528 },
      // Both written by the deployment at every merge — the deployed commit,
      // and the url of the function that same deployment publishes (§4, §10).
      // Null here means "no deployment has stamped it yet", which is exactly
      // true of a freshly seeded database, and is why the seed runs first.
      rulesVersion: null,
      agentEndpoint: null,
    });
    console.log('config/settings seeded');
  }
}
