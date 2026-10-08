/**
 * The slice of Scaleway's Block Storage API this adapter uses, declared next
 * to `InstanceApi` for the same reason: the adapter is driven without a
 * network, a key, or a cent. `Blockv1.API` is adapted onto it in `from-sdk.ts`.
 *
 * A block volume lives here and nowhere else: the Instance API neither lists
 * it nor deletes it, and answers 404 to the attempt — measured on 2026-10-08.
 */

export interface ScwBlockVolume {
  readonly id: string;
  readonly size: number;
  readonly tags: string[];
  /** What holds the volume. See `isDetached`. */
  readonly references: readonly { readonly id: string }[];
}

export interface BlockApi {
  /**
   * One tag, and the signature allows no more: the filter is exact on a whole
   * tag, and two tags are read as either, not both — measured on 2026-10-08.
   */
  listVolumes(request: { tag: string }): Promise<{ volumes: ScwBlockVolume[] }>;
  /** Replaces the whole tag list. */
  setVolumeTags(request: { volumeId: string; tags: string[] }): Promise<void>;
  /** Refused with a 412 while the volume is attached. */
  deleteVolume(request: { volumeId: string }): Promise<void>;
}

/**
 * Detached means no reference at all. A reference still `detaching` is a
 * reference: the provider refuses the deletion until it is gone.
 */
export const isDetached = (volume: ScwBlockVolume): boolean => volume.references.length === 0;
