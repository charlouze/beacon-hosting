import { accountEmail, WANTED } from './wanted.js';

type Wanted = typeof WANTED;

/**
 * The url of the `agentReport` function, which does not exist until the very
 * deployment these variables enable has published it once. Demanded here it
 * would make the first deployment impossible, which is the one case a
 * bootstrap has to survive — so it is never asked for, and `deploy.yml`
 * tolerates it empty, loudly, exactly once.
 */
export const LEFT_FOR_LATER = 'AGENT_ENDPOINT';

/**
 * Where the operator reads what no file in the repository states. Printed with
 * the question, because the two Scaleway keys look alike enough that "the
 * access key" is not an instruction — and the public half is the one wanted
 * here, the private half being a secret that never comes near this tool.
 */
export const WHERE_TO_READ: Record<string, string> = {
  SCW_ACCESS_KEY: 'console Scaleway → IAM → Clés API, la moitié publique, SCW…',
  S3_ACCESS_KEY:
    'la même clé que SCW_ACCESS_KEY — Scaleway signe l’Object Storage avec elle',
  SCW_PROJECT_ID:
    'console Scaleway → Paramètres du projet → ID du projet, un uuid',
};

export interface VariableGap {
  /** Ready to run: the repository or this file already knows the value. */
  readonly toSet: readonly { readonly name: string; readonly value: string }[];
  /** Nothing in the repository can know these; the operator is asked. */
  readonly toAsk: readonly string[];
  readonly leftForLater: readonly string[];
}

export function wifProviderFor(wanted: Wanted): string {
  return (
    `projects/${wanted.projectNumber}/locations/global/workloadIdentityPools/` +
    `${wanted.pool}/providers/${wanted.provider}`
  );
}

/**
 * Every value the repository can produce on its own — the three GCP ones from
 * the wanted state, the rest from the example file the deployment mirrors.
 *
 * Asking an operator for a value that is already written down is how a
 * `principalSet` ends up naming a project id instead of a project number: the
 * binding lands, nothing refuses it, and the first deployment fails on a
 * message about permissions.
 */
export function knownValuesFor(
  wanted: Wanted,
  defaults: Record<string, string>,
): Record<string, string> {
  return {
    ...defaults,
    FIREBASE_PROJECT_ID: wanted.project,
    WIF_PROVIDER: wifProviderFor(wanted),
    DEPLOY_SERVICE_ACCOUNT: accountEmail(wanted),
  };
}

/**
 * What is missing, split by who can supply it, read out of
 * `gh variable list --json name,value`.
 *
 * A variable listed with an empty value counts as missing: that is exactly the
 * state the workflow's guard refuses by name, because `vars.X` on a variable
 * nobody set expands to the empty string and nothing turns red.
 */
export function variableGap(
  names: readonly string[],
  listedJson: string,
  known: Record<string, string>,
): VariableGap {
  const listed: readonly { readonly name?: string; readonly value?: string }[] =
    JSON.parse(listedJson);
  const carried = new Set(
    listed
      .filter((variable) => (variable.value ?? '') !== '')
      .map((variable) => variable.name)
      .filter((name): name is string => name !== undefined),
  );

  const missing = names.filter((name) => !carried.has(name));

  return {
    toSet: missing
      .filter((name) => known[name] !== undefined)
      .map((name) => ({ name, value: known[name] })),
    toAsk: missing.filter(
      (name) => known[name] === undefined && name !== LEFT_FOR_LATER,
    ),
    leftForLater: missing.filter((name) => name === LEFT_FOR_LATER),
  };
}
