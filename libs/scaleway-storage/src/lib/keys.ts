import { isGame, SAVE_ORIGINS, type Game, type SaveDraft, type SaveOrigin } from '@beacon/session';

/** What the deposit needs of a draft. Narrower than `SaveDraft` on purpose. */
type Addressed = Pick<SaveDraft, 'game' | 'sessionId' | 'origin' | 'createdAt'>;

const PREFIX = 'saves';
const SUFFIX = '.tar.gz';

/**
 * `saves/{game}/{origin}/{sessionId}/{instant}.tar.gz`.
 *
 * The origin sits above the session because the bucket prunes by prefix: a
 * regular push does not have to live as long as the last one of an evening
 * (§5), and a lifecycle rule can only say so if the origin comes first.
 *
 * **Changing this format means re-posing those rules**, which live in a console
 * and not in this repository — they match a literal prefix, and nothing here
 * would fail if they stopped matching. The test below pins the whole string for
 * exactly that reason.
 *
 * A colon is legal in an s3 key and unusable in a path, a shell word or a url,
 * so the instant is spelled with dashes. It is replaced here and nowhere else.
 */
export function objectKeyFor(draft: Addressed): string {
  const instant = draft.createdAt.toISOString().replace(/[:.]/g, '-').replace(/-\d{3}Z$/, 'Z');
  return `${PREFIX}/${draft.game}/${draft.origin}/${draft.sessionId}/${instant}${SUFFIX}`;
}

export interface ParsedKey {
  readonly game: Game;
  readonly origin: SaveOrigin;
  readonly createdAt: Date;
}

/**
 * Null for anything this module did not write. `list()` skips those rather than
 * throwing: one object deposited by hand must not make every restoration fail,
 * and the second bucket already keeps the game files out of this one (§5).
 */
export function parseObjectKey(key: string): ParsedKey | null {
  const parts = key.split('/');
  if (parts.length !== 5 || parts[0] !== PREFIX) return null;

  const [, game, origin, , file] = parts;
  if (!isGame(game)) return null;
  if (!SAVE_ORIGINS.includes(origin as SaveOrigin)) return null;
  if (!file.endsWith(SUFFIX)) return null;

  const stamp = file.slice(0, -SUFFIX.length);
  const iso = stamp.replace(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})Z$/, '$1T$2:$3:$4Z');
  const createdAt = new Date(iso);
  if (Number.isNaN(createdAt.getTime())) return null;

  return { game, origin: origin as SaveOrigin, createdAt };
}
