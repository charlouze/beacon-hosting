interface Binding {
  readonly role: string;
  readonly members?: readonly string[];
  readonly condition?: unknown;
}

interface IamPolicy {
  readonly bindings?: readonly Binding[];
}

/**
 * The wanted roles this member does not already hold, read out of
 * `gcloud projects get-iam-policy --format=json`.
 *
 * A binding carrying a `condition` counts for nothing here, and that is the
 * point rather than an oversight: a conditional grant is a different right,
 * and the conditions that show up on a deployment account are the ones that
 * expire. Counted as held, the account would pass this audit on the morning
 * its permission lapses, and the merge that fails would be the one nobody is
 * watching.
 */
export function rolesMissingFrom(
  policyJson: string,
  member: string,
  wanted: readonly string[],
): string[] {
  const held = rolesHeldBy(policyJson, member);
  return wanted.filter((role) => !held.has(role));
}

/**
 * The roles this member holds that the wanted list does not name — the mirror
 * of `rolesMissingFrom`, and the reason the list can shrink: the gestures only
 * ever added, so a role the list stopped wanting stayed granted for ever.
 *
 * Conditional bindings are left out here too, and for the mirrored reason: a
 * grant under a condition was put there by a decision this tool never made,
 * so it does not get to propose unmaking it.
 */
export function rolesHeldBeyond(
  policyJson: string,
  member: string,
  wanted: readonly string[],
): string[] {
  const wantedSet = new Set(wanted);
  return [...rolesHeldBy(policyJson, member)].filter(
    (role) => !wantedSet.has(role),
  );
}

function rolesHeldBy(policyJson: string, member: string): Set<string> {
  const policy: IamPolicy = JSON.parse(policyJson);
  return new Set(
    (policy.bindings ?? [])
      .filter((binding) => binding.condition === undefined)
      .filter((binding) => (binding.members ?? []).includes(member))
      .map((binding) => binding.role),
  );
}
