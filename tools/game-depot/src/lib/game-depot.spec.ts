import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { fakeObjectApi, type ObjectApi, type ObjectSummary } from '@beacon/scaleway-storage';
import type { GameCopyRecord } from '@beacon/session-record';
import type { Game, GameVersion } from '@beacon/session';
import { SERVER_BINARY, gameArchiveKeyFor, pushGameFiles } from './game-depot.js';

const MANIFEST = `"AppState"
{
\t"appid"\t\t"2667530"
\t"StateFlags"\t\t"4"
\t"buildid"\t\t"25746735"
}
`;

interface RecordDouble extends GameCopyRecord {
  readonly recorded: { game: Game; version: GameVersion }[];
}

function recordDouble(
  options: { depositedVersion?: () => Promise<GameVersion | null>; recordDeposit?: () => Promise<void> } = {},
): RecordDouble {
  const recorded: { game: Game; version: GameVersion }[] = [];
  return {
    recorded,
    depositedVersion: options.depositedVersion ?? (async () => null),
    async recordDeposit(game, version) {
      await options.recordDeposit?.();
      recorded.push({ game, version });
    },
  };
}

let root: string;
let sunkenlandInstall: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'game-depot-spec-'));
  sunkenlandInstall = join(root, 'install');
  mkdirSync(sunkenlandInstall);
  writeFileSync(join(sunkenlandInstall, 'Sunkenland-DedicatedServer.exe'), Buffer.alloc(1024, 7));
  mkdirSync(join(sunkenlandInstall, 'steamapps'));
  writeFileSync(join(sunkenlandInstall, 'steamapps', 'appmanifest_2667530.acf'), MANIFEST);
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
    await pushGameFiles({ api, record: recordDouble(), game: 'sunkenland', from: sunkenlandInstall });
    expect(await api.list('sunkenland/game.tar')).toHaveLength(1);
  });

  // Against an ObjectApi double: what is deposited is read back, and a size
  // that disagrees is a push to redo, not a push to trust. 2.3 GB in one
  // request, and a network that drops makes an object shorter without saying so.
  it('reads back what it deposited, and refuses a size that disagrees', async () => {
    const api = apiThatUndersellsWhatItStored(fakeObjectApi());
    await expect(pushGameFiles({ api, record: recordDouble(), game: 'sunkenland', from: sunkenlandInstall })).rejects.toThrow(/size/);
  });

  // Depositing from the wrong folder costs a transfer and an evening of doubt
  // over the one set of files nobody can push again without the Steam account.
  it('refuses a folder without the executable the catalogue names for the game, before building anything', async () => {
    rmSync(join(sunkenlandInstall, 'Sunkenland-DedicatedServer.exe'));
    const api = fakeObjectApi();

    await expect(pushGameFiles({ api, record: recordDouble(), game: 'sunkenland', from: sunkenlandInstall })).rejects.toThrow(
      /Sunkenland-DedicatedServer\.exe/,
    );
    expect(await api.list('sunkenland/')).toEqual([]);
  });

  it('records the version of what it deposited, once the deposit is read back', async () => {
    const record = recordDouble();

    expect(await pushGameFiles({ api: fakeObjectApi(), record, game: 'sunkenland', from: sunkenlandInstall })).toBe('25746735');
    expect(record.recorded).toEqual([{ game: 'sunkenland', version: '25746735' }]);
  });

  it('records nothing when the deposit it reads back disagrees', async () => {
    const record = recordDouble();
    const api = apiThatUndersellsWhatItStored(fakeObjectApi());

    await expect(pushGameFiles({ api, record, game: 'sunkenland', from: sunkenlandInstall })).rejects.toThrow(/size/);
    expect(record.recorded).toEqual([]);
  });

  it('refuses an install whose version cannot be read, before building anything', async () => {
    rmSync(join(sunkenlandInstall, 'steamapps'), { recursive: true });
    const api = fakeObjectApi();

    await expect(pushGameFiles({ api, record: recordDouble(), game: 'sunkenland', from: sunkenlandInstall })).rejects.toThrow(
      /appmanifest_2667530\.acf/,
    );
    expect(await api.list('sunkenland/')).toEqual([]);
  });

  it('refuses when the record cannot be reached, before building anything', async () => {
    const api = fakeObjectApi();
    const record = recordDouble({ depositedVersion: async () => Promise.reject(new Error('PERMISSION_DENIED')) });

    await expect(pushGameFiles({ api, record, game: 'sunkenland', from: sunkenlandInstall })).rejects.toThrow(/record/);
    expect(await api.list('sunkenland/')).toEqual([]);
  });

  it('says the archive is deposited and its version is not, when recording fails after the deposit', async () => {
    const api = fakeObjectApi();
    const record = recordDouble({ recordDeposit: async () => Promise.reject(new Error('UNAVAILABLE')) });

    await expect(pushGameFiles({ api, record, game: 'sunkenland', from: sunkenlandInstall })).rejects.toThrow(
      /deposited.*25746735.*not recorded.*again/s,
    );
    expect(await api.list('sunkenland/game.tar')).toHaveLength(1);
  });

  it('refuses a game that goes through no copy', async () => {
    await expect(
      pushGameFiles({ api: fakeObjectApi(), record: recordDouble(), game: 'enshrouded', from: sunkenlandInstall }),
    ).rejects.toThrow(/no copy/);
  });
});
