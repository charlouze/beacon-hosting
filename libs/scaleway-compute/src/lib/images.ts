import type { Marketplacev2 } from '@scaleway/sdk';

/**
 * `image` on a server creation wants a uuid, and it differs per zone and per
 * commercial type; `ubuntu_noble` is a marketplace label. Hand-rolled against
 * the http api, this resolution guessed the response shape wrong twice — the
 * sdk knows it.
 */
export interface ImageResolver {
  /** Null when the zone offers no such image for that size. */
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
      const image = localImages.find((candidate) =>
        (candidate.compatibleCommercialTypes ?? []).includes(commercialType),
      );
      return image?.id ?? null;
    },
  };
}
