import type { Marketplacev2 } from '@scaleway/sdk';
import { describe, expect, it } from 'vitest';
import { marketplaceImages } from './images.js';

const image = (id: string, type: string, compatibleCommercialTypes?: string[]) => ({
  id,
  type,
  compatibleCommercialTypes,
});

/**
 * What the marketplace listed for `ubuntu_noble` in fr-par-1 on 2026-10-08, as
 * `probe/scaleway/volume-probe.ts` read it: on `DEV1-L` a local image comes
 * first and a block one follows, on `PLAY2-MICRO` there is a block one only.
 */
const LISTED = [
  image('img-local', 'instance_local', ['DEV1-L', 'DEV1-M']),
  image('img-sbs', 'instance_sbs', ['DEV1-L', 'PLAY2-MICRO']),
];

const requests: unknown[] = [];
const marketplace = (localImages: unknown[]) =>
  ({
    listLocalImages: async (request: unknown) => {
      requests.push(request);
      return { localImages };
    },
  }) as unknown as Marketplacev2.API;

describe('marketplaceImages', () => {
  // The first compatible image is the local one, and a server created from it
  // on a block root volume is the pairing nobody measured.
  it('takes the block image for a size a local image is listed first for', async () => {
    expect(await marketplaceImages(marketplace(LISTED), 'fr-par-1').resolve('DEV1-L')).toBe('img-sbs');
  });

  it('takes the block image for a size that has no local one', async () => {
    expect(await marketplaceImages(marketplace(LISTED), 'fr-par-1').resolve('PLAY2-MICRO')).toBe(
      'img-sbs',
    );
  });

  it('answers null for a size only a local image boots', async () => {
    expect(await marketplaceImages(marketplace(LISTED), 'fr-par-1').resolve('DEV1-M')).toBeNull();
  });

  it('answers null for a size no image names', async () => {
    expect(await marketplaceImages(marketplace(LISTED), 'fr-par-1').resolve('PRO2-XXS')).toBeNull();
  });

  it('skips an image that names no compatible size at all', async () => {
    const listed = [image('img-bare', 'instance_sbs'), ...LISTED];

    expect(await marketplaceImages(marketplace(listed), 'fr-par-1').resolve('DEV1-L')).toBe('img-sbs');
  });

  it('asks for the label in the zone it was built for', async () => {
    requests.length = 0;

    await marketplaceImages(marketplace(LISTED), 'fr-par-1').resolve('DEV1-L');

    expect(requests).toEqual([{ imageLabel: 'ubuntu_noble', zone: 'fr-par-1', pageSize: 100 }]);
  });
});
