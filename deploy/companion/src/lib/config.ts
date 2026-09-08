import { isGame, type Game } from '@beacon/session';

/**
 * Everything the machine was told at first boot. **The companion knows no
 * game** — §4 makes `deploy/cloud-init/games/` the only place in the repository
 * that knows a server listens on `15637/udp` or that its world lives under
 * `savegame/`. Which folder to move, which owner it needs and which port
 * answers all arrive here as values, so the second game costs a catalogue entry
 * and not a branch in this file.
 */
export interface CompanionConfig {
  readonly sessionId: string;
  readonly game: Game;
  readonly token: string;
  readonly endpoint: string;
  readonly s3: {
    readonly endpoint: string;
    readonly region: string;
    readonly accessKey: string;
    readonly secretKey: string;
  };
  readonly savesBucket: string;
  readonly gamesBucket: string;
  readonly saveDir: string;
  /** `uid:gid`, because the game server does not run as root and the restore does. */
  readonly saveOwner: string;
  /**
   * How readiness is observed for this game, as a url naming the mechanism:
   * `a2s://host:port` for a game that answers a query, `serverid://path` for
   * one whose join point only the machine discovers. `readiness.ts` holds the
   * list; a form it cannot read is a catalogue entry to fix.
   */
  readonly readyProbe: string;
  readonly stopFlag: string;
  /**
   * How often the world is pushed. Per game, unlike the report cadence: it
   * tracks what the game itself writes — ten minutes for one, five for the
   * other — so it is the catalogue that knows it (§4).
   */
  readonly pushIntervalMs: number;
  /** Where archives are built. Not the save folder: never write inside a world. */
  readonly workDir: string;
  /**
   * Only the game whose 2.3 GB cannot come from SteamCMD writes this pair —
   * the other downloads its own files and leaves both variables unset.
   * Absent, `runRestore` moves the world alone; present, both members are
   * required, because a folder with nothing to fetch into it is as broken as
   * a key with nowhere to land.
   */
  readonly gameFiles?: {
    readonly objectKey: string;
    readonly directory: string;
  };
}

type Env = Record<string, string | undefined>;

function required(env: Env, name: string): string {
  const value = env[name];
  // Named, and it fails now. The probe's start script taught this: refusing at
  // launch beats failing three minutes into a boot with an unreadable message.
  if (value === undefined || value === '') {
    throw new Error(`${name} is required and the cloud-init did not write it`);
  }
  return value;
}

function requiredNumber(env: Env, name: string): number {
  const value = Number(required(env, name));
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number of milliseconds`);
  }
  return value;
}

/**
 * Two variables or none. Reading each with `required` when either is present
 * makes the missing one name itself in the thrown message, the same way every
 * other variable in this file already does — a second, bespoke message would
 * only drift from that one over time.
 */
function readGameFiles(env: Env): CompanionConfig['gameFiles'] {
  if (env['BEACON_GAME_FILES_KEY'] === undefined && env['BEACON_GAME_DIR'] === undefined) {
    return undefined;
  }
  return {
    objectKey: required(env, 'BEACON_GAME_FILES_KEY'),
    directory: required(env, 'BEACON_GAME_DIR'),
  };
}

export function readConfig(env: Env): CompanionConfig {
  const game = required(env, 'BEACON_GAME');
  if (!isGame(game)) {
    throw new Error(`BEACON_GAME names no game this system knows: ${game}`);
  }

  return {
    sessionId: required(env, 'BEACON_SESSION_ID'),
    game,
    token: required(env, 'BEACON_TOKEN'),
    endpoint: required(env, 'BEACON_ENDPOINT'),
    s3: {
      endpoint: required(env, 'BEACON_S3_ENDPOINT'),
      region: required(env, 'BEACON_S3_REGION'),
      accessKey: required(env, 'BEACON_S3_ACCESS_KEY'),
      secretKey: required(env, 'BEACON_S3_SECRET_KEY'),
    },
    savesBucket: required(env, 'BEACON_SAVES_BUCKET'),
    gamesBucket: required(env, 'BEACON_GAMES_BUCKET'),
    saveDir: required(env, 'BEACON_SAVE_DIR'),
    saveOwner: required(env, 'BEACON_SAVE_OWNER'),
    readyProbe: required(env, 'BEACON_READY_PROBE'),
    stopFlag: required(env, 'BEACON_STOP_FLAG'),
    pushIntervalMs: requiredNumber(env, 'BEACON_PUSH_INTERVAL_MS'),
    workDir: env['BEACON_WORK_DIR'] ?? '/tmp/beacon',
    gameFiles: readGameFiles(env),
  };
}
