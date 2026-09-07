import { describe, expect, it } from 'vitest';
import { sanitizeLastError } from './sanitize-last-error.js';

describe('sanitizeLastError', () => {
  it('redacts anything long enough to be a credential', () => {
    const secret = 'a'.repeat(64);
    expect(sanitizeLastError(`user data rejected: BEACON_TOKEN=${secret}`)).not.toContain(
      secret,
    );
    expect(sanitizeLastError(`user data rejected: BEACON_TOKEN=${secret}`)).toContain(
      '[redacted]',
    );
  });

  it('truncates a very long detail', () => {
    expect(sanitizeLastError('refused '.repeat(200)).length).toBeLessThan(600);
  });

  it('leaves an ordinary, short message alone', () => {
    expect(sanitizeLastError('the provider refused the request')).toBe(
      'the provider refused the request',
    );
  });

  // The first documented limit: the guarantee is on length, not on what the
  // text actually is. Nothing here can tell a short human-chosen secret from
  // an ordinary word of the same length.
  it('does not catch a short secret', () => {
    expect(sanitizeLastError('password rejected: hunter2')).toContain('hunter2');
  });

  // The second documented limit: anything long enough is collapsed whether or
  // not it carries a secret — a session id or an object key included in an
  // error message is redacted along with a real token.
  it('also collapses a long value that carries no secret at all', () => {
    const objectKey = 'saves/enshrouded/pre-shutdown/s1/2026-09-06T20-10-00Z-not-a-secret.tar.gz';
    expect(sanitizeLastError(`refused key ${objectKey}`)).not.toContain(objectKey);
  });
});
