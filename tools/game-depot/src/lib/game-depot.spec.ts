import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeObjectApi, type ObjectApi, type ObjectSummary } from '@beacon/scaleway-storage';
import { SERVER_BINARY, gameArchiveKeyFor, pushGameFiles } from './game-depot.js';

let root: string;
let sunkenlandInstall: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'game-depot-spec-'));
  sunkenlandInstall = join(root, 'install');
  mkdirSync(sunkenlandInstall);
  writeFileSync(join(sunkenlandInstall, 'Sunkenland-DedicatedServer.exe'), Buffer.alloc(1024, 7));
});

/** A double that accepts every deposit but lies about what it holds. */
function apiThatUndersellsWhatItStored(real: ObjectApi): ObjectApi {
  return {
    ...real,
    async list(prefix: string): Promise<ObjectSummary[]> {
      const summaries = await real.list(prefix);
      return summaries.map((summary) => ({ ...summary, sizeBytes: summary.sizeBytes - 1 }));
    },
  };
}

describe('the archive key', () => {
  // The same literal value the cloud-init writes into BEACON_GAME_FILES_KEY.
  // Two places, and nothing ties them together but this test — exactly like
  // keys.spec.ts ties the save key format.
  it('names the archive the companion will look for', () => {
    expect(gameArchiveKeyFor('sunkenland')).toBe('sunkenland/game.tar');
  });

  // §4: this tool does not know the save prefix, and that is its main
  // feature. The day someone gives it a second verb, this is the test that
  // says the boundary moved.
  it('builds no key that could name a save', () => {
    expect(gameArchiveKeyFor('sunkenland')).not.toContain('saves/');
  });
});

describe('the server binary', () => {
  // The second literal spanning two projects that cannot import each other:
  // this tool refuses a folder without it, and
  // `deploy/cloud-init/src/lib/sunkenland.ts` hands the same name to `wine`.
  // Its twin there pins this exact string. Nothing else ties them: the smoke
  // barrier runs a stub game and never executes that `wine` line, so a drift
  // reaches production mute — no server, no identifier in the log, no join
  // point, and a session that dies of the provisioning delay.
  it('names the file the cloud-init actually launches', () => {
    expect(SERVER_BINARY).toBe('Sunkenland-DedicatedServer.exe');
  });
});

describe('pushing game files', () => {
  it('deposits the archive under the game archive key', async () => {
    const api = fakeObjectApi();
    await pushGameFiles({ api, game: 'sunkenland', from: sunkenlandInstall });
    expect(await api.list('sunkenland/game.tar')).toHaveLength(1);
  });

  // Against an ObjectApi double: what is deposited is read back, and a size
  // that disagrees is a push to redo, not a push to trust. 2.3 GB in one
  // request, and a network that drops makes an object shorter without saying so.
  it('reads back what it deposited, and refuses a size that disagrees', async () => {
    const api = apiThatUndersellsWhatItStored(fakeObjectApi());
    await expect(pushGameFiles({ api, game: 'sunkenland', from: sunkenlandInstall })).rejects.toThrow(/size/);
  });

  // Depositing 2.3 GB from the wrong folder costs a minute of transfer and an
  // evening of doubt — over the one set of files nobody can push again
  // without the Steam account.
  it('refuses a source folder that does not hold the server', async () => {
    const empty = join(root, 'empty');
    mkdirSync(empty);
    const api = fakeObjectApi();
    await expect(pushGameFiles({ api, game: 'sunkenland', from: empty })).rejects.toThrow(
      /Sunkenland-DedicatedServer\.exe/,
    );
  });
});
