/**
 * The job of `pull-request.yml`. Requiring it is the setting task 12 calls the
 * one that gets forgotten, and it is the one that matters most: without it a
 * pull request merges while its tests are red, and a merge is the production
 * deployment.
 *
 * It is also what forbids a direct push, without a rule saying so: `verify`
 * runs on `pull_request` and on nothing else, so no commit pushed straight to
 * `main` can ever satisfy it. Worth knowing, because the day that workflow
 * gains a `push` trigger, that second guarantee leaves without a word.
 */
export const REQUIRED_CHECK = 'verify';

interface Rule {
  readonly type: string;
  readonly parameters?: {
    readonly required_status_checks?: readonly { readonly context?: string }[];
  };
}

/**
 * What is wrong with the protection of `main`, read out of
 * `gh api repos/:owner/:repo/rules/branches/main` — the rules that actually
 * apply, whichever ruleset they come from.
 *
 * Rulesets and not the legacy `branches/main/protection`, which was this
 * tool's first reading and its worst bug: a branch protected by a ruleset
 * answers 404 there, so a repository that was correctly configured got
 * reported as wide open — and the gesture offered to close it would have laid
 * a second, independent mechanism over the first.
 */
export function faultsInProtection(rulesJson: string): string[] {
  const rules: readonly Rule[] = JSON.parse(rulesJson);
  if (rules.length === 0) {
    return ['aucune règle ne s’applique à main : la barrière du §10 se contourne d’un git push'];
  }

  const faults: string[] = [];
  const has = (type: string): boolean => rules.some((rule) => rule.type === type);

  const checks = rules
    .filter((rule) => rule.type === 'required_status_checks')
    .flatMap((rule) => rule.parameters?.required_status_checks ?? [])
    .map((check) => check.context);

  if (!checks.includes(REQUIRED_CHECK)) {
    faults.push(`elle n’exige pas la vérification ${REQUIRED_CHECK} de pull-request.yml`);
  }
  if (!has('non_fast_forward')) faults.push('elle laisse passer une poussée forcée');
  if (!has('deletion')) faults.push('elle laisse supprimer la branche');

  return faults;
}

/**
 * The ruleset to create when none of the above holds. It names
 * `~DEFAULT_BRANCH` rather than `main`, so renaming the default branch does
 * not silently unprotect it, and it lists no bypass actor — an exception
 * granted here is the barrier of §10, granted away.
 */
export function rulesetBody(): string {
  return JSON.stringify(
    {
      name: 'Default branch protection',
      target: 'branch',
      enforcement: 'active',
      conditions: { ref_name: { include: ['~DEFAULT_BRANCH'], exclude: [] } },
      bypass_actors: [],
      rules: [
        { type: 'deletion' },
        { type: 'non_fast_forward' },
        { type: 'creation' },
        {
          type: 'required_status_checks',
          parameters: {
            strict_required_status_checks_policy: false,
            required_status_checks: [{ context: REQUIRED_CHECK }],
          },
        },
      ],
    },
    null,
    2,
  );
}
