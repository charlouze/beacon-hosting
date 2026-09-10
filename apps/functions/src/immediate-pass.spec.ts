import { beforeEach, describe, expect, it } from 'vitest';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, type DocumentSnapshot, type Firestore } from 'firebase-admin/firestore';
import { FakeInstanceApi, ScalewayServerHost } from '@beacon/scaleway-compute';
import { DEFAULT_LIMITS, type ServerHost, type Session } from '@beacon/session';
import { serverStateStore, settingsStore, sessionFrom, SERVER_DOC } from '@beacon/session-record';
import { adminMembershipRecord } from '@beacon/membership-record/admin';
import { agentTokens } from './agent-tokens.js';
import { provisioningLedger } from './provisioning-ledger.js';
import { runStateChange, type ProvisionDeps } from './provisioning.js';
import { runWatchdog, type WatchdogDeps } from './watchdog.js';
import { watchdogHealth } from './watchdog-health.js';

process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';

/**
 * The hazard the immediate pass introduces, and the only test that can catch
 * it: the pass runs seconds after a machine was created, against the very
 * document the provisioning just wrote. If the intent, the tags and the state
 * do not line up exactly, it reclaims the session it is meant to protect —
 * five minutes of grace used to hide any such mistake.
 */
describe('a pass fired right after a provisioning', () => {
  // Wiring is deliberately real on the Firestore side and fake on the provider
  // side: what is under test is the agreement between the document, the intent
  // and the inventory, and only one of the three is worth faking.
  let api: FakeInstanceApi;
  let host: ServerHost;

  beforeEach(async () => {
    if (getApps().length === 0) initializeApp({ projectId: 'demo-beacon' });
    const db = getFirestore();
    await db.recursiveDelete(db.collection('provisioning'));
    await db.recursiveDelete(db.collection('events'));
    await db.recursiveDelete(db.collection('agentTokens'));
    await db.doc(SERVER_DOC).delete();
    await db.doc('health/watchdog').delete();
    await db.doc(SERVER_DOC).set(openingDocument());
    api = new FakeInstanceApi();
    host = new ScalewayServerHost(api, { resolve: async () => 'img-1' });
  });

  it('leaves the machine it just created alone', async () => {
    const db = getFirestore();
    const acted = await runStateChange(provisionDeps(db, host), sessionOf(await db.doc(SERVER_DOC).get()));
    expect(acted).toBe(true);
    expect(api.servers).toHaveLength(1);

    await runWatchdog(watchdogDeps(db, host));

    expect(api.servers).toHaveLength(1);
    expect(api.ips).toHaveLength(1);
    // §6: RUNNING is now the agent's report, not this pass's — an immediate
    // watchdog pass must leave a session it just created alone, in
    // PROVISIONING, rather than reclaim or advance it.
    expect((await db.doc(SERVER_DOC).get()).get('state')).toBe('PROVISIONING');
  });

  // Task 9 bis: STOPPING no longer destroys here, or on the immediate pass
  // that follows it — the machine survives until the agent reports `saved`
  // (agent-report.ts), or until the watchdog's own ten-minute net, neither of
  // which this test fires. Proving the opposite was the bug the whole-branch
  // review found: the machine was gone before the agent ever learned it was
  // stopping.
  it('leaves the machine alone right after a stop request', async () => {
    const db = getFirestore();
    await runStateChange(provisionDeps(db, host), sessionOf(await db.doc(SERVER_DOC).get()));
    await db.doc(SERVER_DOC).set({ state: 'STOPPING', stateSince: new Date() }, { merge: true });
    const acted = await runStateChange(
      provisionDeps(db, host),
      sessionOf(await db.doc(SERVER_DOC).get()),
    );
    expect(acted).toBe(false);

    await runWatchdog(watchdogDeps(db, host));

    expect(api.servers).toHaveLength(1);
    expect((await db.doc(SERVER_DOC).get()).get('state')).toBe('STOPPING');
  });
});

const openingDocument = () => ({
  state: 'PROVISIONING',
  sessionId: 's1',
  game: 'enshrouded',
  startedBy: 'u1',
  startedAt: new Date(),
  deadline: new Date(Date.now() + 4 * 3_600_000),
  provisionClaimedAt: null,
});

/** A parse failure here is its own bug, not the one this suite hunts. */
const sessionOf = (snapshot: DocumentSnapshot): Session => {
  const session = sessionFrom(snapshot.data() ?? {});
  if (session === null) throw new Error('expected server/current to parse as a session');
  return session;
};

const provisionDeps = (db: Firestore, host: ServerHost): ProvisionDeps => ({
  clock: { now: () => new Date() },
  host,
  state: serverStateStore(db),
  settings: settingsStore(db),
  ledger: provisioningLedger(db),
  serverPassword: () => 'probe',
  members: adminMembershipRecord(db),
  tokens: agentTokens(db),
  agentEndpoint: async () => 'https://example.invalid/agentReport',
  saveKeys: () => ({
    endpoint: 'https://s3.fr-par.scw.cloud',
    region: 'fr-par',
    savesBucket: 'beacon-saves',
    gamesBucket: 'beacon-games',
    accessKey: 'SCWXXXXXXXXXXXXXXXXX',
    secretKey: 'probe',
  }),
});

const watchdogDeps = (db: Firestore, host: ServerHost): WatchdogDeps => ({
  clock: { now: () => new Date() },
  host,
  state: serverStateStore(db),
  settings: settingsStore(db),
  ledger: provisioningLedger(db),
  health: watchdogHealth(db),
  limits: DEFAULT_LIMITS,
});
