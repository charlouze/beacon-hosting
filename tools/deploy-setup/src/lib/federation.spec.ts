import { faultsInProvider, principalSetFor } from './federation.js';

const REPOSITORY = 'charlouze/beacon-hosting';

describe('principalSetFor', () => {
  // `attribute.repository`, at the singular. `attributes.` is not a segment
  // the grammar has, and google refuses the binding outright — which is how
  // this was found, three minutes into a run against the real project, on the
  // tenth of ten gestures. The first version of this test asserted the wrong
  // string, so it held the defect in place rather than catching it: a test
  // written from the same belief as the code proves only that they agree.
  it('names the repository attribute of the pool, not the pool itself', () => {
    expect(principalSetFor('904867606206', 'github', REPOSITORY)).toBe(
      'principalSet://iam.googleapis.com/projects/904867606206/locations/global/workloadIdentityPools/github/attribute.repository/charlouze/beacon-hosting',
    );
  });
});

describe('faultsInProvider', () => {
  it('finds nothing wrong with a provider pinned to the repository and to main', () => {
    const provider = JSON.stringify({
      state: 'ACTIVE',
      oidc: { issuerUri: 'https://token.actions.githubusercontent.com' },
      attributeCondition: `assertion.repository=='${REPOSITORY}' && assertion.ref=='refs/heads/main'`,
    });

    expect(faultsInProvider(provider, REPOSITORY)).toEqual([]);
  });

  it('refuses a provider that carries no condition at all', () => {
    const provider = JSON.stringify({
      state: 'ACTIVE',
      oidc: { issuerUri: 'https://token.actions.githubusercontent.com' },
    });

    expect(faultsInProvider(provider, REPOSITORY)).toEqual([
      'il ne porte aucune condition d’attribut : n’importe quel dépôt GitHub peut prendre cette identité',
    ]);
  });

  it('refuses a condition that names another repository', () => {
    const provider = JSON.stringify({
      state: 'ACTIVE',
      oidc: { issuerUri: 'https://token.actions.githubusercontent.com' },
      attributeCondition:
        "assertion.repository=='someone-else/beacon' && assertion.ref=='refs/heads/main'",
    });

    expect(faultsInProvider(provider, REPOSITORY)).toEqual([
      `sa condition ne nomme pas ${REPOSITORY}`,
    ]);
  });

  it('refuses a condition that pins the repository but not the branch', () => {
    const provider = JSON.stringify({
      state: 'ACTIVE',
      oidc: { issuerUri: 'https://token.actions.githubusercontent.com' },
      attributeCondition: `assertion.repository=='${REPOSITORY}'`,
    });

    expect(faultsInProvider(provider, REPOSITORY)).toEqual([
      'sa condition n’épingle pas refs/heads/main : n’importe quelle branche du dépôt peut déployer',
    ]);
  });
});
