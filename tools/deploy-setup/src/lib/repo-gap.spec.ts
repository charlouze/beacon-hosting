import { knownValuesFor, variableGap } from './repo-gap.js';
import { accountEmail, WANTED } from './wanted.js';

describe('knownValuesFor', () => {
  // The point of the whole file: an operator asked for a value the repository
  // already states is an operator who will paste it wrong once.
  it('derives the three GCP ones from the wanted state, asking nobody', () => {
    const known = knownValuesFor(WANTED, {});

    expect(known['FIREBASE_PROJECT_ID']).toBe(WANTED.project);
    expect(known['DEPLOY_SERVICE_ACCOUNT']).toBe(accountEmail(WANTED));
    expect(known['WIF_PROVIDER']).toBe(
      `projects/${WANTED.projectNumber}/locations/global/workloadIdentityPools/` +
        `${WANTED.pool}/providers/${WANTED.provider}`,
    );
  });

  it('takes the rest from what the example file states', () => {
    const known = knownValuesFor(WANTED, { SCW_ZONE: 'fr-par-1' });

    expect(known['SCW_ZONE']).toBe('fr-par-1');
  });
});

describe('variableGap', () => {
  const names = ['FIREBASE_PROJECT_ID', 'SCW_ACCESS_KEY', 'AGENT_ENDPOINT'];
  const known = { FIREBASE_PROJECT_ID: 'beacon-hosting-charlouze' };

  it('sets what it knows, and asks only for what no file can know', () => {
    const gap = variableGap(names, JSON.stringify([]), known);

    expect(gap.toSet).toEqual([
      { name: 'FIREBASE_PROJECT_ID', value: 'beacon-hosting-charlouze' },
    ]);
    expect(gap.toAsk).toEqual(['SCW_ACCESS_KEY']);
  });

  // It is the url of a function this very deployment creates, so demanding it
  // would make the first deployment impossible — the one case a bootstrap has
  // to survive. `deploy.yml` tolerates it empty exactly once, and warns.
  it('never asks for AGENT_ENDPOINT, and says it is left for later', () => {
    const gap = variableGap(names, JSON.stringify([]), known);

    expect(gap.toAsk).not.toContain('AGENT_ENDPOINT');
    expect(gap.leftForLater).toEqual(['AGENT_ENDPOINT']);
  });

  it('leaves alone a variable the repository already carries', () => {
    const listed = JSON.stringify([
      { name: 'FIREBASE_PROJECT_ID', value: 'beacon' },
    ]);

    expect(variableGap(names, listed, known).toSet).toEqual([]);
  });

  // `gh variable list` returns the name of a variable set to the empty string,
  // and that is precisely the state the workflow's guard exists to refuse.
  it('sets one that is there but empty', () => {
    const listed = JSON.stringify([{ name: 'FIREBASE_PROJECT_ID', value: '' }]);

    expect(variableGap(names, listed, known).toSet).toHaveLength(1);
  });
});
