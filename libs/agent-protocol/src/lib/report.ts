import { SAVE_ORIGINS, type SaveOrigin, type SessionId, type SessionState } from '@beacon/session';

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
  /** On `failed`: why. Bounded, like every string a client writes (§5). */
  readonly detail?: string;
}

/**
 * One report a minute (§6), and it lives here rather than in a catalogue entry
 * because it is not a per-game value: two measured guarantees of the spec hang
 * on this number — the machine learns an extension or a stop in under a minute,
 * and the watchdog can tell a slow machine from a mute one. A game that could
 * set it would be a game that can break the protocol.
 */
export const REPORT_INTERVAL_MS = 60_000;

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

/**
 * The anti-corruption layer (§4). It reads a body that came from the least
 * trusted element of the system (§7) and answers a value the domain recognises,
 * or null.
 *
 * It never repairs and never passes an unknown field through. A parser that
 * coerced would make the endpoint's behaviour depend on what the machine felt
 * like sending, which is the opposite of what a frontier is for.
 */
export function parseReport(body: unknown): AgentReport | null {
  if (typeof body !== 'object' || body === null) return null;
  const raw = body as Record<string, unknown>;

  if (!isBoundedString(raw['sessionId'])) return null;
  if (!AGENT_PHASES.includes(raw['phase'] as AgentPhase)) return null;

  const report: {
    sessionId: string;
    phase: AgentPhase;
    ip?: string;
    save?: { objectKey: string; sizeBytes: number; origin: SaveOrigin };
    detail?: string;
  } = { sessionId: raw['sessionId'], phase: raw['phase'] as AgentPhase };

  if (raw['ip'] !== undefined) {
    if (!isBoundedString(raw['ip'])) return null;
    report.ip = raw['ip'];
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

  return report;
}
