import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { provisioningLedger, type ProvisioningLedger } from './provisioning-ledger.js';

process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';

const NOW = new Date('2026-09-04T21:00:00Z');

let app: ReturnType<typeof initializeApp>;
let db: Firestore;
let ledger: ProvisioningLedger;

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-beacon' }, 'ledger-spec');
  db = getFirestore(app);
  ledger = provisioningLedger(db);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await db.recursiveDelete(db.collection('provisioning'));
});

const intend = (sessionId: string, closedAt: Date | null = null) =>
  db.doc(`provisioning/${sessionId}`).set({
    tag: `session:${sessionId}`,
    intendedAt: NOW,
    instanceSize: 'DEV1-L',
    closedAt,
  });

describe('provisioningLedger', () => {
  it('finds no open session in an empty ledger', async () => {
    expect(await ledger.openSessions()).toEqual([]);
  });

  it('lists an intent that was written and never closed', async () => {
    await intend('sess1');
    expect(await ledger.openSessions()).toEqual(['sess1']);
  });

  it('leaves out an intent that was closed', async () => {
    await intend('sess1', NOW);
    expect(await ledger.openSessions()).toEqual([]);
  });

  it('lists every open intent, not one', async () => {
    await intend('sess1');
    await intend('sess2');
    await intend('sess3', NOW);
    expect((await ledger.openSessions()).sort()).toEqual(['sess1', 'sess2']);
  });

  it('closes an intent by stamping it, never by deleting it', async () => {
    await intend('sess1');

    await ledger.close('sess1', NOW);

    const doc = await db.doc('provisioning/sess1').get();
    expect(doc.exists).toBe(true);
    expect(doc.data()?.['closedAt'].toDate()).toEqual(NOW);
    expect(await ledger.openSessions()).toEqual([]);
  });

  // The watchdog reclaims resources whose intent it never saw; closing one is
  // then a no-op, and must not be an error that aborts the pass.
  it('closing an intent that does not exist is not an error', async () => {
    await ledger.close('never-seen', NOW);
    expect((await db.doc('provisioning/never-seen').get()).exists).toBe(false);
  });
});
