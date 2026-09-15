import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { SAVE_FLOOR_BYTES, type SaveDraft } from '@beacon/session';
import { fakeObjectApi, type FakeObjectApi } from './fake-object-api.js';
import { ScalewaySaveStore } from './scaleway-save-store.js';

const DRAFT: SaveDraft = {
  worldId: 'les-copains',
  sessionId: 's1',
  origin: 'pre-shutdown',
  createdAt: new Date('2026-09-07T20:04:26Z'),
};

let api: FakeObjectApi;
let store: ScalewaySaveStore;
let folder: string;

const archiveOf = (bytes: number, name = 'world.tar.gz'): string => {
  const path = join(folder, name);
  writeFileSync(path, Buffer.alloc(bytes, 7));
  return path;
};

beforeEach(() => {
  api = fakeObjectApi();
  store = new ScalewaySaveStore(api);
  folder = mkdtempSync(join(tmpdir(), 'beacon-saves-'));
});

describe('ScalewaySaveStore', () => {
  it('deposits under the key the draft describes, and answers what it wrote', async () => {
    const save = await store.deposit(archiveOf(50_000), DRAFT);
    expect(save.objectKey).toBe('pre-shutdown/les-copains/2026-09-07T20-04-26Z-s1.tar.gz');
    expect(save.sizeBytes).toBe(50_000);
    expect(api.stored.has(save.objectKey)).toBe(true);
  });

  // §8, et ça ne coûte rien : la taille est lue pour construire le `Save`, et
  // `Save` est le plancher. Une archive suspecte est refusée avant qu'un seul
  // octet ne quitte la machine, une ligne de défense de plus que le spec ne
  // demande.
  it('refuses an archive under the floor before uploading anything', async () => {
    await expect(store.deposit(archiveOf(SAVE_FLOOR_BYTES - 1), DRAFT)).rejects.toThrow(
      /1024/,
    );
    expect(api.stored.size).toBe(0);
  });

  it('never writes twice under the same key', async () => {
    await store.deposit(archiveOf(50_000, 'a.tar.gz'), DRAFT);
    await store.deposit(archiveOf(60_000, 'b.tar.gz'), {
      ...DRAFT,
      createdAt: new Date('2026-09-07T20:14:26Z'),
    });
    expect(api.stored.size).toBe(2);
  });

  it('lists this world newest first, and ignores the other one', async () => {
    await store.deposit(archiveOf(50_000, 'a.tar.gz'), {
      ...DRAFT,
      createdAt: new Date('2026-09-07T20:04:26Z'),
    });
    await store.deposit(archiveOf(60_000, 'b.tar.gz'), {
      ...DRAFT,
      createdAt: new Date('2026-09-07T21:04:26Z'),
    });
    await store.deposit(archiveOf(70_000, 'c.tar.gz'), {
      ...DRAFT,
      worldId: 'les-autres',
      createdAt: new Date('2026-09-07T22:04:26Z'),
    });

    const listed = await store.list('les-copains');
    expect(listed.map((save) => save.createdAt.toISOString())).toEqual([
      '2026-09-07T21:04:26.000Z',
      '2026-09-07T20:04:26.000Z',
    ]);
  });

  // Un objet déposé à la main ne doit pas casser toute la restauration de la
  // soirée. Sauté, jamais jeté — et le log de l'appelant est où ça se voit.
  it('skips an object whose key it did not write', async () => {
    api.stored.set('pre-shutdown/les-copains/by-hand.tar.gz', Buffer.alloc(50_000));
    expect(await store.list('les-copains')).toEqual([]);
  });

  // La même règle à l'entrée : un objet de 12 octets dans le seau n'est pas un
  // monde, et le tendre à une restauration démarrerait un serveur sur rien.
  it('skips an object under the floor', async () => {
    api.stored.set('auto/les-copains/2026-09-01T00-00-00Z-s0.tar.gz', Buffer.alloc(12));
    expect(await store.list('les-copains')).toEqual([]);
  });

  it('fetches an object back to a local file, byte for byte', async () => {
    const save = await store.deposit(archiveOf(50_000), DRAFT);
    const destination = join(folder, 'restored.tar.gz');
    await store.fetch(save, destination);
    expect(readFileSync(destination).byteLength).toBe(50_000);
  });

  // La distinction sur laquelle toute la règle d'or repose, une couche plus
  // haut : un store qui ne peut pas répondre ne doit pas ressembler à un store
  // qui ne tient rien. La tâche 6 est où ça compte — une réponse vide y
  // signifie « générer un monde neuf ».
  it('refuses rather than answering an empty list when the bucket is unreachable', async () => {
    api.breakWith(new Error('connect ETIMEDOUT'));
    await expect(store.list('les-copains')).rejects.toThrow(/ETIMEDOUT/);
  });

  // §5 : trois préfixes, un par origine — pas un listage du seau entier
  // filtré côté client, parce que le seau grossit d'un objet par soirée et
  // par monde, sans fin.
  it('lists one world across its three origins, and no other world', async () => {
    api.stored.set('auto/les-copains/2026-09-07T20-00-00Z-s1.tar.gz', Buffer.alloc(2048, 7));
    api.stored.set('pre-shutdown/les-copains/2026-09-07T22-00-00Z-s1.tar.gz', Buffer.alloc(2048, 7));
    api.stored.set('manual/les-copains/2026-09-01T00-00-00Z.tar.gz', Buffer.alloc(2048, 7));
    api.stored.set('pre-shutdown/les-autres/2026-09-07T22-00-00Z-s2.tar.gz', Buffer.alloc(2048, 7));

    const saves = await store.list('les-copains');
    expect(saves.map((s) => s.origin)).toEqual(['pre-shutdown', 'auto', 'manual']);
    expect(saves.every((s) => s.worldId === 'les-copains')).toBe(true);
  });
});
