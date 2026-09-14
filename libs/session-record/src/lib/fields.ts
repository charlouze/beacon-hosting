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
 * The fields of `config/settings` the deployment owns and a client may not
 * touch (§4, §5). Declared once because three places have to agree on them and
 * nothing else can make them: `stamp()` writes them, `firestore.rules`
 * subtracts them from what an admin may affect, and `reserved-fields.spec.ts`
 * is the only file that can read both ends.
 *
 * A field added to the stamp and forgotten in the rules fails silently — the
 * deployment keeps working, and the field is simply no longer reserved.
 */
export const DEPLOYED_FIELDS = ['rulesVersion', 'agentEndpoint'] as const;

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

/**
 * `server/current` as the *screen* reads it, and nothing more. §4: of the
 * reserved facts, three are displayed — the `ip`, which the screen shows
 * beside the domain name, the `joinInfo`, which it makes readable and
 * copyable, and `lastError`, which says a previous attempt failed.
 *
 * A second reading of the same document, for a second reader. The domain still
 * sees none of these: `Session` keeps its `hasJoinInfo` boolean, because
 * `RUNNING` means the join point exists and the model has no business knowing
 * what it contains.
 */
export interface DisplayedFacts {
  readonly ip: string | null;
  readonly joinInfo: JoinInfo | null;
  readonly lastError: string | null;
}

/**
 * The same discipline as `sessionFrom`: what the vocabulary does not recognise
 * becomes null, never an invented object. A half-written shape is refused
 * whole — the screen prints every field it is handed, so half a join point
 * would be a line telling a player to copy `undefined`.
 */
function joinInfoFrom(value: unknown): JoinInfo | null {
  const data = (value ?? {}) as Record<string, unknown>;
  const game = data['game'];
  if (!isGame(game)) return null;

  const text = (key: string): string | null =>
    typeof data[key] === 'string' ? (data[key] as string) : null;

  if (game === 'enshrouded') {
    const hostname = text('hostname');
    const address = text('address');
    const port = data['port'];
    if (hostname === null || address === null || typeof port !== 'number') return null;
    return { game, hostname, address, port };
  }

  const serverId = text('serverId');
  const region = text('region');
  const worldName = text('worldName');
  if (serverId === null || region === null || worldName === null) return null;
  return { game, serverId, region, worldName };
}

export function displayedFactsFrom(data: Record<string, unknown>): DisplayedFacts {
  return {
    ip: typeof data['ip'] === 'string' ? data['ip'] : null,
    joinInfo: joinInfoFrom(data['joinInfo']),
    lastError: typeof data['lastError'] === 'string' ? data['lastError'] : null,
  };
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

/**
 * The commit reference the deployment stamped on `config/settings`, or null
 * when it has stamped nothing. It sits beside the settings rather than inside
 * them: a deployment fact is not a session setting, and `libs/session` has no
 * business knowing it (§4).
 *
 * Anything that is not a string reads as null. An invented version would
 * differ from every compiled one, and reload every open tab forever.
 */
export function rulesVersionFrom(data: Record<string, unknown>): string | null {
  return typeof data['rulesVersion'] === 'string' ? data['rulesVersion'] : null;
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
