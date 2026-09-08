import type { Game, JoinInfo } from '@beacon/session';
import { enshrouded } from './enshrouded.js';
import { sunkenland } from './sunkenland.js';

/** The s3 side of what a machine is told, and the only credential it holds. */
export interface SaveAccess {
  readonly endpoint: string;
  readonly region: string;
  /** Written by the machine. */
  readonly savesBucket: string;
  /** Read by the machine, never written — §5 keeps them in a bucket of their own. */
  readonly gamesBucket: string;
  readonly accessKey: string;
  readonly secretKey: string;
}

export interface BootRequest {
  readonly serverName: string;
  readonly serverPassword: string;
  readonly slotCount: number;
  readonly sessionId: string;
  /**
   * Thirty-two bytes that die with the session (§7). It rides here because
   * first-boot data is the only channel to a machine that holds nothing yet,
   * and it is the reason this whole payload is treated as a secret.
   */
  readonly agentToken: string;
  /** Where the companion reports. Deployed value, never compiled in. */
  readonly endpoint: string;
  readonly saves: SaveAccess;
}

/**
 * Everything a join point could be built from, gathered in one place because
 * the two games do not build theirs from the same thing: one from the address
 * the function reserved, the other from an identifier only the vm discovers.
 * An entry takes what it needs and ignores the rest — the alternative was two
 * signatures, and a caller that has to know which game it is holding.
 */
export interface JoinFacts {
  /** What the function reserved. Always known by the time a join point is built. */
  readonly address: string;
  /** What the machine declared (§7). Present only for a game that announces one. */
  readonly serverId?: string;
}

/**
 * Everything the repository knows about one game, and the only place it knows
 * it. A port number has no business in a model that talks about sessions and
 * deadlines (§4).
 */
export interface GameCatalogEntry {
  readonly game: Game;
  /**
   * The name a dns record points at, or null when nothing does. Null is not a
   * missing value: one of the two games announces no address at all, and a
   * port one does not call is cheaper than a port made optional (§4).
   */
  readonly hostname: string | null;
  compose(): string;
  render(request: BootRequest): string;
  /**
   * Null is a refusal, not an error to report: §6 wants the control plane to
   * reject an identifier whose prefix does not name the world it booted, and
   * the world guid is game knowledge that §4 keeps out of everything else. So
   * the entry decides, and the one caller merely notices that nothing came
   * back — a session with no join point dies of the provisioning delay, which
   * already exists and covers exactly this.
   *
   * What this still lets through, and it is worth naming: a compromised vm can
   * send players to another server *carrying the same world*. What it can no
   * longer do is send them anywhere at all. That is damage reduction, not
   * proof, and it is the most a value that exists only on the machine allows.
   */
  joinInfo(facts: JoinFacts): JoinInfo | null;
}

/**
 * Total, and the type says so: every game this system knows has an entry, so
 * nothing here can refuse one. The day a third game is added, the compiler
 * names this line rather than a session failing at boot.
 */
const CATALOG: Record<Game, GameCatalogEntry> = { enshrouded, sunkenland };

export function catalogFor(game: Game): GameCatalogEntry {
  return CATALOG[game];
}

/**
 * Every value of a request that lands in a file `docker compose` reads: the
 * `.env` it interpolates the compose from, and the `companion.env` an
 * `env_file:` loads. Measured in `probe/RESULTS.md` (« Un `$` dans le mot de
 * passe ne survit pas à `docker compose` ») — compose reads `$bc` as an empty
 * variable, so `a$bc` reaches the container as `a`, with a warning about an
 * unknown variable and none about the value it just amputated. `env_file`
 * changes nothing: the same interpolation applies there.
 *
 * `slotCount` is the one field of a request missing here, and its type is the
 * whole reason: a number has no `$` to lose.
 */
const exposedValues = (request: BootRequest): readonly (readonly [string, string])[] => [
  ['serverName', request.serverName],
  ['serverPassword', request.serverPassword],
  ['sessionId', request.sessionId],
  ['agentToken', request.agentToken],
  ['endpoint', request.endpoint],
  ['saves.endpoint', request.saves.endpoint],
  ['saves.region', request.saves.region],
  ['saves.accessKey', request.saves.accessKey],
  ['saves.secretKey', request.saves.secretKey],
  ['saves.savesBucket', request.saves.savesBucket],
  ['saves.gamesBucket', request.saves.gamesBucket],
];

/**
 * The one gate every boot passes, whichever game it is for, and the last place
 * a value can be refused while nothing is billed yet. Two refusals live here,
 * and they share their reason: what they catch leaves no trace downstream.
 *
 * The only place `endpoint` enters the system. It comes from `AGENT_ENDPOINT`,
 * filled by a human, and it is the url the machine sends its token to — in an
 * `authorization` header, once a minute, for the whole session. Over plain http
 * that token crosses the internet in clear, and **nothing downstream notices**:
 * the reports succeed, the session runs, and the leak leaves no trace.
 *
 * So it is refused here, at the frontier, and not on the machine. The companion
 * stays permissive on purpose — the smoke harness answers on http over a docker
 * bridge, where no wire leaves the developer's laptop, and a rule there would
 * refuse the barrier while buying nothing this one does not already buy.
 *
 * The `$` is refused for the same shape of reason, and here rather than in an
 * entry because the two games share one password secret: a rule held by one of
 * them lets the other boot on an amputated password, on a server that looks
 * healthy. It names the field and never the value — what it holds is a secret,
 * and this error travels: `provisioning` writes a summary of it to a field
 * every member's browser reads live, through a sanitiser that is length-based,
 * so a short human-chosen password crosses it untouched.
 */
export const renderCloudInit = (game: Game, request: BootRequest): string => {
  if (!request.endpoint.startsWith('https://')) {
    throw new Error(
      `refusing to write a cloud-init whose endpoint is not https: the agent token travels in its headers`,
    );
  }
  for (const [field, value] of exposedValues(request)) {
    if (value.includes('$')) {
      throw new Error(
        `refusing to write a cloud-init whose ${field} contains a "$": docker compose would swallow it silently, and no log can tell you it did`,
      );
    }
  }
  return catalogFor(game).render(request);
};

export const renderCompose = (game: Game): string => catalogFor(game).compose();
