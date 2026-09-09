import { beforeEach, describe, expect, it } from 'vitest';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { adminMembershipRecord, type AdminMembershipRecord } from './admin-membership.js';
import { MEMBERS } from './viewer.js';

// Against the emulator with `firebase-admin`, so the rules do not apply — and
// that is the point: this face is the Functions', which run above them.
//
// A named app rather than the default one: the client face's suite shares this
// runner and builds Firebase apps of its own, and the default app is the one
// thing two independent suites could fight over.
const db = getFirestore(initializeApp({ projectId: 'demo-beacon' }, 'admin-membership'));

const seed = (path: string, data: Record<string, unknown>): Promise<unknown> =>
  db.doc(path).set(data);

let record: AdminMembershipRecord;

beforeEach(async () => {
  const existing = await db.collection(MEMBERS).get();
  await Promise.all(existing.docs.map((doc) => doc.ref.delete()));
  record = adminMembershipRecord(db);
});

describe('the admin face of the membership record', () => {
  // The order is sorted and not "whatever Firestore returned": the cloud-init is
  // written at every provisioning, and two identical evenings must produce two
  // identical files.
  it('lists the steam ids every member declared, sorted', async () => {
    await seed('members/root', { role: 'admin', steamId: '76561197965918116' });
    await seed('members/zoe', { role: 'player', steamId: '11111111111111111' });
    await seed('members/alice', { role: 'player', steamId: '22222222222222222' });

    expect(await record.declaredSteamIds()).toEqual([
      '11111111111111111',
      '22222222222222222',
      '76561197965918116',
    ]);
  });

  // §2 gives the in-game administrator role to **every** member, on the same
  // principle as "anyone starts, extends and stops": the resource is common. The
  // `admin` role of Beacon is another question entirely (§4), and this query has
  // no business asking it.
  it('names a player, the role of Beacon being none of its business', async () => {
    await seed('members/alice', { role: 'player', steamId: '22222222222222222' });

    expect(await record.declaredSteamIds()).toEqual(['22222222222222222']);
  });

  // Declaring one is optional, and §5 says an identifier grants nothing. A member
  // who never declared one is simply not an in-game admin.
  it('skips a member who declared none', async () => {
    await seed('members/root', { role: 'admin' });
    await seed('members/zoe', { role: 'player', steamId: '11111111111111111' });

    expect(await record.declaredSteamIds()).toEqual(['11111111111111111']);
  });

  it('is empty when nobody declared one', async () => {
    await seed('members/root', { role: 'admin' });
    await seed('members/zoe', { role: 'player' });

    expect(await record.declaredSteamIds()).toEqual([]);
  });

  // §5 calls a steam id "a public integer", and says the one consequence of a
  // wrong one is not getting the in-game admin role. That is exactly what this
  // does — and it is also what keeps this value out of a shell: it lands
  // unquoted in the game's launch line, where `$(…)` would run on the machine.
  it('skips a declared value that is not a steam id at all', async () => {
    await seed('members/root', { role: 'admin', steamId: '$(id > /tmp/pwned)' });
    await seed('members/zoe', { role: 'player', steamId: '11111111111111111' });

    expect(await record.declaredSteamIds()).toEqual(['11111111111111111']);
  });
});
