/** The branch a merge lands on, and the only one a deployment may run from (§10). */
export const DEPLOYING_REF = 'refs/heads/main';

/**
 * Who may impersonate the deployment account, spelled as the *repository
 * attribute* of the pool rather than the pool itself.
 *
 * The distinction is the whole security of the arrangement, and both halves
 * are needed: the provider's condition refuses a foreign token at the door,
 * this refuses whatever the pool admits later from taking this account. Aimed
 * at the pool — `…/workloadIdentityPools/github/*` — it would hand the account
 * to every identity the pool ever accepts, which is exactly the failure the
 * condition upstream exists to prevent, reintroduced one line below it.
 */
export function principalSetFor(
  projectNumber: string,
  pool: string,
  repository: string,
): string {
  return (
    `principalSet://iam.googleapis.com/projects/${projectNumber}` +
    `/locations/global/workloadIdentityPools/${pool}/attribute.repository/${repository}`
  );
}

interface OidcProvider {
  readonly state?: string;
  readonly disabled?: boolean;
  readonly attributeCondition?: string;
  readonly oidc?: { readonly issuerUri?: string };
}

/**
 * What is wrong with the provider, in the operator's words, read out of
 * `gcloud iam workload-identity-pools providers describe --format=json`.
 *
 * This is the one reading of the whole audit that a green result cannot be
 * inferred from: a provider that exists, is active, and points at GitHub looks
 * finished from every console page. Whether its condition pins the repository
 * and the branch is the entire difference between one repository being able to
 * deploy and every repository on GitHub being able to.
 *
 * The condition is matched on the substrings that carry the meaning rather
 * than parsed as CEL: gcloud returns the expression as it was typed, spacing
 * and quotes included, and a parser here would be a second dialect to keep
 * true. What it costs is that a condition mentioning the repository inside a
 * disjunction reads as pinned — worth saying, and not worth a CEL engine.
 */
export function faultsInProvider(
  providerJson: string,
  repository: string,
): string[] {
  const provider: OidcProvider = JSON.parse(providerJson);
  const faults: string[] = [];

  if (
    provider.disabled === true ||
    (provider.state !== undefined && provider.state !== 'ACTIVE')
  ) {
    faults.push(
      'il est désactivé : aucun workflow ne peut s’authentifier au travers',
    );
  }

  const condition = provider.attributeCondition;
  if (condition === undefined || condition.trim() === '') {
    faults.push(
      'il ne porte aucune condition d’attribut : n’importe quel dépôt GitHub peut prendre cette identité',
    );
    return faults;
  }

  if (!condition.includes(repository)) {
    faults.push(`sa condition ne nomme pas ${repository}`);
  } else if (!condition.includes(DEPLOYING_REF)) {
    faults.push(
      `sa condition n’épingle pas ${DEPLOYING_REF} : n’importe quelle branche du dépôt peut déployer`,
    );
  }

  return faults;
}
