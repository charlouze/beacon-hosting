import { writeFileSync } from 'node:fs';

/**
 * A commit reference, and nothing that could be mistaken for one. The value
 * lands inside a string literal in a file the build compiles: a quote in it
 * would not fail the stamp, it would fail the build hours later, in the
 * workflow that deploys.
 */
const COMMIT_REFERENCE = /^[0-9a-f]{7,40}$/;

/**
 * Everything above the stamped line, byte for byte what the repository holds.
 * A stamp that changed a second line would make every deployment show a diff
 * nobody reads, and the day one matters nobody would see it.
 */
const PREAMBLE = `/**
 * The rules version this bundle was compiled against. The deployment stamps
 * the same commit reference on \`config/settings\`, and a tab left open since
 * yesterday reloads once the two drift apart.
 *
 * Rewritten by the deployment, through \`nx run rules-stamp:stamp -- <sha>\`.
 * 'dev' is what a checkout carries, and no deployment ever stamps it.
 */
`;

export function renderRulesVersion(sha: string): string {
  if (!COMMIT_REFERENCE.test(sha)) {
    throw new Error(`not a commit reference: ${JSON.stringify(sha)}`);
  }
  return `${PREAMBLE}export const COMPILED_RULES_VERSION = '${sha}';\n`;
}

/**
 * The module the browser bundle compiles. The stamp lives in its own project
 * rather than under `apps/web`, because it reads and writes files: the Angular
 * compiler refuses `node:fs` outright, and a spec it cannot compile is a spec
 * that never runs while looking green.
 */
export const MODULE = new URL('../../../../apps/web/src/app/rules-version.ts', import.meta.url);

export function stampRulesVersion(sha: string): void {
  writeFileSync(MODULE, renderRulesVersion(sha));
}
