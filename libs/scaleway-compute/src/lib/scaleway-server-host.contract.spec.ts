import { config as loadEnv } from 'dotenv';
import { Blockv1, Instancev1, Marketplacev2 } from '@scaleway/sdk';
import { createClient, type Zone } from '@scaleway/sdk-client';
import { afterAll, describe, expect, it } from 'vitest';
import { isDetached } from './block-api.js';
import { blockFromSdk, fromSdk } from './from-sdk.js';
import { marketplaceImages } from './images.js';
import { BLOCK_VOLUME_TYPE } from './instance-api.js';
import { ScalewayServerHost } from './scaleway-server-host.js';
import { serverCreation } from './server-creation.js';
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
 * Budget: under 0.02 EUR. Billing is per hour started, each resource counted
 * separately — and the server here never boots, so what costs is one hour of
 * a flexible ip (0.005 EUR) and one hour of a 40 GB block volume (0.0052 EUR,
 * at the public rate read on 2026-10-08). The hour is due whatever the test's
 * real duration.
 *
 * `open()` is absent from this suite because it boots a billed machine. The
 * creation it composes (`serverCreation`) and the Block API calls it makes are
 * exercised here.
 */

const SESSION = `contract-${process.env['SCW_CONTRACT_RUN'] ?? 'manual'}`;
const COMMERCIAL_TYPE = 'DEV1-L';
/** The size the probe measured a block root volume at. */
const DISK_GB = 40;
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
const block = blockFromSdk(new Blockv1.API(client), zone);
const images = marketplaceImages(marketplace, zone);
const host = new ScalewayServerHost(
  api,
  block,
  images,
  { budgetMs: 30_000, pause: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) },
  () => DISK_GB,
);
const tags = [OWNERSHIP_TAG, sessionTag(SESSION)];

afterAll(async () => {
  // Belt and braces: whatever the assertions did, nothing tagged survives.
  // close() now waits for a volume to detach, and the default hook timeout
  // would cut the safety net before the volume is deleted.
  await host.close(SESSION);
}, 120_000);

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
  // refused on a server that never booted, deleting it leaves the volume, and
  // the volume is unknown to the api that deleted the server.
  it('destroys a never-booted server and its block volume', async () => {
    // The composition `open()` creates from, not a copy of it: the image and
    // the root volume are what this test measures against the provider.
    const creation = await serverCreation(images, {
      name: `beacon-${SESSION}`,
      commercialType: COMMERCIAL_TYPE,
      diskGb: DISK_GB,
      tags,
    });
    if (creation === null) {
      throw new Error(`no ubuntu image for ${COMMERCIAL_TYPE} on a block volume in ${zone}`);
    }
    const created = await sdk.createServer({ zone, project: projectId, ...creation });
    // A missing server means the contract itself is broken — fail loudly here
    // rather than let `?? ''` and `?? {}` turn it into a confusing assertion
    // failure three lines down.
    if (created.server === undefined) throw new Error('createServer returned no server');
    // `created.server` is `any` here (see the comment on `api.listServers`
    // below): this setup creates through `sdk.createServer` directly rather
    // than through `InstanceApi.createServer`, on purpose — it is checking the
    // raw sdk response shape that `open()` is built on, not the adapter's own
    // translation of it, so routing through the adapter here would beg the
    // question. `CreatedServerShape` names the shape the vendor's docs
    // promise; the assertions right after are the actual oracle.
    const server = created.server as CreatedServerShape;
    expect(typeof server.id).toBe('string');
    expect(server.id.length).toBeGreaterThan(0);
    const serverId = server.id;

    // One volume, and a block one: what `open()` tags, and what `close()`
    // sorts by type to know which api deletes it.
    const rootVolumes = Object.values(server.volumes);
    expect(rootVolumes).toHaveLength(1);
    expect(rootVolumes[0].volumeType).toBe(BLOCK_VOLUME_TYPE);
    const volumeId = rootVolumes[0].id;
    expect(typeof volumeId).toBe('string');
    expect(volumeId.length).toBeGreaterThan(0);

    // Born without a tag, and absent from the Instance API's listing: the two
    // facts that make the Block API the only way to it.
    const untagged = await block.listVolumes({ tag: sessionTag(SESSION) });
    expect(untagged.volumes.map((volume) => volume.id)).not.toContain(volumeId);
    const { volumes: local } = await api.listVolumes();
    expect(local.map((volume) => volume.id)).not.toContain(volumeId);

    await block.setVolumeTags({ volumeId, tags });

    // The same pair as for an ip and a server: the full tag reaches the
    // volume, the strict prefix `session:` does not.
    const { volumes: byFullTag } = await block.listVolumes({ tag: sessionTag(SESSION) });
    const listed = byFullTag.find((volume) => volume.id === volumeId);
    if (listed === undefined) throw new Error('the tagged volume is not in the listing by its tag');
    expect([...listed.tags].sort()).toEqual([...tags].sort());
    expect(listed.size).toBe(DISK_GB * 1e9);
    const { volumes: byPrefix } = await block.listVolumes({ tag: 'session:' });
    expect(byPrefix.map((volume) => volume.id)).not.toContain(volumeId);
    const { volumes: whole } = await block.listVolumes({});
    expect(whole.map((volume) => volume.id)).toContain(volumeId);

    // Attached from the creation, before any boot: the references of a listed
    // volume are what `isDetached` reads, for close() and for the sweep.
    expect(listed.references.length).toBeGreaterThan(0);
    expect(isDetached(listed)).toBe(false);

    // The refusal close() retries on. `isStillAttached` reads a 412, and
    // nothing bound that to the sdk's error until this.
    await expect(block.deleteVolume({ volumeId })).rejects.toMatchObject({ status: 412 });

    // Tranche 0 measured `tags=` exact only on the flexible ip, never on a
    // server — and the whole reconciliation's tag-based ownership rests on
    // servers behaving the same way. Same pair as the ip case above: the
    // positive control proves the full-tag query reaches this server, the
    // negative — the strict prefix `session:` — is the actual measurement,
    // extended here from ips to servers.
    const { servers: byServerTag } = await api.listServers({ tags: [sessionTag(SESSION)] });
    expect(byServerTag.map((s) => s.id)).toContain(serverId);
    const { servers: byServerPrefix } = await api.listServers({ tags: ['session:'] });
    expect(byServerPrefix.map((s) => s.id)).not.toContain(serverId);

    // Deletes the server, waits for the volume to detach, deletes it by tag.
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

    const { volumes: after } = await block.listVolumes({});
    expect(after.map((volume) => volume.id)).not.toContain(volumeId);

    // A second deletion, as a sweep and a close() after the same volume make
    // one: `isAlreadyGone` reads a 404, and that is what must come back.
    await expect(block.deleteVolume({ volumeId })).rejects.toMatchObject({ status: 404 });
  }, 300_000);
});

/**
 * This test's setup creates through `sdk.createServer` directly, bypassing
 * `InstanceApi.createServer`, on purpose: it is checking the raw shape
 * `open()` is built on, not the adapter's translation of it. Declared
 * narrowly, next to its only use, for the reason `instance-api.ts` gives for
 * existing at all: the vendor's surface isn't trusted directly. See the
 * comment above `api.listServers` for why the compiler can't check this one
 * either way — the assertions after the cast are what actually do.
 */
interface CreatedServerShape {
  readonly id: string;
  readonly volumes: Record<string, { readonly id: string; readonly volumeType: string }>;
}
