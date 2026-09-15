import { describe, expect, it } from 'vitest';
import { partSizeFor, SCALEWAY_MAX_PARTS } from './part-size.js';

describe('partSizeFor', () => {
  it('keeps a 5.17 GB archive within the parts a multipart upload may have', () => {
    const sizeBytes = Math.round(5.17 * 1024 ** 3);

    const partSize = partSizeFor(sizeBytes);

    expect(Math.ceil(sizeBytes / partSize)).toBeLessThanOrEqual(SCALEWAY_MAX_PARTS);
  });

  it('never drops below the 5 MiB minimum a part may be', () => {
    expect(partSizeFor(1024)).toBe(5 * 1024 * 1024);
  });
});
