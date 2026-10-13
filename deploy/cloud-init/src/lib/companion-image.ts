/**
 * §10: pinned by digest, never a moving tag — the one component that writes to
 * the bucket, so a tag that moved under a session nobody watched would be the
 * one image nobody tested. Re-resolve by hand from a published git tag, never
 * by re-pulling a floating one.
 *
 * One copy for the whole catalogue, and that is the point: two entries holding
 * two digests would be two answers to "which companion ran tonight", and the
 * day a new image is published there must be exactly two lines to change.
 */
export const COMPANION_IMAGE =
  'ghcr.io/charlouze/beacon-companion@sha256:4e62ac0791518759ad0981c8186293d5582ecb7dddf70e28e3df68e8550e4f96';

/**
 * The sources that image was built from, so that a companion changed without
 * being republished is caught by a test rather than by an evening in
 * production — 2026-09-16, where a control plane that spoke of worlds drove the
 * companion of two days before, restored the wrong world, and could close no
 * session.
 *
 * Never edited by hand: `nx run companion:pin -- <version>` writes it, and
 * `catalogue-pin.spec.ts` reads it.
 */
export const COMPANION_SOURCES =
  'sha256:e134d7a12eea4282358363bd4e4cd4e9b69c0ea65cb8276f1d207ae8decd848b';
