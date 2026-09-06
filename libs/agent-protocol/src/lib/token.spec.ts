import { describe, expect, it } from 'vitest';
import { hashAgentToken, newAgentToken, tokenMatches } from './token.js';

describe('the agent token', () => {
  // §6 étape 4: thirty-two random bytes. Sixty-four hex characters is what
  // that looks like, and the test pins the length rather than the encoding so
  // a change of encoding has to be deliberate.
  it('is thirty-two bytes of randomness', () => {
    expect(newAgentToken()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is never the same twice', () => {
    expect(newAgentToken()).not.toBe(newAgentToken());
  });

  // §5: only the hash is stored, in a document no client reads. The token
  // itself exists in two places and no more — the cloud-init, and the machine.
  it('hashes to something the token cannot be read back from', () => {
    const token = newAgentToken();
    const hash = hashAgentToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(token);
    expect(hashAgentToken(token)).toBe(hash);
  });

  it('recognises its own token and nothing else', () => {
    const token = newAgentToken();
    expect(tokenMatches(token, hashAgentToken(token))).toBe(true);
    expect(tokenMatches(newAgentToken(), hashAgentToken(token))).toBe(false);
  });

  // A caller that passes anything at all must get false, not a throw: this is
  // the frontier, and the value comes from an http request nobody wrote.
  it('answers false rather than throwing on nonsense', () => {
    expect(tokenMatches('', hashAgentToken(newAgentToken()))).toBe(false);
    expect(tokenMatches('not-hex', 'not-hex')).toBe(false);
  });
});
