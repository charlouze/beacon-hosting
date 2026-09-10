/** The versions of one secret as json, or `null` when there is no such secret. */
export type SecretVersions = Record<string, string | null>;

/**
 * A secret holds something only if one of its versions is enabled. `ENABLED`
 * is checked rather than `not DESTROYED`, so a state this tool has never heard
 * of counts as nothing rather than as a value.
 */
function holdsAValue(versionsJson: string | null): boolean {
  if (versionsJson === null) return false;
  const versions: readonly { readonly state?: string }[] =
    JSON.parse(versionsJson);
  return versions.some((version) => version.state === 'ENABLED');
}

/**
 * Which secrets to ask the operator for: the ones holding nothing, or all of
 * them when a rotation is wanted.
 *
 * Skipping what is already set is what makes this runnable again the day a
 * sixth `defineSecret` appears — the case that recurs. The first pass, where
 * all five are asked, happens once.
 */
export function secretsToAsk(
  declared: readonly string[],
  versions: SecretVersions,
  all = false,
): string[] {
  return declared.filter((name) => all || !holdsAValue(versions[name] ?? null));
}
