import { describe, expect, it } from 'vitest';
import { pinnedSources, repositoryIn, sourcesIn, withPin } from './catalogue-pin.js';
import { companionFingerprint } from './fingerprint.js';

const CATALOGUE = `export const COMPANION_IMAGE =
  'ghcr.io/charlouze/beacon-companion@sha256:${'a'.repeat(64)}';

export const COMPANION_SOURCES = 'sha256:${'b'.repeat(64)}';
`;

describe('sourcesIn', () => {
  it('reads the fingerprint the catalogue records', () => {
    expect(sourcesIn(CATALOGUE)).toEqual(`sha256:${'b'.repeat(64)}`);
  });
});

describe('repositoryIn', () => {
  // Read from the pin rather than spelled a second time: a target that resolved
  // a repository the catalogue no longer names would pin the digest of another
  // image entirely, and every check here would agree with it.
  it('names the repository the pinned image lives in', () => {
    expect(repositoryIn(CATALOGUE)).toEqual('charlouze/beacon-companion');
  });
});

describe('withPin', () => {
  it('moves the digest and the fingerprint together, and nothing else', () => {
    const digest = `sha256:${'c'.repeat(64)}`;
    const sources = `sha256:${'d'.repeat(64)}`;

    const written = withPin(CATALOGUE, digest, sources);

    expect(written).toContain(`beacon-companion@${digest}`);
    expect(sourcesIn(written)).toEqual(sources);
    expect(written).toContain('export const COMPANION_IMAGE =');
  });

  // Silently writing nothing is how a pin stays stale while every command
  // reports success — the failure this whole guard exists to end.
  it('refuses a catalogue it does not recognise, rather than leaving it as it was', () => {
    expect(() => withPin('nothing to pin here', 'sha256:x', 'sha256:y')).toThrow();
  });

  // The catalogue is prettier-formatted: a value long enough to wrap sits on
  // its own line. Rewriting the whole assignment would join it back up, and
  // the target would leave a diff behind every time it ran on an unchanged
  // tree — an idempotent gesture that is not idempotent gets distrusted.
  it('leaves the layout around the value exactly as it found it', () => {
    const wrapped = `export const COMPANION_IMAGE =
  'ghcr.io/charlouze/beacon-companion@sha256:${'a'.repeat(64)}';

export const COMPANION_SOURCES =
  'sha256:${'b'.repeat(64)}';
`;

    const written = withPin(wrapped, `sha256:${'c'.repeat(64)}`, `sha256:${'d'.repeat(64)}`);

    expect(written).toContain(`export const COMPANION_SOURCES =
  'sha256:${'d'.repeat(64)}';`);
  });
});

describe('the pin the catalogue carries', () => {
  // The guard. Red here means the image on every game machine was built from
  // other sources than these — publish one (`git tag companion-v<n>`), then
  // `nx run companion:pin -- <n>`, then push. It would have been red on the
  // merge that shipped worlds with the companion of the evening before.
  it('names an image built from the sources in the tree', () => {
    expect(pinnedSources()).toEqual(companionFingerprint());
  });
});
