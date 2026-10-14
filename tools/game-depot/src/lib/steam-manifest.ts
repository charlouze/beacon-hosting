import { join } from 'node:path';
import { gameVersionFrom, type Game, type GameVersion } from '@beacon/session';
import { catalogFor } from '@beacon/cloud-init';

export type InstalledVersion = { readonly version: GameVersion } | { readonly refusal: string };

/**
 * Where `steamcmd +force_install_dir` writes the manifest of what it installed:
 * inside the folder this tool archives, measured in `probe/RESULTS.md`,
 * section E. An install made by the Steam client keeps it in its library
 * instead, and is refused for it.
 */
export function manifestPathFor(installDir: string, app: string): string {
  return join(installDir, 'steamapps', `appmanifest_${app}.acf`);
}

/** Measured: 1026 while steamcmd downloads, 4 once it is done. */
const FULLY_INSTALLED = '4';

function field(manifest: string, name: string): string | undefined {
  return new RegExp(`"${name}"\\s+"([^"]*)"`).exec(manifest)?.[1];
}

/**
 * The version of an install, read in its own manifest, or why it cannot be. A
 * folder whose version cannot be read is never deposited: the copy would then
 * be at a version nobody could name.
 */
export function installedVersion(
  readText: (path: string) => string | undefined,
  installDir: string,
  app: string,
): InstalledVersion {
  const path = manifestPathFor(installDir, app);
  const manifest = readText(path);
  if (manifest === undefined) {
    return {
      refusal: `${path} is missing, so the version of this install cannot be read. Reinstall it with steamcmd +force_install_dir; game-depot:update prints the exact command`,
    };
  }

  const state = field(manifest, 'StateFlags');
  if (state !== FULLY_INSTALLED) {
    return { refusal: `${path} says the install is not complete (StateFlags ${state ?? 'absent'}). Let steamcmd finish it` };
  }

  const version = gameVersionFrom(field(manifest, 'buildid'));
  if (version === null) return { refusal: `${path} names no build, so the version of this install cannot be read` };
  return { version };
}

/** The application the copy of a game holds. A game that goes through no copy has nothing to deposit here. */
export function copySteamAppOf(game: Game): string {
  const app = catalogFor(game).copySteamApp;
  if (app === null) throw new Error(`${game} goes through no copy: nothing of it is deposited`);
  return app;
}
