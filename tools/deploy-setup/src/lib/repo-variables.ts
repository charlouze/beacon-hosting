/**
 * The workflow that reads the repository variables. Its `vars.X` occurrences
 * are the list, rather than a copy kept here: the two would drift, and the
 * drift has a known shape in this repository — a value nobody set is the empty
 * string, so the deployment goes green on a configuration no session can use.
 */
export const DEPLOY_WORKFLOW = new URL(
  '../../../../.github/workflows/deploy.yml',
  import.meta.url,
);

/**
 * The non-secret parameters the repository already spells out in clear. What
 * this file carries is what the deployment should send; the operator is only
 * ever asked for what no file in the repository can know.
 */
export const ENV_EXAMPLE = new URL(
  '../../../../apps/functions/.env.example',
  import.meta.url,
);

/**
 * The whole expression and not just `vars.NAME`: `deploy.yml` explains its own
 * guard in prose, and the sentence that says a missing `vars.X` expands to the
 * empty string would otherwise be read as a twelfth variable to create.
 */
const VARS = /\$\{\{\s*vars\.([A-Z0-9_]+)\s*\}\}/g;
const ASSIGNMENT = /^([A-Z0-9_]+)=(.+)$/;

/** Every repository variable the workflow reads, once each, in first-seen order. */
export function variablesReadBy(workflow: string): string[] {
  return [...new Set([...workflow.matchAll(VARS)].map((match) => match[1]))];
}

/** The values an example env file states, skipping the keys it leaves blank. */
export function defaultsIn(example: string): Record<string, string> {
  const defaults: Record<string, string> = {};
  for (const line of example.split(/\r?\n/)) {
    const assignment = ASSIGNMENT.exec(line.trim());
    if (assignment) defaults[assignment[1]] = assignment[2];
  }
  return defaults;
}
