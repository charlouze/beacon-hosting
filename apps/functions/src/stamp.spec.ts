import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DEPLOYED_FIELDS } from '@beacon/session-record';
import { stamp } from './stamp.js';

process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';

let app: ReturnType<typeof initializeApp>;
let db: Firestore;

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-beacon' }, 'stamp-spec');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await db.doc('config/settings').delete();
});

describe('stamp', () => {
  // Targeted: the seed never touches an existing document, so it could not
  // carry this. And a whole-document write here would erase the settings an
  // admin edited between two merges.
  it('stamps both reserved fields without touching the rest of the settings', async () => {
    await db
      .doc('config/settings')
      .set({
        sessionDurationMs: 7_200_000,
        rulesVersion: null,
        agentEndpoint: null,
      });

    await stamp('9c1f2e3', 'https://agentreport-abc.a.run.app');

    expect((await db.doc('config/settings').get()).data()).toEqual({
      sessionDurationMs: 7_200_000,
      rulesVersion: '9c1f2e3',
      agentEndpoint: 'https://agentreport-abc.a.run.app',
    });
  });

  // Closes the loop the rules test opens from the other end: whatever this
  // writes is exactly what firestore.rules subtracts from an admin's reach.
  // A field stamped here and missing from that list is a field an admin can
  // write, and nothing else would say so.
  it('stamps the declared fields and no others', async () => {
    await db
      .doc('config/settings')
      .set({ rulesVersion: null, agentEndpoint: null });

    await stamp('9c1f2e3', 'https://agentreport-abc.a.run.app');

    const stamped = Object.keys(
      (await db.doc('config/settings').get()).data() ?? {},
    );
    expect(new Set(stamped)).toEqual(new Set(DEPLOYED_FIELDS));
  });

  // The address is read back from the deployment that just published it, so a
  // blank one means that reading failed. Written anyway, it would provision
  // machines that report nowhere: the session stays PROVISIONING until the
  // watchdog collects it, on a games night, with nothing saying why.
  it('refuses a blank endpoint', async () => {
    await db
      .doc('config/settings')
      .set({ rulesVersion: null, agentEndpoint: null });

    await expect(stamp('9c1f2e3', '')).rejects.toThrow(/endpoint/);
  });

  // A stamp with nothing to stamp would not fail the deployment, it would make
  // every open tab reload forever against a version that matches nothing.
  it('refuses a blank reference', async () => {
    await db.doc('config/settings').set({ rulesVersion: null });

    await expect(
      stamp('', 'https://agentreport-abc.a.run.app'),
    ).rejects.toThrow(/commit reference/);
  });
});
