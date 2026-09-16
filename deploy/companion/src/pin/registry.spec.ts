import { describe, expect, it } from 'vitest';
import { digestOf } from './registry.js';

const DIGEST = `sha256:${'e'.repeat(64)}`;

const registry =
  (manifest: Response) =>
  async (url: string | URL): Promise<Response> =>
    String(url).includes('/token')
      ? new Response(JSON.stringify({ token: 'a pull token' }), { status: 200 })
      : manifest;

describe('digestOf', () => {
  it('reads the digest the registry reports for a published version', async () => {
    const answer = new Response('', {
      status: 200,
      headers: { 'docker-content-digest': DIGEST },
    });

    await expect(digestOf('charlouze/beacon-companion', '0.6', registry(answer))).resolves.toEqual(
      DIGEST,
    );
  });

  // A tag that was never pushed, or a typo in the version. Resolving it to
  // nothing and writing that would pin the catalogue to an image that does not
  // exist, which no machine would discover before a session.
  it('refuses an answer that names no digest', async () => {
    const answer = new Response('not found', { status: 404 });

    await expect(digestOf('charlouze/beacon-companion', '9.9', registry(answer))).rejects.toThrow(
      /9\.9/,
    );
  });
});
