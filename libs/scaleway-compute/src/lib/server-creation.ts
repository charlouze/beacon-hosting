import type { ImageResolver } from './images.js';
import { BLOCK_VOLUME_TYPE, type ServerCreation } from './instance-api.js';

/** The provider counts a volume in bytes, and a gigabyte in powers of ten. */
const BYTES_PER_GB = 1e9;

export interface ServerOrder {
  readonly name: string;
  readonly commercialType: string;
  readonly diskGb: number;
  readonly tags: string[];
}

/**
 * The one place a server creation is composed, for `open()` and for the
 * contract suite alike: the image that boots on a block volume, and a block
 * root volume of the size ordered. The two go together — a local image on a
 * block volume, or the reverse, is a pairing nobody measured.
 *
 * Null when no such image exists for that size, and nothing is created yet.
 */
export async function serverCreation(
  images: ImageResolver,
  order: ServerOrder,
): Promise<ServerCreation | null> {
  const image = await images.resolve(order.commercialType);
  if (image === null) return null;

  return {
    name: order.name,
    commercialType: order.commercialType,
    image,
    tags: order.tags,
    volumes: { '0': { size: order.diskGb * BYTES_PER_GB, volumeType: BLOCK_VOLUME_TYPE } },
  };
}
