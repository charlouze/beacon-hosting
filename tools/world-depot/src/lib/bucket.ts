/**
 * Which bucket the two gestures read and write, named explicitly or not at all.
 *
 * **There is no default, and that is the whole point.** This project has one
 * hosting account and no staging: a fallback to `beacon-saves` would let an
 * administrator who meant to try an adoption against a local MinIO, and who
 * forgot the variable, deposit into production instead — with a confirmation
 * that said yes, because it named the game and the covered save and never the
 * bucket. Failing here is the cheap version of that mistake.
 *
 * Same convention as `tools/game-depot/src/push.ts`: the variable is named in
 * the refusal, and an empty value is as unset as a missing one.
 */
export function savesBucketFrom(env: Record<string, string | undefined>): string {
  const bucket = env['BEACON_SAVES_BUCKET'];
  if (bucket === undefined || bucket === '') {
    throw new Error('BEACON_SAVES_BUCKET is required: name the bucket, there is no default (production has no twin)');
  }
  return bucket;
}
