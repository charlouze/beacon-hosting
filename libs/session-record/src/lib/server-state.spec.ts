import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { Deadline, endedWithoutServer, Session, type StateCorrection } from '@beacon/session';
import { abandonedSetupFrom, EVENTS, serverDocPath, toDate } from './fields.js';
import { serverStateStore, type ServerStateStore } from './server-state.js';

process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';

const NOW = new Date('2026-09-04T21:00:00Z');
// A second instant, distinct from NOW, for the tests that write with their
// own `at` instead of relying on the module-level clock.
const AT = new Date('2026-09-04T21:05:00Z');

const SERVER_DOC = serverDocPath('w1');

let app: ReturnType<typeof initializeApp>;
let db: Firestore;
let store: ServerStateStore;

/** Minimal `server/current`, filled in by the parts a test cares about. */
const seedServer = (parts: Record<string, unknown>) => db.doc(SERVER_DOC).set(parts);

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-beacon' }, 'server-state-spec');
  db = getFirestore(app);
  store = serverStateStore(db, 'w1');
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await db.recursiveDelete(db.collection('events'));
  await db.doc(SERVER_DOC).delete();
});

const correction = (parts: Partial<StateCorrection> = {}): StateCorrection => ({
  state: null,
  lastError: null,
  clearFacts: false,
  clearLastError: false,
  deadline: null,
  closeIntents: [],
  abandonedSetup: null,
  events: [],
  ...parts,
});

const apply = (parts: Partial<StateCorrection> = {}) => store.apply(correction(parts), NOW);

describe('serverStateStore', () => {
  it('reads a missing document as null rather than inventing a state', async () => {
    expect(await store.read()).toBeNull();
  });

  it('reads the state, the session and the instant it began', async () => {
    await db.doc(SERVER_DOC).set({
      state: 'RUNNING',
      sessionId: 'sess1',
      stateSince: new Date('2026-09-04T20:30:00Z'),
      instanceId: 'i-1',
    });

    const record = await store.read();

    expect(record).toEqual({
      state: 'RUNNING',
      sessionId: 'sess1',
      stateSince: new Date('2026-09-04T20:30:00Z'),
      hasReservedFacts: true,
    });
  });

  it('reads absent fields as null, and no reserved fact as none', async () => {
    await db.doc(SERVER_DOC).set({ state: 'IDLE' });
    expect(await store.read()).toEqual({
      state: 'IDLE',
      sessionId: null,
      stateSince: null,
      hasReservedFacts: false,
    });
  });

  // One case per reserved field would be five tests saying the same thing.
  // This one says what matters: the domain must see a residue whichever field
  // holds it, and joinInfo is the field the spec added after this was written.
  it('sees a residue held by any reserved field, not just the instance', async () => {
    await db.doc(SERVER_DOC).set({ state: 'IDLE', joinInfo: { serverId: 'abc~123' } });
    expect((await store.read())?.hasReservedFacts).toBe(true);
  });

  it('does not mistake a reserved field explicitly set to null for a residue', async () => {
    await db.doc(SERVER_DOC).set({ state: 'IDLE', instanceId: null, joinInfo: null });
    expect((await store.read())?.hasReservedFacts).toBe(false);
  });

  // The frontier does not invent a state. Reading an unknown value as IDLE
  // would hand the watchdog a fact nobody wrote, in the component that
  // destroys; null means "this document says nothing I know", and the
  // tag-based reclamation carries on regardless — it never needed the record.
  it('reads a state it does not recognise as no state at all', async () => {
    await db.doc(SERVER_DOC).set({ state: 'BANANA', sessionId: 'sess1' });
    expect((await store.read())?.state).toBeNull();
  });

  it('reads a document with no state at all the same way', async () => {
    await db.doc(SERVER_DOC).set({ sessionId: 'sess1' });
    expect((await store.read())?.state).toBeNull();
  });

  it('writes the state and stamps stateSince with it', async () => {
    await db.doc(SERVER_DOC).set({ state: 'RUNNING', sessionId: 'sess1' });

    await apply({ state: 'IDLE', lastError: 'gone' });

    const after = (await db.doc(SERVER_DOC).get()).data();
    expect(after?.['state']).toBe('IDLE');
    expect(after?.['lastError']).toBe('gone');
    expect(after?.['stateSince'].toDate()).toEqual(NOW);
  });

  it('leaves the state alone when the correction says nothing about it', async () => {
    await db.doc(SERVER_DOC).set({ state: 'RUNNING', sessionId: 'sess1' });
    await apply({ clearFacts: true });
    expect((await db.doc(SERVER_DOC).get()).data()?.['state']).toBe('RUNNING');
  });

  // A null lastError leaves the recorded one; only a string replaces it. Wiping
  // it on the way out of FAILED would take away the only thing that tells a
  // player the previous attempt did not work.
  it('keeps the recorded error when the correction carries none', async () => {
    await db.doc(SERVER_DOC).set({ state: 'FAILED', lastError: 'scaleway refused' });

    await apply({ state: 'IDLE', clearFacts: true });

    const after = (await db.doc(SERVER_DOC).get()).data();
    expect(after?.['state']).toBe('IDLE');
    expect(after?.['lastError']).toBe('scaleway refused');
  });

  it('empties the recorded error when the correction says nothing failed', async () => {
    await db.doc(SERVER_DOC).set({ state: 'STOPPING', lastError: 'scaleway refused' });

    await apply({ state: 'IDLE', clearFacts: true, clearLastError: true });

    expect((await db.doc(SERVER_DOC).get()).data()?.['lastError']).toBeNull();
  });

  it('writes the error a correction carries, even when it also says to empty it', async () => {
    await db.doc(SERVER_DOC).set({ state: 'STOPPING', lastError: 'scaleway refused' });

    await apply({ state: 'IDLE', lastError: 'gone', clearLastError: true });

    expect((await db.doc(SERVER_DOC).get()).data()?.['lastError']).toBe('gone');
  });

  it('empties every reserved field without touching the session', async () => {
    await db.doc(SERVER_DOC).set({
      state: 'IDLE',
      sessionId: 'sess1',
      instanceId: 'i-1',
      ipId: 'f-1',
      ip: '51.15.0.1',
      joinInfo: { serverId: 'abc~123' },
      provisionClaimedAt: NOW,
    });

    await apply({ clearFacts: true });

    const after = (await db.doc(SERVER_DOC).get()).data();
    expect(after?.['instanceId']).toBeNull();
    expect(after?.['ipId']).toBeNull();
    expect(after?.['ip']).toBeNull();
    expect(after?.['joinInfo']).toBeNull();
    expect(after?.['provisionClaimedAt']).toBeNull();
    expect(after?.['sessionId']).toBe('sess1');
  });

  // The one that would kill the product. provisionClaimedAt is the lock that
  // makes onServerStateChange abandon a duplicated trigger (§6, étape 3). Left
  // behind on the way to IDLE, it makes the Function abandon the NEXT session
  // too, and every one after it: the button works, nothing ever happens, and
  // only a console fixes it.
  it('releases the provisioning claim, so a next session can be born at all', async () => {
    await db.doc(SERVER_DOC).set({ state: 'STOPPING', provisionClaimedAt: NOW });

    await apply({ state: 'IDLE', clearFacts: true });

    expect((await db.doc(SERVER_DOC).get()).data()?.['provisionClaimedAt']).toBeNull();
  });

  // A stale join point is a copiable address to a machine that no longer
  // exists — and for Sunkenland the server id changes at every boot, so it can
  // never be right again (§4).
  it('erases the join point, which outlives its server otherwise', async () => {
    await db.doc(SERVER_DOC).set({ state: 'RUNNING', joinInfo: { serverId: 'abc~123' } });

    await apply({ state: 'IDLE', clearFacts: true });

    expect((await db.doc(SERVER_DOC).get()).data()?.['joinInfo']).toBeNull();
  });

  // Both written is not the same claim as both written at once, and two
  // sequential commits would satisfy the first. Firestore stamps every write
  // of one WriteBatch with the same commit timestamp, so the two stamps being
  // equal is what says "one batch" — and §8 answers "state written but audit
  // entry missing" with atomicity, not with a retry.
  it('writes the state and its event together, in one commit', async () => {
    await db.doc(SERVER_DOC).set({ state: 'RUNNING', sessionId: 'sess1' });

    await apply({
      state: 'IDLE',
      events: [{ type: 'SessionStopped', sessionId: 'sess1', detail: 'gone', costEuros: 0 }],
    });

    const events = await db.collection('events').get();
    expect(events.size).toBe(1);
    const server = await db.doc(SERVER_DOC).get();
    expect(server.data()?.['state']).toBe('IDLE');
    expect(server.updateTime?.isEqual(events.docs[0].createTime)).toBe(true);
  });

  // §11: SessionStopped is the one event the month is summed from. Asserting
  // on the domain event object would have passed even with a writer that
  // drops the field — this reads the document back from the emulator, the
  // way the actual defect went unnoticed. A non-zero figure matters too: 0 is
  // also what a dropped field reads back as.
  it('round-trips the cost a SessionStopped carries, so the month can be totalled', async () => {
    await db.doc(SERVER_DOC).set({ state: 'RUNNING', sessionId: 'sess1' });

    await apply({
      state: 'IDLE',
      events: [{ type: 'SessionStopped', sessionId: 'sess1', detail: 'gone', costEuros: 0.42 }],
    });

    const [event] = (await db.collection('events').get()).docs;
    expect(event.data()['costEuros']).toBe(0.42);
  });

  it('writes several events in one go', async () => {
    await apply({
      events: [
        { type: 'SessionReclaimed', sessionId: 's1', detail: 'a' },
        { type: 'ResourceStranded', sessionId: null, detail: 'volume v-1 (80 GB)' },
      ],
    });
    expect((await db.collection('events').get()).size).toBe(2);
  });

  it('signs every event as the system, since no human asked', async () => {
    await apply({ events: [{ type: 'SessionReclaimed', sessionId: 's1', detail: 'a' }] });

    const [event] = (await db.collection('events').get()).docs;
    expect(event.data()['actor']).toEqual({ uid: 'system', name: 'system' });
    expect(event.data()['at'].toDate()).toEqual(NOW);
  });

  // §5 gives events a 400-day ttl, and the ttl policy needs a field to read.
  it('gives every event the expiry the ttl policy reads', async () => {
    await apply({ events: [{ type: 'SessionReclaimed', sessionId: 's1', detail: 'a' }] });

    const [event] = (await db.collection('events').get()).docs;
    const expiresAt: Date = event.data()['expiresAt'].toDate();
    expect(Math.round((expiresAt.getTime() - NOW.getTime()) / 86_400_000)).toBe(400);
  });

  it('carries a null sessionId through rather than dropping the field', async () => {
    await apply({ events: [{ type: 'ResourceStranded', sessionId: null, detail: 'volume v-1' }] });
    const [event] = (await db.collection('events').get()).docs;
    expect(event.data()['sessionId']).toBeNull();
  });
});

describe('claiming the provisioning', () => {
  // §6 étape 3, §8: Firestore triggers are delivered at least once. Without
  // this claim a double delivery creates two billed machines, and the second
  // is invisible to everything but the invoice.
  it('claims once and refuses every claim after it', async () => {
    await seedServer({ state: 'PROVISIONING', sessionId: 's1' });
    const store = serverStateStore(db, 'w1');
    expect(await store.claimProvisioning('s1', AT)).toBe(true);
    expect(await store.claimProvisioning('s1', AT)).toBe(false);
  });

  it('refuses a claim for a session the document does not name', async () => {
    await seedServer({ state: 'PROVISIONING', sessionId: 's1' });
    expect(await serverStateStore(db, 'w1').claimProvisioning('s2', AT)).toBe(false);
  });

  it('refuses a claim on a state that is no longer provisioning', async () => {
    await seedServer({ state: 'IDLE', sessionId: 's1' });
    expect(await serverStateStore(db, 'w1').claimProvisioning('s1', AT)).toBe(false);
  });

  // Nothing else ever puts it back to null. Without this, a
  // ProvisioningFailed from three evenings ago rides along on every healthy
  // session that follows, and the interface keeps saying the last attempt
  // failed about an attempt that succeeded.
  it('drops the error of the attempt before, since this one answers for itself', async () => {
    await seedServer({ state: 'PROVISIONING', sessionId: 's1', lastError: 'scaleway refused' });

    expect(await serverStateStore(db, 'w1').claimProvisioning('s1', AT)).toBe(true);

    expect((await db.doc(SERVER_DOC).get()).data()?.['lastError']).toBeNull();
  });

  it('leaves the recorded error alone when it refuses the claim', async () => {
    await seedServer({ state: 'IDLE', sessionId: 's1', lastError: 'scaleway refused' });

    expect(await serverStateStore(db, 'w1').claimProvisioning('s1', AT)).toBe(false);

    expect((await db.doc(SERVER_DOC).get()).data()?.['lastError']).toBe('scaleway refused');
  });
});

describe('publishing the facts', () => {
  it('writes the reserved fields and turns the state to RUNNING', async () => {
    await seedServer({ state: 'PROVISIONING', sessionId: 's1' });
    await serverStateStore(db, 'w1').publish(
      {
        ip: '51.15.42.7',
        joinInfo: { game: 'enshrouded', hostname: 'h', address: '51.15.42.7', port: 15637 },
        instanceSize: 'DEV1-L',
        references: { instanceId: 'srv-1', ipId: 'ip-1' },
      },
      AT,
    );
    const data = (await db.doc(SERVER_DOC).get()).data() ?? {};
    expect(data['state']).toBe('RUNNING');
    expect(data['instanceId']).toBe('srv-1');
    expect(data['ipId']).toBe('ip-1');
    expect(data['ip']).toBe('51.15.42.7');
    expect(data['joinInfo']).toMatchObject({ port: 15637 });
    // Recopied so that a default size changed mid-session cannot make the
    // shown estimate drift (§6 étape 7).
    expect(data['instanceSize']).toBe('DEV1-L');
    expect(toDate(data['stateSince'])).toEqual(AT);
  });
});

describe('applying a deadline', () => {
  it('writes a clamped deadline and its audit line in one commit', async () => {
    await seedServer({ state: 'RUNNING', sessionId: 's1' });
    await serverStateStore(db, 'w1').apply(
      {
        state: null,
        lastError: null,
        clearFacts: false,
        clearLastError: false,
        deadline: Deadline.at(new Date('2026-09-07T00:00:00Z')),
        closeIntents: [],
        abandonedSetup: null,
        events: [{ type: 'DeadlineClamped', sessionId: 's1', detail: 'brought back to 4 h' }],
      },
      AT,
    );
    const data = (await db.doc(SERVER_DOC).get()).data() ?? {};
    expect(toDate(data['deadline'])).toEqual(new Date('2026-09-07T00:00:00Z'));
    // The state did not move, so `stateSince` must not either: the delays of
    // §6 are measured on it, and touching it would restart the clock on a
    // STOPPING that has been stuck for nine minutes.
    expect(data['stateSince']).toBeUndefined();
    const events = await db.collection(EVENTS).get();
    expect(events.docs.map((d) => d.get('type'))).toEqual(['DeadlineClamped']);
  });
});

describe('the mark of an abandoned setup', () => {
  const MARK = { sessionId: 's1', at: AT, cause: null };
  const current = async () => (await db.doc(SERVER_DOC).get()).data() ?? {};

  it('is written with the state, in the same write, at the instant of the pass', async () => {
    await seedServer({ state: 'PROVISIONING', sessionId: 's1', ip: '51.15.42.7' });

    await apply({ state: 'IDLE', clearFacts: true, abandonedSetup: { sessionId: 's1', cause: null } });

    const after = await current();
    expect(after['state']).toBe('IDLE');
    expect(abandonedSetupFrom(after)).toEqual({ sessionId: 's1', at: NOW, cause: null });
  });

  it('writes the cause of a preflight check that failed with the mark', async () => {
    await apply({ state: 'IDLE', clearFacts: true, abandonedSetup: { sessionId: 's1', cause: 'copy-behind' } });

    expect(abandonedSetupFrom(await current())).toEqual({ sessionId: 's1', at: NOW, cause: 'copy-behind' });
  });

  // The retry that clears a blocked session abandons nothing: the mark it
  // finds is the one thing that still says where the setup stopped.
  it('is left alone by a correction that abandons nothing, even one that empties the facts', async () => {
    await seedServer({ state: 'FAILED', sessionId: 's1', abandonedSetup: MARK });

    await apply({ state: 'IDLE', clearFacts: true });

    expect(abandonedSetupFrom(await current())).toEqual(MARK);
  });

  it('is erased by the claim of the next setup, since that one answers for itself', async () => {
    await seedServer({ state: 'PROVISIONING', sessionId: 's2', abandonedSetup: MARK });

    expect(await store.claimProvisioning('s2', AT)).toBe(true);

    expect((await current())['abandonedSetup']).toBeNull();
  });

  it('is left alone by a claim that is refused', async () => {
    await seedServer({ state: 'IDLE', sessionId: 's2', abandonedSetup: MARK });

    expect(await store.claimProvisioning('s2', AT)).toBe(false);

    expect(abandonedSetupFrom(await current())).toEqual(MARK);
  });
});

describe('applying under a condition', () => {
  const CLAIMED_AT = new Date('2026-09-04T20:55:00Z');
  const seed = (parts: Record<string, unknown>) => seedServer(parts);
  const serverDoc = async () => (await db.doc(SERVER_DOC).get()).data() ?? {};
  const eventsOf = async (sessionId: string) =>
    (await db.collection(EVENTS).where('sessionId', '==', sessionId).get()).docs.map((d) =>
      d.data(),
    );
  const stoppingSession = (sessionId: string) =>
    Session.from({
      state: 'STOPPING',
      sessionId,
      worldId: 'w1',
      game: 'enshrouded',
      startedBy: 'u1',
      startedAt: new Date('2026-09-04T20:00:00Z'),
      deadline: Deadline.at(new Date('2026-09-05T00:00:00Z')),
      instanceSize: null,
      hasJoinInfo: false,
    });
  const endWithoutServer = (sessionId: string) => endedWithoutServer(stoppingSession(sessionId));

  it('writes the correction and its events while the session is the expected one', async () => {
    await seed({ state: 'STOPPING', sessionId: 's1', provisionClaimedAt: null });

    const applied = await store.applyIf(
      { sessionId: 's1', state: 'STOPPING' },
      endWithoutServer('s1'),
      AT,
    );

    expect(applied).toBe(true);
    expect((await serverDoc())['state']).toBe('IDLE');
    expect(await eventsOf('s1')).toEqual([
      expect.objectContaining({ type: 'SessionStopped', costEuros: 0 }),
    ]);
  });

  it('writes nothing when the world holds another session', async () => {
    await seed({ state: 'STOPPING', sessionId: 's2', provisionClaimedAt: null });
    expect(
      await store.applyIf({ sessionId: 's1', state: 'STOPPING' }, endWithoutServer('s1'), AT),
    ).toBe(false);
    expect((await serverDoc())['state']).toBe('STOPPING');
    expect(await eventsOf('s1')).toEqual([]);
  });

  it('writes nothing when the session is in another state', async () => {
    await seed({ state: 'IDLE', sessionId: 's1', provisionClaimedAt: null });
    expect(
      await store.applyIf({ sessionId: 's1', state: 'STOPPING' }, endWithoutServer('s1'), AT),
    ).toBe(false);
  });

  it('writes nothing for a claimed session when the condition wants it unclaimed', async () => {
    await seed({ state: 'STOPPING', sessionId: 's1', provisionClaimedAt: CLAIMED_AT });
    expect(
      await store.applyIf(
        { sessionId: 's1', state: 'STOPPING', unclaimed: true },
        endWithoutServer('s1'),
        AT,
      ),
    ).toBe(false);
    expect((await serverDoc())['state']).toBe('STOPPING');
  });

  it('releases the claim, so the next opening can claim it', async () => {
    await seed({ state: 'STOPPING', sessionId: 's1', provisionClaimedAt: CLAIMED_AT });
    await store.applyIf({ sessionId: 's1', state: 'STOPPING' }, endWithoutServer('s1'), AT);
    await db.doc(SERVER_DOC).set({ state: 'PROVISIONING', sessionId: 's2' }, { merge: true });

    expect(await store.claimProvisioning('s2', AT)).toBe(true);
  });
});
