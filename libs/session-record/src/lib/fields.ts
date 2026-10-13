import {
  Deadline,
  DEFAULT_SETTINGS,
  isGame,
  isSetupActivity,
  isSetupProgress,
  isSetupStep,
  isSetupStepOrder,
  isWorldId,
  SESSION_STATES,
  Session,
  World,
  type AbandonedSetup,
  type CompletedSetup,
  type Game,
  type InstanceSize,
  type JoinInfo,
  type KeptSetup,
  type KeptSetupStep,
  type LastOpening,
  type SessionSettings,
  type SessionState,
  type WorldId,
} from '@beacon/session';

export const WORLDS = 'worlds';
export const PLAYERS = 'players';
export const SETTINGS_DOC = 'config/settings';
export const EVENTS = 'events';

/** `worlds/{worldId}/server/current` — the one session context a world holds. */
export function serverDocPath(worldId: WorldId): string {
  return `${WORLDS}/${worldId}/server/current`;
}

/** `worlds/{worldId}/server/setup` — the step the session's setup is on. */
export function setupDocPath(worldId: WorldId): string {
  return `${WORLDS}/${worldId}/server/setup`;
}

/**
 * The step `worlds/{worldId}/server/setup` is on, as the domain reads it. Null
 * means the document names no step this vocabulary recognises. An activity or
 * a progress it does not recognise reads as none.
 */
export function keptStepFrom(data: Record<string, unknown>): KeptSetupStep | null {
  const step = data['step'];
  const since = toDate(data['stepSince']);
  if (!isSetupStep(step) || since === null) return null;
  const activity = data['activity'];
  const progress = data['progress'];
  return {
    step,
    since,
    activity: isSetupActivity(activity) ? activity : null,
    progress: isSetupProgress(progress) ? progress : null,
  };
}

/**
 * The whole of `worlds/{worldId}/server/setup`: whose setup it is and the
 * order of its game, with the step it is on. Null as soon as one of the three
 * is missing — the screen ranks the step in that order, and half of it would
 * be a rank out of nothing.
 */
export function keptSetupFrom(data: Record<string, unknown>): KeptSetup | null {
  const sessionId = data['sessionId'];
  const order = data['stepOrder'];
  const step = keptStepFrom(data);
  if (typeof sessionId !== 'string' || !isSetupStepOrder(order) || step === null) return null;
  return { sessionId, order, step };
}

export const COMPLETED_SETUPS = 'completedSetups';

/** `completedSetups/{game}` — the last setups of one game that came into service. */
export function completedSetupsDocPath(game: Game): string {
  return `${COMPLETED_SETUPS}/${game}`;
}

/**
 * The completed setups `completedSetups/{game}` keeps, oldest first. An entry that
 * names no session, or no duration a setup can have taken, is left out: the
 * ready window is drawn from what is read here, and one wrong duration would
 * announce an hour before the opening.
 */
export function completedSetupsFrom(data: Record<string, unknown>): readonly CompletedSetup[] {
  const setups = data['setups'];
  if (!Array.isArray(setups)) return [];
  return setups.flatMap((entry: unknown): CompletedSetup[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const { sessionId, durationMs } = entry as Record<string, unknown>;
    if (typeof sessionId !== 'string') return [];
    if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs <= 0) return [];
    return [{ sessionId, durationMs }];
  });
}

/** `completedSetups/{game}` as it is written: whole, so nothing unreadable outlives a write. */
export function completedSetupsDocument(setups: readonly CompletedSetup[]): Record<string, unknown> {
  return {
    setups: setups.map((setup) => ({ sessionId: setup.sessionId, durationMs: setup.durationMs })),
  };
}

/**
 * The field of `server/current` that marks an abandoned setup: whose it was,
 * and when. Only the Functions write it, in the write that changes the state.
 * It stays out of `RESERVED_FACTS` like `lastError`, and for the same reason:
 * the cleanup of an abandon empties those, and this is what it must leave.
 */
export const ABANDONED_SETUP = 'abandonedSetup';

/** The mark as the domain reads it. Half a mark reads as none. */
export function abandonedSetupFrom(data: Record<string, unknown>): AbandonedSetup | null {
  const mark = data[ABANDONED_SETUP];
  if (typeof mark !== 'object' || mark === null) return null;
  const { sessionId, at } = mark as Record<string, unknown>;
  const abandonedAt = toDate(at);
  if (typeof sessionId !== 'string' || abandonedAt === null) return null;
  return { sessionId, at: abandonedAt };
}

/**
 * The session `server/current` last opened. A return to out of service leaves
 * it on the document, which is why this reads the document and not the
 * session: an idle `Session` names none.
 */
export function lastOpeningFrom(data: Record<string, unknown>, state: SessionState): LastOpening {
  const sessionId = data['sessionId'];
  return {
    state,
    sessionId: typeof sessionId === 'string' ? sessionId : null,
    startedAt: toDate(data['startedAt']),
  };
}

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
 * `worlds/{worldId}/server/current` as the domain reads it. Null means the
 * document says nothing this vocabulary recognises — never a session with
 * invented fields.
 *
 * The game and the world id come from `world`, never from the document: §5
 * moved `game` off this document, and a session cannot be read without
 * knowing which world it belongs to in the first place.
 */
export function sessionFrom(data: Record<string, unknown>, world: World): Session | null {
  const state = toState(data['state']);
  if (state === null) return null;
  if (state === 'IDLE') return Session.idle();

  const sessionId = data['sessionId'];
  const startedAt = toDate(data['startedAt']);
  const deadline = toDate(data['deadline']);
  if (typeof sessionId !== 'string' || startedAt === null || deadline === null) {
    return null;
  }

  return Session.from({
    state,
    sessionId,
    worldId: world.worldId,
    game: world.game,
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
 * `worlds/{worldId}` as the domain reads it. Null for the same reason as
 * `sessionFrom`: a document with an unrecognised game, or missing the
 * fields a world cannot be built without, is not a world with invented
 * fields — it is not a world at all.
 *
 * `worldId` is the document's own id, checked here rather than trusted:
 * whatever named the document might not be one `isWorldId` accepts, and
 * `World.from` throws rather than returning null on that.
 */
export function worldFrom(
  worldId: WorldId,
  data: Record<string, unknown>,
  playerUids: readonly string[],
): World | null {
  if (!isWorldId(worldId)) return null;
  const game = data['game'];
  const name = data['name'];
  const inviteCode = data['inviteCode'];
  if (!isGame(game) || typeof name !== 'string' || typeof inviteCode !== 'string') return null;
  try {
    return World.from({ worldId, game, name, inviteCode, players: playerUids });
  } catch {
    return null;
  }
}

/** The game `worlds/{worldId}` names, or null when it is none this vocabulary knows. */
export function gameFrom(data: Record<string, unknown>): Game | null {
  const game = data['game'];
  return isGame(game) ? game : null;
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

/**
 * What a session's opening writes. The instants are the caller's sentinel.
 * No `game`: the document no longer carries it (§5) — the world above it
 * does, once and for every session it opens.
 */
export function openingFields(session: Session, serverTime: unknown): Record<string, unknown> {
  return {
    state: session.state,
    // The server's own instant, not the browser's. The tranche 4 rules require
    // `stateSince == request.time` and `startedAt == request.time`, which
    // forbids backdating without teaching the rules anything about the domain.
    stateSince: serverTime,
    startedAt: serverTime,
    sessionId: session.sessionId,
    startedBy: session.startedBy,
    deadline: session.deadline.at,
    // Written only when an admin chose one. §5 reserves the field, and an
    // ordinary member's write that touched it would be refused whole by the
    // tranche 4 rules — every opening, for every player.
    ...(session.instanceSize !== null ? { instanceSize: session.instanceSize } : {}),
  };
}

/**
 * What `seed.ts` writes at `worlds/{worldId}/server/current`, identically,
 * `game` less: every reserved fact present and null, because an absent key
 * and a null one do not read the same way in a rules diff.
 */
export function idleServerDocument(now: Date): Record<string, unknown> {
  return {
    state: 'IDLE',
    stateSince: now,
    sessionId: null,
    startedBy: null,
    startedAt: null,
    deadline: null,
    instanceId: null,
    ipId: null,
    ip: null,
    joinInfo: null,
    provisionClaimedAt: null,
    lastError: null,
    [ABANDONED_SETUP]: null,
  };
}

/**
 * What `worlds/{worldId}` holds. Never `players`: they are a subcollection,
 * not a field — `worldFrom` takes them separately, and a field here would be
 * a second, driftable copy of what the subcollection already says.
 */
export function worldDocument(world: World, at: Date): Record<string, unknown> {
  return {
    game: world.game,
    name: world.name,
    inviteCode: world.inviteCode,
    createdAt: at,
  };
}

/**
 * A player of `worlds/{worldId}/players/{uid}`. `uid` is written as a field
 * and not only as the document's id, because "my worlds" is a collection
 * group query on this field (T8), and a rule can only prove what a query
 * asked for on a field, never on a document id.
 */
export function playerDocument(
  uid: string,
  code: string,
  serverTime: unknown,
): Record<string, unknown> {
  return { uid, code, joinedAt: serverTime };
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
