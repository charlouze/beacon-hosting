// The shim must travel with this source: a project that compiles it through a path alias does not see the lib's other files.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./steam-user.d.ts" />
import { gameVersionFrom, type Game, type GamePublisher, type PublishedVersion } from '@beacon/session';

/** The part of a `steam-user` client this adapter uses. Steam's model stops at this file. */
export interface SteamClient {
  on(event: 'loggedOn', listener: () => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
  logOn(details: { anonymous: true }): void;
  logOff(): void;
  getProductInfo(apps: number[], packages: number[], inclTokens: boolean): Promise<unknown>;
}

export type SteamClientFactory = () => SteamClient;

export interface SteamPublisherOptions {
  /** The Steam application a game's copy holds, or null for a game that goes through no copy. */
  readonly appOf: (game: Game) => string | null;
  /**
   * Loads the library, at the first read. A failed load of `steam-user` stays
   * failed until the instance is recycled, because Node caches a failed
   * `import()`; a loader injected here is called again at the next read.
   */
  readonly load?: () => Promise<SteamClientFactory>;
  readonly timeoutMs?: number;
}

const TIMEOUT_MS = 10_000;

export function steamPublisher(options: SteamPublisherOptions): GamePublisher {
  let factory: Promise<SteamClientFactory> | null = null;

  return {
    async publishedVersion(game): Promise<PublishedVersion> {
      const app = options.appOf(game);
      if (app === null) return unreadable(`${game} goes through no copy`);

      let create: SteamClientFactory;
      try {
        factory ??= (options.load ?? loadSteamUser)();
        create = await factory;
      } catch (error) {
        factory = null;
        return unreadable(`steam-user could not be loaded: ${String(error)}`);
      }
      return publicBuildOf(create, Number(app), options.timeoutMs ?? TIMEOUT_MS);
    },
  };
}

/**
 * Loaded at the first read and not with the bundle: `steam-user` reads a file
 * when it loads, and a failure there must leave the other Functions of the
 * bundle untouched.
 */
async function loadSteamUser(): Promise<SteamClientFactory> {
  const loaded = (await import('steam-user')) as { default?: unknown };
  const SteamUser = (loaded.default ?? loaded) as new (options: object) => SteamClient;
  return () => new SteamUser({ dataDirectory: null, autoRelogin: false });
}

/** One anonymous session per read: the build of the public branch, then log off. */
function publicBuildOf(create: SteamClientFactory, app: number, timeoutMs: number): Promise<PublishedVersion> {
  return new Promise((resolve) => {
    let client: SteamClient;
    try {
      client = create();
    } catch (error) {
      resolve(unreadable(`no Steam client: ${String(error)}`));
      return;
    }

    let settled = false;
    const settle = (answer: PublishedVersion): void => {
      if (settled) return;
      settled = true;
      clearTimeout(giveUp);
      try {
        client.logOff();
      } catch {
        // A client that cannot log off is gone already.
      }
      resolve(answer);
    };
    const giveUp = setTimeout(() => settle(unreadable(`no answer from Steam within ${timeoutMs} ms`)), timeoutMs);

    // Never removed: an error after the delay finds a listener, and settles nothing.
    client.on('error', (error) => settle(unreadable(`Steam refused: ${String(error)}`)));
    client.on('loggedOn', () => {
      // A late loggedOn must not ask a logged-off client: steam-user arms a 60-minute timer on that call.
      if (settled) return;
      client.getProductInfo([app], [], true).then(
        (info) => settle(versionIn(info, app)),
        (error: unknown) => settle(unreadable(`no product info: ${String(error)}`)),
      );
    });
    try {
      client.logOn({ anonymous: true });
    } catch (error) {
      settle(unreadable(`no Steam session: ${String(error)}`));
    }
  });
}

function versionIn(info: unknown, app: number): PublishedVersion {
  const buildid = valueAt(info, 'apps', String(app), 'appinfo', 'depots', 'branches', 'public', 'buildid');
  const version = gameVersionFrom(buildid);
  if (version === null) return unreadable(`no build on the public branch of ${app}: ${String(buildid)}`);
  return { readable: true, version };
}

function valueAt(value: unknown, ...path: string[]): unknown {
  let at = value;
  for (const key of path) {
    if (typeof at !== 'object' || at === null) return undefined;
    at = (at as Record<string, unknown>)[key];
  }
  return at;
}

function unreadable(cause: string): PublishedVersion {
  return { readable: false, cause };
}
