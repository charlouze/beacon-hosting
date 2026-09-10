import { gesturesClosing, type Readings } from './gap.js';
import { accountMember, roleNames, serviceNames, WANTED } from './wanted.js';
import { principalSetFor } from './federation.js';

const settled: Readings = {
  accountExists: true,
  projectPolicy: JSON.stringify({
    bindings: roleNames(WANTED).map((role) => ({
      role,
      members: [accountMember()],
    })),
  }),
  enabledServices: JSON.stringify(
    serviceNames(WANTED).map((service) => ({
      config: { name: service },
      state: 'ENABLED',
    })),
  ),
  poolExists: true,
  provider: JSON.stringify({
    state: 'ACTIVE',
    oidc: { issuerUri: WANTED.issuerUri },
    attributeCondition: `assertion.repository=='${WANTED.repository}' && assertion.ref=='refs/heads/main'`,
  }),
  accountPolicy: JSON.stringify({
    bindings: [
      {
        role: 'roles/iam.workloadIdentityUser',
        members: [
          principalSetFor(WANTED.projectNumber, WANTED.pool, WANTED.repository),
        ],
      },
    ],
  }),
};

/** Nothing in place: every gesture the tool can produce comes out at once. */
const bare: Readings = {
  accountExists: false,
  projectPolicy: JSON.stringify({ bindings: [] }),
  enabledServices: '[]',
  poolExists: false,
  provider: null,
  accountPolicy: null,
};

describe('gesturesClosing', () => {
  it('proposes nothing when the account is already as wanted', () => {
    expect(gesturesClosing(settled, WANTED)).toEqual([]);
  });

  // Consent is given on the sentence, so every gesture owes one — the roles
  // and the apis are not a special case that deserves an explanation while
  // creating the account, the pool or the provider gets by on a bare statement
  // of what is missing. This runs on the empty reading precisely so that a
  // gesture added later cannot slip through without saying what it does.
  it('says of every gesture what running it does, whichever gesture it is', () => {
    const gestures = gesturesClosing(bare, WANTED);

    expect(gestures.filter((gesture) => gesture.does.trim() === '')).toEqual(
      [],
    );
  });

  it('says of every gesture why it is proposed', () => {
    const gestures = gesturesClosing(bare, WANTED);

    expect(gestures.filter((gesture) => gesture.why.trim() === '')).toEqual([]);
  });

  it('creates the account before it grants anything to it', () => {
    const gestures = gesturesClosing(
      {
        ...settled,
        accountExists: false,
        projectPolicy: JSON.stringify({ bindings: [] }),
      },
      WANTED,
    );

    expect(gestures[0]?.args).toContain('create');
    expect(gestures[0]?.args).toContain(WANTED.account);
    expect(
      gestures
        .slice(1)
        .every((gesture) => gesture.args.includes('add-iam-policy-binding')),
    ).toBe(true);
  });

  it('names one gesture per missing role', () => {
    const kept = roleNames(WANTED).slice(0, 3);
    const gestures = gesturesClosing(
      {
        ...settled,
        projectPolicy: JSON.stringify({
          bindings: kept.map((role) => ({ role, members: [accountMember()] })),
        }),
      },
      WANTED,
    );

    expect(gestures).toHaveLength(WANTED.roles.length - kept.length);
  });

  // Each command is confirmed on its own, on the strength of this sentence.
  // Carrying only the role name, it would ask an operator to grant an
  // administrator right on the project because a list said so — which is the
  // block assent, moved one line down and dressed as thirteen questions.
  it('says of each missing role what it unblocks, not just its name', () => {
    const gestures = gesturesClosing(
      { ...settled, projectPolicy: JSON.stringify({ bindings: [] }) },
      WANTED,
    );

    for (const role of WANTED.roles) {
      expect(
        gestures.some((gesture) => gesture.does.includes(role.unlocks)),
      ).toBe(true);
    }
  });

  // Nine apis under one `services enable` would be one assent for nine
  // decisions, and the operator could not refuse one of them.
  it('asks for each missing api on its own', () => {
    const gestures = gesturesClosing(
      { ...settled, enabledServices: '[]' },
      WANTED,
    );

    expect(gestures).toHaveLength(WANTED.services.length);
    expect(
      gestures.every((gesture) =>
        WANTED.services.some((service) =>
          gesture.does.includes(service.unlocks),
        ),
      ),
    ).toBe(true);
  });

  // The provider exists, so no `create` would ever run again — and its
  // condition is what decides whether every repository on GitHub can deploy.
  // Left to `create`, this is the one fault the tool would report for ever and
  // never close.
  it('updates the condition of a provider that is already there', () => {
    const gestures = gesturesClosing(
      {
        ...settled,
        provider: JSON.stringify({
          state: 'ACTIVE',
          oidc: { issuerUri: WANTED.issuerUri },
        }),
      },
      WANTED,
    );

    expect(gestures).toHaveLength(1);
    expect(gestures[0]?.args).toContain('update-oidc');
    expect(gestures[0]?.args.join(' ')).toContain(WANTED.repository);
  });
});
