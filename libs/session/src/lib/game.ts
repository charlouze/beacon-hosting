/**
 * Which game a session opens. Frozen at opening and never changed (§4): the
 * restored world, the container launched and the join point published all
 * depend on it, and no gesture can swap games without destroying the machine
 * — which is precisely another session.
 */
export const GAMES = ['enshrouded', 'sunkenland'] as const;

export type Game = (typeof GAMES)[number];

export function isGame(value: unknown): value is Game {
  return GAMES.includes(value as Game);
}
