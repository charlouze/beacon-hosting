import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { watchdogHealth } from './watchdog-health.js';

process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';

const AT = new Date('2026-09-04T21:00:00Z');

let app: ReturnType<typeof initializeApp>;
let db: Firestore;

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-beacon' }, 'watchdog-health-spec');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await db.doc('health/watchdog').delete();
});

const stored = async () => (await db.doc('health/watchdog').get()).data();

describe('watchdogHealth', () => {
  it('records when the watchdog last completed a pass', async () => {
    await watchdogHealth(db).beat(AT, []);

    expect((await stored())?.['lastRunAt'].toDate()).toEqual(AT);
  });

  it('overwrites the previous beat rather than piling up', async () => {
    const later = new Date('2026-09-04T21:05:00Z');
    await watchdogHealth(db).beat(AT, []);

    await watchdogHealth(db).beat(later, []);

    expect((await stored())?.['lastRunAt'].toDate()).toEqual(later);
  });

  // Before the first pass the document does not exist, and the answer is still
  // a set — an empty one. Anything else would make the first pass announce
  // nothing, or crash on the day the document is wiped.
  it('reports nothing stranded before any pass has run', async () => {
    expect(await watchdogHealth(db).strandedLastPass()).toEqual([]);
  });

  it('remembers what the pass left stranded', async () => {
    await watchdogHealth(db).beat(AT, ['volume v-1 (80 GB)']);

    expect(await watchdogHealth(db).strandedLastPass()).toEqual(['volume v-1 (80 GB)']);
  });

  // The document answers "what is stranded now", so a volume that is gone must
  // leave it. Merged into the previous set instead, the answer would only ever
  // grow and a volume destroyed by hand would stay stranded forever.
  it('forgets a volume the next pass no longer finds', async () => {
    await watchdogHealth(db).beat(AT, ['volume v-1 (80 GB)', 'volume v-2 (80 GB)']);

    await watchdogHealth(db).beat(AT, ['volume v-2 (80 GB)']);

    expect(await watchdogHealth(db).strandedLastPass()).toEqual(['volume v-2 (80 GB)']);
  });
});
