import {
  isSetupActivity,
  isSetupProgress,
  isSetupStep,
  SAVE_ORIGINS,
  type SaveOrigin,
  type SessionId,
  type SessionState,
  type SetupDeclaration,
} from '@beacon/session';

/**
 * What the machine can say. Four words, and each one is a fact it alone can
 * observe — which is the whole reason the agent exists (§6, étape 7).
 */
export const AGENT_PHASES = ['alive', 'ready', 'saved', 'failed'] as const;

export type AgentPhase = (typeof AGENT_PHASES)[number];

export interface AgentReport {
  readonly sessionId: SessionId;
  readonly phase: AgentPhase;
  /**
   * Corroboration only. §6: the function points dns at the address it reserved
   * itself, never at the one the machine declares — otherwise a compromised vm
   * would aim the record wherever it liked. A mismatch is filed, not followed.
   */
  readonly ip?: string;
  /**
   * On `saved`: what was deposited, as the machine claims it. The origin
   * travels rather than being derived here, because the machine already wrote
   * it into the object key (§5) — deriving it a second time is how a record and
   * a key end up disagreeing about the same archive.
   */
  readonly save?: {
    readonly objectKey: string;
    readonly sizeBytes: number;
    readonly origin: SaveOrigin;
  };
  /**
   * On `ready`, for a game whose join point is not an address: the identifier
   * the server announces once it accepts players. Unlike `ip`, this one *is*
   * followed — and the rule "never follow what the agent declares" cannot apply
   * here, because there is nothing else to compare it against: the value exists
   * only on the vm, it changes at every boot, and no provider api or port
   * carries it. What replaces corroboration is the shape `<world guid>~<boot
   * instant>`: the catalogue knows the guid it booted the world with, and
   * refuses an identifier that does not name it.
   */
  readonly serverId?: string;
  /** On `failed`: why. Bounded, like every string a client writes (§5). */
  readonly detail?: string;
  /**
   * On `ready`: the world the machine restored. Both members travel together
   * — a guid without a name would publish a join point without the recourse
   * the §2 guarantees to players, the name in the list when the identifier
   * gets lost.
   */
  readonly world?: { readonly name: string; readonly guid: string };
  /**
   * While the server sets itself up: the step it is on. Displayed and never
   * acted upon, which is why a malformed one is discarded rather than
   * refused.
   */
  readonly setup?: SetupDeclaration;
  /**
   * On `failed`, before the server was announced: the end of what the game
   * printed. Kept for the operator alone, never for a member — which is why a
   * malformed one is discarded rather than refused.
   */
  readonly gameLog?: string;
}

/**
 * One report a minute once the server is announced, and it lives here rather
 * than in a catalogue entry because it is not a per-game value: two measured
 * guarantees of the spec hang on this number — the machine learns an extension
 * or a stop in under a minute, and the watchdog can tell a slow machine from a
 * mute one. A game that could set it would be a game that can break the
 * protocol.
 */
export const REPORT_INTERVAL_MS = 60_000;

/**
 * The cadence of a server that follows its own setup in the game's output,
 * until it is announced: a step is only worth displaying while it is current.
 */
export const SETUP_REPORT_INTERVAL_MS = 10_000;

/** The most a report carries of the game's output. The machine cuts to it, the frontier checks it. */
export const GAME_LOG_MAX_CHARS = 16_384;

/** What the control plane answers, on every report (§6). */
export interface AgentInstructions {
  readonly state: SessionState;
  /**
   * The current closing time, re-read at every report — which is what makes
   * "the agent learns an extension in under a minute" a property of the
   * protocol and not of a notification nobody would receive.
   */
  readonly deadlineIso: string | null;
}

const MAX_STRING = 1024;

const isBoundedString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= MAX_STRING;

/** A report the frontier accepted, and the fields it carried that were discarded. */
export interface ParsedReport {
  readonly report: AgentReport;
  readonly discarded: readonly string[];
}

function setupFrom(value: unknown): SetupDeclaration | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const { step, activity, progress } = raw;

  if (!isSetupStep(step)) return null;
  if (activity !== undefined && !isSetupActivity(activity)) return null;
  if (progress !== undefined && !isSetupProgress(progress)) return null;

  return {
    step,
    ...(activity === undefined ? {} : { activity }),
    ...(progress === undefined ? {} : { progress }),
  };
}

/**
 * The anti-corruption layer (§4). It reads a body that came from the least
 * trusted element of the system (§7) and answers a value the domain recognises,
 * or null.
 *
 * It never repairs and never passes an unknown field through. A parser that
 * coerced would make the endpoint's behaviour depend on what the machine felt
 * like sending, which is the opposite of what a frontier is for.
 *
 * One exception: a malformed `setup` or `gameLog` is discarded and named, and
 * the report stands. Neither is ever acted upon, and a `ready` or a `failed`
 * report must not fall on it.
 */
export function parseReport(body: unknown): ParsedReport | null {
  if (typeof body !== 'object' || body === null) return null;
  const raw = body as Record<string, unknown>;

  if (!isBoundedString(raw['sessionId'])) return null;
  if (!AGENT_PHASES.includes(raw['phase'] as AgentPhase)) return null;

  const report: {
    sessionId: string;
    phase: AgentPhase;
    ip?: string;
    serverId?: string;
    save?: { objectKey: string; sizeBytes: number; origin: SaveOrigin };
    detail?: string;
    world?: { name: string; guid: string };
    setup?: SetupDeclaration;
    gameLog?: string;
  } = { sessionId: raw['sessionId'], phase: raw['phase'] as AgentPhase };

  if (raw['ip'] !== undefined) {
    if (!isBoundedString(raw['ip'])) return null;
    report.ip = raw['ip'];
  }

  if (raw['serverId'] !== undefined) {
    if (!isBoundedString(raw['serverId'])) return null;
    report.serverId = raw['serverId'];
  }

  if (raw['detail'] !== undefined) {
    if (!isBoundedString(raw['detail'])) return null;
    report.detail = raw['detail'];
  }

  if (raw['save'] !== undefined) {
    const save = raw['save'] as Record<string, unknown> | null;
    if (typeof save !== 'object' || save === null) return null;
    if (!isBoundedString(save['objectKey'])) return null;
    // Finite, not merely a number: NaN passes no comparison, including the
    // floor of `Save`, so it would slip through the one check that matters.
    const sizeBytes = save['sizeBytes'];
    if (typeof sizeBytes !== 'number' || !Number.isFinite(sizeBytes)) return null;
    if (!SAVE_ORIGINS.includes(save['origin'] as SaveOrigin)) return null;
    report.save = {
      objectKey: save['objectKey'],
      sizeBytes,
      origin: save['origin'] as SaveOrigin,
    };
  }

  if (raw['world'] !== undefined) {
    const world = raw['world'] as Record<string, unknown> | null;
    if (typeof world !== 'object' || world === null) return null;
    if (!isBoundedString(world['name'])) return null;
    if (!isBoundedString(world['guid'])) return null;
    report.world = { name: world['name'], guid: world['guid'] };
  }

  const discarded: string[] = [];

  if (raw['setup'] !== undefined) {
    const setup = setupFrom(raw['setup']);
    if (setup === null) discarded.push('setup');
    else report.setup = setup;
  }

  if (raw['gameLog'] !== undefined) {
    const gameLog = raw['gameLog'];
    if (typeof gameLog === 'string' && gameLog.length <= GAME_LOG_MAX_CHARS) {
      report.gameLog = gameLog;
    } else {
      discarded.push('gameLog');
    }
  }

  return { report, discarded };
}
