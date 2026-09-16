import { describe, expect, it } from 'vitest';
import { sourcesIn } from './catalogue-pin.js';
import { runPin } from './run-pin.js';

const DIGEST = `sha256:${'c'.repeat(64)}`;
const SOURCES = `sha256:${'d'.repeat(64)}`;

const CATALOGUE = `export const COMPANION_IMAGE =
  'ghcr.io/charlouze/beacon-companion@sha256:${'a'.repeat(64)}';

export const COMPANION_SOURCES = 'sha256:${'b'.repeat(64)}';
`;

describe('runPin', () => {
  it('records the digest the registry resolved beside the fingerprint of the tree', async () => {
    let written = '';

    await runPin({
      version: '0.6',
      read: () => CATALOGUE,
      write: (text) => {
        written = text;
      },
      digest: async () => DIGEST,
      fingerprint: () => SOURCES,
    });

    expect(written).toContain(`beacon-companion@${DIGEST}`);
    expect(sourcesIn(written)).toEqual(SOURCES);
  });
});
