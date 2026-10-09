import type { Marketplacev2 } from '@scaleway/sdk';

/**
 * `type` of a marketplace image that boots on a block volume. An
 * `instance_local` one is built for a local disk, and the first compatible
 * image of `DEV1-L` is of that kind — measured on 2026-10-08.
 */
export const BLOCK_IMAGE_TYPE = 'instance_sbs';

/**
 * `image` on a server creation wants a uuid, and it differs per zone and per
 * commercial type; `ubuntu_noble` is a marketplace label. Hand-rolled against
 * the http api, this resolution guessed the response shape wrong twice — the
 * sdk knows it.
 */
export interface ImageResolver {
  /**
   * The image that boots that size on a block volume. Null when the zone
   * offers none.
   */
  resolve(commercialType: string): Promise<string | null>;
}

export function marketplaceImages(
  api: Marketplacev2.API,
  zone: string,
  label = 'ubuntu_noble',
): ImageResolver {
  return {
    async resolve(commercialType: string): Promise<string | null> {
      const { localImages } = await api.listLocalImages({
        imageLabel: label,
        zone,
        pageSize: 100,
      });
      const image = localImages.find(
        (candidate) =>
          candidate.type === BLOCK_IMAGE_TYPE &&
          (candidate.compatibleCommercialTypes ?? []).includes(commercialType),
      );
      return image?.id ?? null;
    },
  };
}
