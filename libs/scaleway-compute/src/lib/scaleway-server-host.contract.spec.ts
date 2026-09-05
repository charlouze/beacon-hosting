import { config as loadEnv } from 'dotenv';
import { Instancev1, Marketplacev2 } from '@scaleway/sdk';
import { createClient, type Zone } from '@scaleway/sdk-client';
import { afterAll, describe, expect, it } from 'vitest';
import { fromSdk } from './from-sdk.js';
import { ScalewayServerHost } from './scaleway-server-host.js';
import { OWNERSHIP_TAG, sessionTag } from './tags.js';

// Not `dotenv/config`, which reads the .env of the current directory — the
// workspace root. The keys live next to the library that uses them, and a
// silently empty key gives a 401 that reads like a broken contract.
loadEnv({ path: new URL('../../.env', import.meta.url) });

/**
 * Runs against the real account, on demand, never in CI. It answers what a
 * double cannot: does InstanceApi describe the sdk, does the tag filter return
 * what we think, and do the two death paths work where they were measured.
 *
 * Budget: under 0.06 EUR. Billing is per hour of uptime, minimum 60 minutes,
 * each resource counted separately — and the server here never boots, so the
 * disk and the ip are what actually cost. The hour is due whatever the test's
 * real duration.
 */

const SESSION = `contract-${process.env['SCW_CONTRACT_RUN'] ?? 'manual'}`;
const COMMERCIAL_TYPE = 'DEV1-L';
const zone = (process.env['SCW_ZONE'] ?? 'fr-par-1') as Zone;
const projectId = process.env['SCW_PROJECT_ID'] ?? '';

const client = createClient({
  accessKey: process.env['SCW_ACCESS_KEY'] ?? '',
  secretKey: process.env['SCW_SECRET_KEY'] ?? '',
  defaultProjectId: projectId,
  defaultZone: zone,
  defaultRegion: zone.slice(0, zone.lastIndexOf('-')),
});

const sdk = new Instancev1.API(client);
const marketplace = new Marketplacev2.API(client);

// The very translation that runs in production, not a copy of it. That is the
// point: this test answers "does InstanceApi describe the sdk", and it could
// not answer it about a second translation nobody deploys.
const api = fromSdk(sdk, zone);
const host = new ScalewayServerHost(api);
const tags = [OWNERSHIP_TAG, sessionTag(SESSION)];

afterAll(async () => {
  // Belt and braces: whatever the assertions did, nothing tagged survives.
  await host.close(SESSION);
});

describe('ScalewayServerHost against the real account', () => {
  it('sees, then destroys, a flexible ip it owns', async () => {
    const created = await sdk.createIp({ zone, project: projectId, tags });
    expect(created.ip?.tags).toEqual(tags);

    // Tranche 0 measured `tags=` exact on the flexible ip by querying the
    // strict prefix `session:` and finding it empty (probe/RESULTS.md:226).
    // Re-run here through the production translation, as a pair: the
    // positive control proves the full-tag query reaches this ip at all — a
    // query that errored, or came back empty for an unrelated reason, would
    // make the negative below pass for the wrong reason.
    const { ips: byFullTag } = await api.listIps({ tags: [sessionTag(SESSION)] });
    expect(byFullTag.map((ip) => ip.id)).toContain(created.ip?.id);
    const { ips: byPrefix } = await api.listIps({ tags: ['session:'] });
    expect(byPrefix.map((ip) => ip.id)).not.toContain(created.ip?.id);

    const hosted = await host.list();
    expect(hosted.map((h) => h.sessionId)).toContain(SESSION);

    await host.close(SESSION);

    expect((await host.list()).map((h) => h.sessionId)).not.toContain(SESSION);
  }, 120_000);

  // The dangerous path, and the reason this test costs an hour: terminate is
  // refused on a server that never booted, and deleting it leaves the disk.
  it('destroys a never-booted server and its disk', async () => {
    const created = await sdk.createServer({
      zone,
      project: projectId,
      name: `beacon-${SESSION}`,
      commercialType: COMMERCIAL_TYPE,
      image: await resolveImageId(),
      tags,
    });
    // A missing server means the contract itself is broken — fail loudly here
    // rather than let `?? ''` and `?? {}` turn it into a confusing assertion
    // failure three lines down.
    if (created.server === undefined) throw new Error('createServer returned no server');
    // `created.server` is `any` here (see the comment on `api.listServers`
    // below): `open()` — the only place `InstanceApi` would grow a creation
    // method — is tranche 2, so this setup has no checked boundary to route
    // through, unlike everything else in this file. `CreatedServerShape`
    // names the shape the vendor's docs promise, the same way
    // `instance-api.ts` narrows the vendor's surface to what this library
    // trusts — but a declaration proves nothing the compiler can't check.
    // The assertions right after are the actual oracle.
    const server = created.server as CreatedServerShape;
    expect(typeof server.id).toBe('string');
    expect(server.id.length).toBeGreaterThan(0);
    const volumeIds = Object.values(server.volumes).map((volume) => volume.id);
    for (const volumeId of volumeIds) {
      expect(typeof volumeId).toBe('string');
      expect(volumeId.length).toBeGreaterThan(0);
    }
    const serverId = server.id;
    // The server is created and never started: its state is `stopped`, which
    // is exactly the path terminate refuses and the one that strands disks.
    expect(volumeIds.length).toBeGreaterThan(0);

    // The one moment a live, attached volume exists to check against — once
    // `host.close` runs below, the disk is gone. `sweepUnclaimed()` decides
    // stranded-versus-attached with exactly one expression,
    // `volume.server?.id === undefined`, and that field was bound to the SDK
    // by nothing at all until this. Checking the inverse — attached, not
    // stranded — is the only way to check it without orphaning a disk on
    // purpose.
    const { volumes } = await api.listVolumes();
    const attached = volumes.filter((volume) => volumeIds.includes(volume.id));
    expect(attached.map((volume) => volume.id)).toEqual(expect.arrayContaining(volumeIds));
    for (const volume of attached) {
      expect(volume.server?.id).toBe(serverId);
    }

    // Tranche 0 measured `tags=` exact only on the flexible ip, never on a
    // server — and the whole reconciliation's tag-based ownership rests on
    // servers behaving the same way. Same pair as the ip case above: the
    // positive control proves the full-tag query reaches this server, the
    // negative — the strict prefix `session:` — is the actual measurement,
    // extended here from ips to servers.
    const { servers: byFullTag } = await api.listServers({ tags: [sessionTag(SESSION)] });
    expect(byFullTag.map((s) => s.id)).toContain(serverId);
    const { servers: byPrefix } = await api.listServers({ tags: ['session:'] });
    expect(byPrefix.map((s) => s.id)).not.toContain(serverId);

    await host.close(SESSION);

    // Through the translation, not `sdk.listServers` directly. Not because
    // pagination is special: `Instancev1.API`'s own declaration file doesn't
    // resolve under this project's module resolution — its barrel re-exports
    // `./api.utils`, `./content.gen`, `./types.gen` and `./types.utils`
    // without the `.js` extension `nodenext` requires — and `skipLibCheck`
    // swallows that failure into `any` for every method on the class, this
    // one included. `fromSdk`'s explicit `InstanceApi` return type is what
    // restores checking at the boundary; routing through `api` keeps this
    // assertion typed instead of trusting an `any`.
    const { servers } = await api.listServers({ tags: [sessionTag(SESSION)] });
    expect(servers.map((s) => s.id)).not.toContain(serverId);

    for (const volumeId of volumeIds) {
      await expect(sdk.getVolume({ zone, volumeId })).rejects.toThrow();
    }
  }, 300_000);
});

/**
 * `Instancev1.API`'s `createServer` isn't behind `InstanceApi` — `open()` is
 * tranche 2 — so this test's setup has no checked boundary to trust instead.
 * Declared narrowly, next to its only use, for the reason `instance-api.ts`
 * gives for existing at all: the vendor's surface isn't trusted directly. See
 * the comment above `api.listServers` for why the compiler can't check this
 * one either way — the assertions after the cast are what actually do.
 */
interface CreatedServerShape {
  readonly id: string;
  readonly volumes: Record<string, { readonly id: string }>;
}

/**
 * `image` on a server creation wants a uuid, zone- and type-specific;
 * `ubuntu_noble` is a marketplace label. The probe guessed this response shape
 * wrong twice before using the sdk — probe/scaleway/images.ts.
 */
async function resolveImageId(): Promise<string> {
  const { localImages } = await marketplace.listLocalImages({
    imageLabel: 'ubuntu_noble',
    zone,
    pageSize: 100,
  });
  const image = localImages.find((candidate) =>
    (candidate.compatibleCommercialTypes ?? []).includes(COMMERCIAL_TYPE),
  );
  if (image === undefined) throw new Error(`no ubuntu image for ${COMMERCIAL_TYPE} in ${zone}`);
  return image.id;
}
