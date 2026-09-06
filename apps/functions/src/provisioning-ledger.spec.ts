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

  it('refuses to open an intent for a session id already seen', async () => {
    await ledger.open('s1', { tag: 'session:s1', instanceSize: 'DEV1-L' }, NOW);
    await expect(
      ledger.open('s1', { tag: 'session:s1', instanceSize: 'DEV1-L' }, NOW),
    ).rejects.toThrow();
  });

  it('opens an intent the watchdog reads as open', async () => {
    await ledger.open('s1', { tag: 'session:s1', instanceSize: 'DEV1-L' }, NOW);
    expect(await ledger.openSessions()).toEqual(['s1']);
  });

  it('reads nothing for a session it never opened', async () => {
    expect(await ledger.read('never-seen')).toBeNull();
  });

  // §6 étape 7: a crash between the call and recording the instance id must
  // not read back as a machine that exists.
  it('reads nothing for an intent opened but not yet recorded', async () => {
    await ledger.open('s1', { tag: 'session:s1', instanceSize: 'DEV1-L' }, NOW);
    expect(await ledger.read('s1')).toBeNull();
  });

  it('reads the four facts once the provider answered', async () => {
    await ledger.open('s1', { tag: 'session:s1', instanceSize: 'DEV1-L' }, NOW);
    await ledger.record('s1', { instanceId: 'srv-1', ipId: 'ip-1', ip: '51.15.42.7' });
    expect(await ledger.read('s1')).toEqual({
      instanceId: 'srv-1',
      ipId: 'ip-1',
      ip: '51.15.42.7',
      instanceSize: 'DEV1-L',
    });
  });
});
