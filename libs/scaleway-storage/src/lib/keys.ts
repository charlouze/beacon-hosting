import {
  isWorldId,
  SAVE_ORIGINS,
  type SaveDraft,
  type SaveOrigin,
  type SessionId,
  type WorldId,
} from '@beacon/session';

const SUFFIX = '.tar.gz';
const INSTANT_PATTERN = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z$/;
const STEM_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z)(?:-(.+))?$/;

/**
 * `{origin}/{worldId}/{instant}[-{sessionId}].tar.gz`.
 *
 * The origin sits first because the bucket prunes by prefix, and there is
 * exactly one rule for it — `auto/` — that has to elide every world at once
 * (§5). Putting the world first would have asked for one console rule per
 * adoption instead.
 *
 * **Changing this format means re-posing that rule**, which lives in a
 * console and not in this repository — it matches a literal prefix, and
 * nothing here would fail if it stopped matching. It is also what
 * `agentReport` (T11) reads a session out of the filename by suffix. The test
 * below pins the whole string for exactly that reason.
 *
 * A colon is legal in an s3 key and unusable in a path, a shell word or a
 * url, so the instant is spelled with dashes. It is replaced here and
 * nowhere else.
 */
export function objectKeyFor(draft: SaveDraft): string {
  const instant = draft.createdAt.toISOString().replace(/[:.]/g, '-').replace(/-\d{3}Z$/, 'Z');
  const session = draft.sessionId === null ? '' : `-${draft.sessionId}`;
  return `${draft.origin}/${draft.worldId}/${instant}${session}${SUFFIX}`;
}

export interface ParsedKey {
  readonly worldId: WorldId;
  readonly origin: SaveOrigin;
  readonly createdAt: Date;
  /** Absent for an adoption — no session opened the deposit. */
  readonly sessionId: SessionId | null;
}

/**
 * Null for anything this module did not write — the previous format included,
 * five segments starting with `saves/`. `list()` skips those rather than
 * throwing: one object deposited by hand, or left by a migration, must not
 * make every restoration fail.
 */
export function parseObjectKey(key: string): ParsedKey | null {
  const parts = key.split('/');
  if (parts.length !== 3) return null;

  const [origin, worldId, file] = parts;
  if (!SAVE_ORIGINS.includes(origin as SaveOrigin)) return null;
  if (!isWorldId(worldId)) return null;
  if (!file.endsWith(SUFFIX)) return null;

  const stem = file.slice(0, -SUFFIX.length);
  const match = STEM_PATTERN.exec(stem);
  if (match === null) return null;

  const [, instant, sessionId] = match;
  const iso = instant.replace(INSTANT_PATTERN, '$1T$2:$3:$4Z');
  const createdAt = new Date(iso);
  if (Number.isNaN(createdAt.getTime())) return null;

  return { worldId, origin: origin as SaveOrigin, createdAt, sessionId: sessionId ?? null };
}
