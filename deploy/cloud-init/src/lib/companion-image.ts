/**
 * §10: pinned by digest, never a moving tag — the one component that writes to
 * the bucket, so a tag that moved under a session nobody watched would be the
 * one image nobody tested. Re-resolve by hand from a published git tag, never
 * by re-pulling a floating one.
 *
 * One copy for the whole catalogue, and that is the point: two entries holding
 * two digests would be two answers to "which companion ran tonight", and the
 * day a new image is published there must be exactly one line to change.
 */
export const COMPANION_IMAGE =
  'ghcr.io/charlouze/beacon-companion@sha256:4728d2de3e4abc9b7439b25e299e1a70fe86f32ecccb9d98dd6e44debed817ca';
