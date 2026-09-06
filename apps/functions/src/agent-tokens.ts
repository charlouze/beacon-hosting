import { hashAgentToken, tokenMatches } from '@beacon/agent-protocol';
import type { SessionId } from '@beacon/session';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';

export const AGENT_TOKENS = 'agentTokens';

export interface AgentTokens {
  /**
   * §6 étape 4, and a strict create: a sessionId already seen fails, which is
   * one of the two documents that close the reuse of an id drawn by a browser
   * (§5).
   */
  issue(sessionId: SessionId, token: string, at: Date): Promise<void>;
  /** False for anything at all — an unknown session, a wrong token, nonsense. */
  verify(sessionId: SessionId, token: string): Promise<boolean>;
}

/**
 * The only credential a game machine ever holds, kept where no client reads it.
 * §5 says why it is not a field of `server/current`: Firestore filters reads by
 * document and not by field, and every member watches that document live.
 */
export function agentTokens(db: Firestore): AgentTokens {
  return {
    async issue(sessionId: SessionId, token: string, at: Date): Promise<void> {
      await db.doc(`${AGENT_TOKENS}/${sessionId}`).create({
        hash: hashAgentToken(token),
        createdAt: Timestamp.fromDate(at),
      });
    },

    async verify(sessionId: SessionId, token: string): Promise<boolean> {
      const snapshot = await db.doc(`${AGENT_TOKENS}/${sessionId}`).get();
      if (!snapshot.exists) return false;
      const hash = (snapshot.data() ?? {})['hash'];
      return typeof hash === 'string' && tokenMatches(token, hash);
    },
  };
}
