/**
 * What the player copies to join. The domain never reads any of these fields:
 * it carries the value and knows only whether it exists — `RUNNING` means the
 * join point is published (§4).
 *
 * Two shapes, and the second game is what revealed it. As long as there was
 * one, "joining" was spelled `ip` and nobody saw the confusion. What the two
 * have in common is not an address, it is *what the player copies*.
 *
 * Both shapes carry a main way and a fallback, which `PRODUCT.md` asked for
 * before either existed: the raw address when dns fails, the world's name in
 * the server list when the identifier is lost.
 *
 * The discriminant is `game` and not a separate `kind`: a session already
 * carries its game, frozen at opening, and a second field saying the same
 * thing could disagree with the first.
 */
export interface EnshroudedJoinInfo {
  readonly game: 'enshrouded';
  /** The main way in. */
  readonly hostname: string;
  /** The fallback, for the evening dns is down (§8). */
  readonly address: string;
  readonly port: number;
}

/**
 * Measured on 2026-09-05: no floating ip and no dns record serve this game.
 * The identifier is regenerated at every boot — it is the world's guid
 * followed by the boot instant — so it cannot be known in advance, and the
 * world's name is how a player finds the server when it is lost.
 *
 * Produced from tranche 3, with the catalogue entry that boots this game.
 */
export interface SunkenlandJoinInfo {
  readonly game: 'sunkenland';
  readonly serverId: string;
  readonly region: string;
  readonly worldName: string;
}

export type JoinInfo = EnshroudedJoinInfo | SunkenlandJoinInfo;

export function isEnshroudedJoinInfo(info: JoinInfo): info is EnshroudedJoinInfo {
  return info.game === 'enshrouded';
}

/**
 * Whether publishing this join point means pointing a dns record somewhere.
 * True for one game, false for the other — and it lives here rather than in a
 * branch of the flow, because a port one does not call is cheaper than a port
 * made optional (§4).
 */
export function publishedAddressOf(info: JoinInfo): string | null {
  return isEnshroudedJoinInfo(info) ? info.address : null;
}
