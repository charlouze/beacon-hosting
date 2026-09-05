import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { watchdogHealth } from './watchdog-health.js';

process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';

let app: ReturnType<typeof initializeApp>;
let db: Firestore;

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-beacon' }, 'watchdog-health-spec');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

describe('watchdogHealth', () => {
  it('records when the watchdog last completed a pass', async () => {
    const at = new Date('2026-09-04T21:00:00Z');

    await watchdogHealth(db).beat(at);

    expect((await db.doc('health/watchdog').get()).data()?.['lastRunAt'].toDate()).toEqual(at);
  });

  it('overwrites the previous beat rather than piling up', async () => {
    const later = new Date('2026-09-04T21:05:00Z');
    await watchdogHealth(db).beat(new Date('2026-09-04T21:00:00Z'));

    await watchdogHealth(db).beat(later);

    expect((await db.doc('health/watchdog').get()).data()?.['lastRunAt'].toDate()).toEqual(later);
  });
});
