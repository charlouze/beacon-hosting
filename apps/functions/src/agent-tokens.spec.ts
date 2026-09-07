import { beforeEach, describe, expect, it } from 'vitest';
import { getFirestore } from 'firebase-admin/firestore';
import { hashAgentToken, newAgentToken } from '@beacon/agent-protocol';
import { defaultApp } from './firebase-app.js';
import { agentTokens, AGENT_TOKENS } from './agent-tokens.js';

const db = getFirestore(defaultApp());
const tokens = agentTokens(db);
const AT = new Date('2026-09-06T20:00:00Z');

beforeEach(async () => {
  const existing = await db.collection(AGENT_TOKENS).get();
  await Promise.all(existing.docs.map((doc) => doc.ref.delete()));
});

describe('agentTokens', () => {
  it('recognises the token it issued for that session', async () => {
    const token = newAgentToken();
    await tokens.issue('s1', token, AT);
    expect(await tokens.verify('s1', token)).toBe(true);
  });

  it('refuses a token issued for another session', async () => {
    const token = newAgentToken();
    await tokens.issue('s1', token, AT);
    await tokens.issue('s2', newAgentToken(), AT);
    expect(await tokens.verify('s2', token)).toBe(false);
  });

  it('refuses everything for a session it never issued for', async () => {
    expect(await tokens.verify('never', newAgentToken())).toBe(false);
  });

  // §5: only the hash is stored. A document holding the token itself would be
  // a credential at rest for no benefit — nothing ever needs to read it back.
  it('stores the hash and never the token', async () => {
    const token = newAgentToken();
    await tokens.issue('s1', token, AT);
    const stored = (await db.doc(`${AGENT_TOKENS}/s1`).get()).data() ?? {};
    expect(stored['hash']).toBe(hashAgentToken(token));
    expect(JSON.stringify(stored)).not.toContain(token);
  });

  // §5: a strict create. A sessionId drawn by a browser and replayed must not
  // obtain a machine, and this is one of the two documents that close it.
  it('refuses to issue twice for the same session', async () => {
    await tokens.issue('s1', newAgentToken(), AT);
    await expect(tokens.issue('s1', newAgentToken(), AT)).rejects.toThrow();
  });
});
