import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gameVersionFrom } from '@beacon/session';
import { catalogFor } from '@beacon/cloud-init';
import { installedCopy, installedVersion, manifestPathFor } from './steam-manifest.js';

const INSTALL = join('D:', 'SteamLibrary', 'steamapps', 'common', 'Sunkenland Dedicated Server');
const APP = '2667530';

/** As steamcmd writes it after `+force_install_dir`, measured on the depositing machine. */
const COMPLETE = `"AppState"
{
\t"appid"\t\t"2667530"
\t"StateFlags"\t\t"4"
\t"LastUpdated"\t\t"1791464955"
\t"buildid"\t\t"25746735"
\t"TargetBuildID"\t\t"25746735"
}
`;

const reading = (files: Record<string, string>) => (path: string) => files[path];

describe('the manifest of an install', () => {
  it('sits in the install folder itself, named after the application', () => {
    expect(manifestPathFor(INSTALL, APP)).toBe(join(INSTALL, 'steamapps', 'appmanifest_2667530.acf'));
  });
});

describe('installedVersion', () => {
  it('reads the build of a complete install', () => {
    const read = reading({ [manifestPathFor(INSTALL, APP)]: COMPLETE });

    expect(installedVersion(read, INSTALL, APP)).toEqual({ version: '25746735' });
  });

  // The value compared for equality with what the publisher publishes: both
  // go through the one constructor, and this pins that the tool's does.
  it('builds the version the domain builds from the same digits', () => {
    const read = reading({ [manifestPathFor(INSTALL, APP)]: COMPLETE });

    expect(installedVersion(read, INSTALL, APP)).toEqual({ version: gameVersionFrom('25746735') });
  });

  it('reads a manifest written with Windows line endings', () => {
    const read = reading({ [manifestPathFor(INSTALL, APP)]: COMPLETE.replaceAll('\n', '\r\n') });

    expect(installedVersion(read, INSTALL, APP)).toEqual({ version: '25746735' });
  });

  it('refuses an install that carries no manifest', () => {
    const outcome = installedVersion(reading({}), INSTALL, APP);

    expect(outcome).toHaveProperty('refusal');
    expect((outcome as { refusal: string }).refusal).toContain('appmanifest_2667530.acf');
  });

  it('refuses an install whose only manifest is that of another application', () => {
    const read = reading({ [manifestPathFor(INSTALL, '2278520')]: COMPLETE.replace('2667530', '2278520') });

    expect(installedVersion(read, INSTALL, APP)).toHaveProperty('refusal');
  });

  it('refuses an install the manifest says is still downloading', () => {
    const read = reading({ [manifestPathFor(INSTALL, APP)]: COMPLETE.replace('"4"', '"1026"') });
    const outcome = installedVersion(read, INSTALL, APP);

    expect(outcome).toHaveProperty('refusal');
    expect((outcome as { refusal: string }).refusal).toMatch(/not complete/);
  });

  it('refuses a manifest that carries no state', () => {
    const read = reading({ [manifestPathFor(INSTALL, APP)]: COMPLETE.replace(/\t"StateFlags".*\n/, '') });

    expect(installedVersion(read, INSTALL, APP)).toHaveProperty('refusal');
  });

  it.each([
    ['no build', COMPLETE.replace(/\t"buildid".*\n/, '')],
    ['an empty build', COMPLETE.replace('"buildid"\t\t"25746735"', '"buildid"\t\t""')],
    ['a build that is not digits', COMPLETE.replace('"buildid"\t\t"25746735"', '"buildid"\t\t"v1.2"')],
  ])('refuses a manifest with %s', (_, manifest) => {
    const read = reading({ [manifestPathFor(INSTALL, APP)]: manifest });

    expect(installedVersion(read, INSTALL, APP)).toHaveProperty('refusal');
  });
});

describe('the application this tool installs and reads', () => {
  it('is the one the catalogue names for the copy of sunkenland', () => {
    expect(catalogFor('sunkenland').copySteamApp).toBe(APP);
  });
});

describe('installedCopy', () => {
  const COPY = { steamApp: APP, executable: 'Server.exe' };
  const onDisk = (tree: Record<string, string>) => ({
    exists: (path: string) => tree[path] !== undefined,
    readText: (path: string) => tree[path],
  });

  it('reads the build of a complete install that holds the executable', () => {
    const files = onDisk({ [manifestPathFor(INSTALL, APP)]: COMPLETE, [join(INSTALL, 'Server.exe')]: 'MZ' });

    expect(installedCopy(files, INSTALL, COPY)).toEqual({ version: gameVersionFrom('25746735') });
  });

  it('refuses a complete install that does not hold the executable, naming it', () => {
    const files = onDisk({ [manifestPathFor(INSTALL, APP)]: COMPLETE });

    expect(installedCopy(files, INSTALL, COPY)).toEqual({ refusal: expect.stringContaining('Server.exe') });
  });

  it('refuses on the manifest before it looks for the executable', () => {
    const files = onDisk({ [join(INSTALL, 'Server.exe')]: 'MZ' });

    expect(installedCopy(files, INSTALL, COPY)).toEqual({ refusal: expect.stringContaining('appmanifest_2667530.acf') });
  });
});
