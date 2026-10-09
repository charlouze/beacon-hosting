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
  'ghcr.io/charlouze/beacon-companion@sha256:d5832af5ad46a8b5df5d656850bd116156cafe3456189c015d21da961d09e726';

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
  'sha256:0713573611b5d80845d0575deaf1ee2216eb97162a943a201e8afdc855b8cfb0';
