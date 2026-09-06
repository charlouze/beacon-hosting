import {
  Deadline,
  DEFAULT_SETTINGS,
  isGame,
  SESSION_STATES,
  Session,
  type InstanceSize,
  type JoinInfo,
  type SessionSettings,
  type SessionState,
} from '@beacon/session';

export const SERVER_DOC = 'server/current';
export const SETTINGS_DOC = 'config/settings';
export const EVENTS = 'events';

/**
 * The reserved fields of §5, minus `lastError`. This list is the one place in
 * the repository that knows them, and it is why `ServerRecord` carries a
 * boolean rather than the fields themselves: the day the spec adds a reserved
 * field — as it did with `joinInfo` — only this line changes.
 *
 * `provisionClaimedAt` belongs here and its absence would be the worst bug of
 * the tranche: it is the provisioning claim lock (§6, étape 3), and one that
 * survived a return to IDLE would make the function abandon every session
 * that follows, forever.
 */
export const RESERVED_FACTS = [
  'instanceId',
  'ipId',
  'ip',
  'joinInfo',
  'provisionClaimedAt',
] as const;

/**
 * Both sdks hand timestamps back as an object with `toDate()` — the admin one
 * and the client one — so one reader serves both transports. That is the whole
 * point of this module: the same names and the same translation, twice.
 */
export function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  const candidate = value as { toDate?: () => Date } | null;
  return typeof candidate?.toDate === 'function' ? candidate.toDate() : null;
}

export function toState(value: unknown): SessionState | null {
  return SESSION_STATES.includes(value as SessionState) ? (value as SessionState) : null;
}

/**
 * `server/current` as the domain reads it. Null means the document says
 * nothing this vocabulary recognises — never a session with invented fields.
 */
export function sessionFrom(data: Record<string, unknown>): Session | null {
  const state = toState(data['state']);
  if (state === null) return null;
  if (state === 'IDLE') return Session.idle();

  const sessionId = data['sessionId'];
  const game = data['game'];
  const startedAt = toDate(data['startedAt']);
  const deadline = toDate(data['deadline']);
  if (typeof sessionId !== 'string' || !isGame(game) || startedAt === null || deadline === null) {
    return null;
  }

  return Session.from({
    state,
    sessionId,
    game,
    startedBy: typeof data['startedBy'] === 'string' ? data['startedBy'] : '',
    startedAt,
    deadline: Deadline.at(deadline),
    // Null and not the compiled default: the deployed `config/settings` is
    // what decides, and only the function reads it (§5).
    instanceSize: typeof data['instanceSize'] === 'string' ? data['instanceSize'] : null,
    hasJoinInfo: (data['joinInfo'] ?? null) !== null,
  });
}

export function settingsFrom(data: Record<string, unknown>): SessionSettings {
  const number = (key: keyof SessionSettings, fallback: number): number =>
    typeof data[key] === 'number' ? (data[key] as number) : fallback;

  const raw = (data['tariffPerHour'] ?? {}) as Record<string, unknown>;
  const tariffPerHour: Record<InstanceSize, number> = {};
  for (const [size, value] of Object.entries(raw)) {
    // A price that is not a number is not a price. Coercing it would put a
    // NaN on the only figure this product shows about money (§5).
    if (typeof value === 'number' && Number.isFinite(value)) tariffPerHour[size] = value;
  }

  return {
    sessionDurationMs: number('sessionDurationMs', DEFAULT_SETTINGS.sessionDurationMs),
    extensionStepMs: number('extensionStepMs', DEFAULT_SETTINGS.extensionStepMs),
    extensionWindowMs: number('extensionWindowMs', DEFAULT_SETTINGS.extensionWindowMs),
    defaultInstanceSize:
      typeof data['defaultInstanceSize'] === 'string'
        ? data['defaultInstanceSize']
        : DEFAULT_SETTINGS.defaultInstanceSize,
    tariffPerHour:
      data['tariffPerHour'] === undefined ? DEFAULT_SETTINGS.tariffPerHour : tariffPerHour,
  };
}

/** What a session's opening writes. The instants are the caller's sentinel. */
export function openingFields(session: Session, serverTime: unknown): Record<string, unknown> {
  return {
    state: session.state,
    // The server's own instant, not the browser's. The tranche 4 rules require
    // `stateSince == request.time` and `startedAt == request.time`, which
    // forbids backdating without teaching the rules anything about the domain.
    stateSince: serverTime,
    startedAt: serverTime,
    sessionId: session.sessionId,
    game: session.game,
    startedBy: session.startedBy,
    deadline: session.deadline.at,
    // Written only when an admin chose one. §5 reserves the field, and an
    // ordinary member's write that touched it would be refused whole by the
    // tranche 4 rules — every opening, for every player.
    ...(session.instanceSize !== null ? { instanceSize: session.instanceSize } : {}),
  };
}

export interface EventFields {
  readonly type: string;
  readonly sessionId: string | null;
  readonly detail: string;
  readonly actor: { readonly uid: string; readonly name: string };
}

/** 400 days (§5): never below the horizon of what is displayed from it. */
export const TTL_DAYS = 400;

export type { JoinInfo };
