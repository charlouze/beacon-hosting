/**
 * The module that declares what the Functions need at runtime. Read rather
 * than mirrored, because a list kept beside it is a list that drifts: that is
 * exactly what happened to `tools/dev-secrets.mjs`, which went a whole tranche
 * without `S3_SECRET_KEY` and showed it as an emulator failing to authenticate
 * minutes into a session, far from the commit that caused it.
 */
export const CONTAINER = new URL(
  '../../../../apps/functions/src/container.ts',
  import.meta.url,
);

const DEFINE_SECRET = /defineSecret\(\s*['"]([A-Z0-9_]+)['"]\s*\)/g;

/**
 * Every secret the source declares, in the order it declares them.
 *
 * An empty result is refused rather than returned: asked for nothing, this
 * tool would print a cheerful "nothing to do" on a deployment that cannot
 * start, and the operator would go looking anywhere but here. The only ways to
 * get there are a moved file or a renamed helper, and both deserve a stop.
 */
export function secretsDeclaredIn(source: string): string[] {
  const names = [...source.matchAll(DEFINE_SECRET)].map((match) => match[1]);
  if (names.length === 0) {
    throw new Error(
      'aucun defineSecret trouvé : ce n’est pas le container, ou il n’en déclare plus',
    );
  }
  return names;
}
