import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import SteamUser from 'steam-user';

/**
 * Reads only: no account, no download, no resource anywhere. Measures where
 * the build an editor publishes can be read from, without the game owner's
 * account, and whether the local install says which build it is.
 *
 *   npm --prefix probe run steam:version -- [--app=2667530] [--install=<folder>]
 */
function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

const APP_ID = Number(argValue('app') ?? '2667530');
const INSTALL =
  argValue('install') ?? 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Sunkenland Dedicated Server';
const RUNS = 3;

interface PublicBranch {
  readonly buildid?: string;
  readonly timeupdated?: string;
}

async function timed<T>(work: () => Promise<T>): Promise<{ readonly value: T; readonly ms: number }> {
  const start = performance.now();
  const value = await work();
  return { value, ms: Math.round(performance.now() - start) };
}

/** One anonymous session per call, on purpose: a Function starts cold. */
function fromSteam(appId: number): Promise<PublicBranch> {
  return new Promise((resolve, reject) => {
    const client = new SteamUser({ autoRelogin: false });
    const giveUp = setTimeout(() => {
      client.logOff();
      reject(new Error('no answer from Steam within 30 s'));
    }, 30_000);
    client.on('error', (error) => {
      clearTimeout(giveUp);
      reject(error);
    });
    client.on('loggedOn', () => {
      client
        .getProductInfo([appId], [], true)
        .then((info) => {
          clearTimeout(giveUp);
          client.logOff();
          const app = info.apps[appId];
          if (app === undefined) {
            reject(new Error(`Steam returned nothing for ${appId}; unknown: ${JSON.stringify(info.unknownApps)}`));
            return;
          }
          resolve(app.appinfo?.depots?.branches?.public ?? {});
        })
        .catch((error: unknown) => {
          clearTimeout(giveUp);
          client.logOff();
          reject(error);
        });
    });
    client.logOn({ anonymous: true });
  });
}

async function fromSteamcmdNet(appId: number): Promise<PublicBranch> {
  const response = await fetch(`https://api.steamcmd.net/v1/info/${appId}`, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`api.steamcmd.net answered ${response.status}`);
  const body = (await response.json()) as {
    data?: Record<string, { depots?: { branches?: { public?: PublicBranch } } }>;
  };
  return body.data?.[String(appId)]?.depots?.branches?.public ?? {};
}

async function fromSteamWebApi(appId: number): Promise<string> {
  const response = await fetch(
    `https://api.steampowered.com/ISteamApps/UpToDateCheck/v1/?appid=${appId}&version=0`,
    { signal: AbortSignal.timeout(30_000) },
  );
  return `${response.status} ${(await response.text()).trim()}`;
}

async function measure(label: string, read: () => Promise<PublicBranch>): Promise<void> {
  for (let run = 1; run <= RUNS; run += 1) {
    try {
      const { value, ms } = await timed(read);
      console.log(`${label} #${run}: buildid=${value.buildid ?? 'absent'} timeupdated=${value.timeupdated ?? 'absent'} in ${ms} ms`);
    } catch (error) {
      console.log(`${label} #${run}: FAILED ${String(error)}`);
    }
  }
}

console.log(`app ${APP_ID}, ${new Date().toISOString()}, node ${process.version}`);

await measure('steam anonymous', () => fromSteam(APP_ID));
await measure('api.steamcmd.net', () => fromSteamcmdNet(APP_ID));
console.log(`steam web api UpToDateCheck: ${await fromSteamWebApi(APP_ID).catch(String)}`);

// Two places a manifest can sit: inside the install when steamcmd was given
// `force_install_dir`, next to `common/` when a Steam library installed it.
const manifestName = `appmanifest_${APP_ID}.acf`;
for (const [where, path] of [
  ['inside the install', join(INSTALL, 'steamapps', manifestName)],
  ['in the library', join(INSTALL, '..', '..', manifestName)],
] as const) {
  if (!existsSync(path)) {
    console.log(`manifest ${where}: absent`);
    continue;
  }
  const text = readFileSync(path, 'utf8');
  const field = (name: string) => new RegExp(`"${name}"\\s+"([^"]*)"`).exec(text)?.[1] ?? 'absent';
  console.log(
    `manifest ${where}: buildid=${field('buildid')} TargetBuildID=${field('TargetBuildID')} ` +
      `StateFlags=${field('StateFlags')} LastUpdated=${field('LastUpdated')}`,
  );
}

process.exit(0);
