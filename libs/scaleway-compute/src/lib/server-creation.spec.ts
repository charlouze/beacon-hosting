import { describe, expect, it } from 'vitest';
import { serverCreation } from './server-creation.js';

const ORDER = { name: 'beacon-s1', commercialType: 'DEV1-L', diskGb: 40, tags: ['beacon', 'session:s1'] };

describe('serverCreation', () => {
  it('composes a block root volume of the size ordered, on the image the resolver gave', async () => {
    const images = { resolve: async () => 'img-sbs' };

    expect(await serverCreation(images, ORDER)).toEqual({
      name: 'beacon-s1',
      commercialType: 'DEV1-L',
      image: 'img-sbs',
      tags: ['beacon', 'session:s1'],
      volumes: { '0': { size: 40_000_000_000, volumeType: 'sbs_volume' } },
    });
  });

  it('asks the resolver for the size ordered', async () => {
    const asked: string[] = [];
    const images = {
      resolve: async (commercialType: string) => {
        asked.push(commercialType);
        return 'img-sbs';
      },
    };

    await serverCreation(images, { ...ORDER, commercialType: 'PLAY2-MICRO' });

    expect(asked).toEqual(['PLAY2-MICRO']);
  });

  it('composes nothing when no image boots that size on a block volume', async () => {
    expect(await serverCreation({ resolve: async () => null }, ORDER)).toBeNull();
  });
});
