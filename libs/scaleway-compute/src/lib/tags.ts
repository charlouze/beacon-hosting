import type { SessionId } from '@beacon/session';

/**
 * Constant, on every resource this system creates. It exists because
 * Scaleway's `tags=` filter is exact and not a prefix match — measured on
 * 2026-09-03 — and the reconciliation asks about sessions whose ids it does
 * not know. Without it there is nothing to ask the api.
 */
export const OWNERSHIP_TAG = 'beacon';

export const SESSION_PREFIX = 'session:';

export const sessionTag = (sessionId: SessionId): string => `${SESSION_PREFIX}${sessionId}`;

/**
 * A wrong guess here is a destruction, not a display glitch: sweepUnclaimed()
 * treats "no session found" as license to destroy, so an ambiguous tag set —
 * more than one distinct session claimed — is read as no session at all
 * rather than picked at random.
 */
export function readSessionTag(tags: readonly string[]): SessionId | null {
  const found = tags
    .filter((tag) => tag.startsWith(SESSION_PREFIX))
    .map((tag) => tag.slice(SESSION_PREFIX.length))
    .filter((sessionId) => sessionId !== '');
  const distinct = new Set(found);
  return distinct.size === 1 ? found[0] : null;
}
