import { marketplaceApi } from './client'

// `image` on a server creation wants a uuid, and it differs per zone and per
// commercial type; `ubuntu_noble` is a marketplace label. Hand-rolled, this
// resolution guessed the response shape wrong twice — the SDK knows it.
export async function resolveImageId(
  zone: string,
  commercialType: string,
  label = 'ubuntu_noble',
): Promise<string> {
  const { localImages } = await marketplaceApi().listLocalImages({
    imageLabel: label,
    zone,
    pageSize: 100,
  })

  const image = localImages.find((candidate) =>
    (candidate.compatibleCommercialTypes ?? []).includes(commercialType),
  )
  if (!image) throw new Error(`no ${label} image for ${commercialType} in ${zone}`)

  return image.id
}
