/**
 * Scaleway Object Storage's own multipart cap, ten times tighter than the AWS
 * S3 value `@aws-sdk/lib-storage`'s `Upload` assumes when no `partSize` is
 * given: left to itself it aims for AWS's 10 000 parts, and a Sunkenland
 * archive past ~5 GB already lands past 1000 at the 5 MiB default part size —
 * `InvalidArgument: Part number must be an integer between 1 and 1000`.
 */
export const SCALEWAY_MAX_PARTS = 1000;

/** The smallest part S3-compatible multipart uploads accept, Scaleway included. */
const MIN_PART_SIZE_BYTES = 5 * 1024 * 1024;

/** A part size that keeps any archive under `SCALEWAY_MAX_PARTS`, however large it grows. */
export function partSizeFor(sizeBytes: number): number {
  return Math.max(MIN_PART_SIZE_BYTES, Math.ceil(sizeBytes / SCALEWAY_MAX_PARTS));
}
