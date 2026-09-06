import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * A session's agent token (§6, étape 4). Thirty-two bytes from the system's
 * random source, and the only credential that ever rides in a cloud-init.
 *
 * It lives exactly twice: in the machine's first-boot data, and in the
 * machine's memory. What the control plane keeps is the hash below — §5 puts it
 * in `agentTokens/{sessionId}` and not in `server/current` precisely because
 * Firestore filters reads by document and not by field, and every member reads
 * `server/current` in real time.
 */
export function newAgentToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashAgentToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/**
 * Constant time, and it matters here more than it usually does: the comparison
 * runs on a public https endpoint that anyone may call as often as they like,
 * which is the textbook condition for a timing oracle. It answers false rather
 * than throwing on anything malformed — the value comes off the wire.
 */
export function tokenMatches(token: string, hash: string): boolean {
  if (typeof token !== 'string' || typeof hash !== 'string') return false;
  const candidate = Buffer.from(hashAgentToken(token), 'hex');
  const expected = Buffer.from(hash, 'hex');
  if (candidate.length !== expected.length || expected.length === 0) return false;
  return timingSafeEqual(candidate, expected);
}
