import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * What §5 means by "seeded at deployment". Never touches an existing document:
 * re-running it after an incident is the recovery path, not a hazard.
 *
 * The first members/{uid} is seeded in tranche 4, with the rules and the auth
 * that give it a reader.
 */
async function seed(): Promise<void> {
  if (getApps().length === 0) initializeApp();
  const db = getFirestore();
  const doc = db.doc('server/current');

  // Each document is checked on its own: a crash between the two creates must
  // not make a re-run skip the second one just because the first now exists.
  if ((await doc.get()).exists) {
    console.log('server/current already exists — left untouched');
  } else {
    // Every field of §5, present and null. A field that is absent rather than
    // null does not read the same way in a rules diff, and the tranche 4 rules
    // will be written against this very document.
    await doc.create({
      state: 'IDLE',
      stateSince: Timestamp.now(),
      sessionId: null,
      startedBy: null,
      startedAt: null,
      deadline: null,
      game: null,
      instanceId: null,
      ipId: null,
      ip: null,
      joinInfo: null,
      provisionClaimedAt: null,
      lastError: null,
    });
    console.log('server/current seeded as IDLE');
  }

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
      // All-inclusive per size: instance, local disk and flexible ip, which
      // are billed together by the started hour (§11). Read from the project's
      // own catalogue on 2026-09-03, not from a public price page.
      tariffPerHour: { 'DEV1-L': 0.05454 },
      // Written by the deployment at every merge, with the deployed commit
      // (§4, §10). Null here means "no deployment has stamped it yet", which
      // is exactly true of a freshly seeded database.
      rulesVersion: null,
    });
    console.log('config/settings seeded');
  }
}

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
