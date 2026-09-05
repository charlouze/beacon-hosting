import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

/**
 * What §5 means by "seeded at deployment". Never touches an existing document:
 * re-running it after an incident is the recovery path, not a hazard.
 *
 * config/settings and the first members/{uid} are seeded in tranche 4, with
 * the rules and the auth that give them a reader.
 */
async function seed(): Promise<void> {
  if (getApps().length === 0) initializeApp();
  const db = getFirestore();
  const doc = db.doc('server/current');

  const snapshot = await doc.get();
  if (snapshot.exists) {
    console.log('server/current already exists — left untouched');
    return;
  }

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

seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
