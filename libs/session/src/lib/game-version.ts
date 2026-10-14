declare const publication: unique symbol;

/**
 * What identifies one publication of a game by its publisher. Opaque: two
 * publications never share one, and two versions are only ever compared for
 * equality, never ordered.
 */
export type GameVersion = string & { readonly [publication]: true };

/**
 * The only way to build a `GameVersion`, from what a platform returns. Every
 * producer of a version goes through here, because the value of one producer is
 * compared for equality with the value of another.
 */
export function gameVersionFrom(platformValue: unknown): GameVersion | null {
  if (typeof platformValue !== 'string' || !/^[0-9]+$/.test(platformValue)) return null;
  return platformValue as GameVersion;
}
