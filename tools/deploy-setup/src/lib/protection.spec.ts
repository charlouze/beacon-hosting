import { faultsInProtection, REQUIRED_CHECK, rulesetBody } from './protection.js';

const settled = JSON.stringify([
  { type: 'deletion' },
  { type: 'non_fast_forward' },
  { type: 'creation' },
  {
    type: 'required_status_checks',
    parameters: { required_status_checks: [{ context: REQUIRED_CHECK }] },
  },
]);

describe('faultsInProtection', () => {
  it('finds nothing wrong with a branch a ruleset protects as §10 asks', () => {
    expect(faultsInProtection(settled)).toEqual([]);
  });

  it('refuses a branch no rule applies to', () => {
    expect(faultsInProtection('[]')).toEqual([
      'aucune règle ne s’applique à main : la barrière du §10 se contourne d’un git push',
    ]);
  });

  // The one that gets forgotten, and the one that matters most: without it a
  // pull request can be merged while its tests are red, and a merge is the
  // production deployment. It is also what forbids a direct push here, since
  // `verify` only ever runs on a pull request — nothing pushed straight to
  // main can satisfy it.
  it('refuses rules that do not require the verify check', () => {
    const noCheck = JSON.parse(settled).filter(
      (rule: { type: string }) => rule.type !== 'required_status_checks',
    );

    expect(faultsInProtection(JSON.stringify(noCheck))).toContain(
      `elle n’exige pas la vérification ${REQUIRED_CHECK} de pull-request.yml`,
    );
  });

  it('refuses a required check that is not the one this repository runs', () => {
    const other = JSON.parse(settled);
    other[3].parameters.required_status_checks = [{ context: 'something-else' }];

    expect(faultsInProtection(JSON.stringify(other))).toContain(
      `elle n’exige pas la vérification ${REQUIRED_CHECK} de pull-request.yml`,
    );
  });

  it('refuses rules that still allow a force push', () => {
    const forceable = JSON.parse(settled).filter(
      (rule: { type: string }) => rule.type !== 'non_fast_forward',
    );

    expect(faultsInProtection(JSON.stringify(forceable))).toContain(
      'elle laisse passer une poussée forcée',
    );
  });

  it('refuses rules that still allow deleting the branch', () => {
    const deletable = JSON.parse(settled).filter(
      (rule: { type: string }) => rule.type !== 'deletion',
    );

    expect(faultsInProtection(JSON.stringify(deletable))).toContain(
      'elle laisse supprimer la branche',
    );
  });
});

describe('rulesetBody', () => {
  // A ruleset and not the legacy branch protection, and the distinction is not
  // cosmetic: this repository is already protected by one, and the legacy PUT
  // would have laid a second, independent mechanism on the same branch — two
  // places to read, and two to keep true.
  it('targets the default branch, and lets nobody bypass', () => {
    const body = JSON.parse(rulesetBody());

    expect(body.target).toBe('branch');
    expect(body.enforcement).toBe('active');
    expect(body.conditions.ref_name.include).toEqual(['~DEFAULT_BRANCH']);
    expect(body.bypass_actors).toEqual([]);
  });

  it('asks for exactly what the audit checks', () => {
    const body = JSON.parse(rulesetBody());
    const types = body.rules.map((rule: { type: string }) => rule.type);

    expect(types).toEqual(
      expect.arrayContaining(['deletion', 'non_fast_forward', 'required_status_checks']),
    );
    expect(faultsInProtection(JSON.stringify(body.rules))).toEqual([]);
  });
});
