import { gesturesClosing, type Readings } from './gap.js';
import {
  accountMember,
  agentBindings,
  roleNames,
  serviceNames,
  WANTED,
} from './wanted.js';
import { principalSetFor } from './federation.js';

const settled: Readings = {
  accountExists: true,
  projectPolicy: JSON.stringify({
    bindings: [
      ...roleNames(WANTED).map((role) => ({
        role,
        members: [accountMember()],
      })),
      ...agentBindings(WANTED).map((binding) => ({
        role: binding.role,
        members: [binding.member],
      })),
    ],
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
    const firstGrant = gestures.findIndex((gesture) =>
      gesture.args.includes(`--member=${accountMember()}`),
    );
    expect(firstGrant).toBeGreaterThan(0);
  });

  it('names one gesture per missing role', () => {
    const kept = roleNames(WANTED).slice(0, 3);
    const gestures = gesturesClosing(
      {
        ...settled,
        projectPolicy: JSON.stringify({
          bindings: [
            ...kept.map((role) => ({ role, members: [accountMember()] })),
            ...agentBindings(WANTED).map((binding) => ({
              role: binding.role,
              members: [binding.member],
            })),
          ],
        }),
      },
      WANTED,
    );

    expect(gestures).toHaveLength(WANTED.roles.length - kept.length);
  });

  // `firebase deploy` grants these itself on the first deployment of an
  // event-driven Function, by rewriting the project policy — with
  // `resourcemanager.projects.setIamPolicy`, a right the deployment account
  // must not hold. The CLI reads before it writes: bindings already in place,
  // it writes nothing. These gestures are what keeps that write unnecessary.
  it('proposes granting each service-agent binding firebase deploy would otherwise write itself', () => {
    const gestures = gesturesClosing(
      {
        ...settled,
        projectPolicy: JSON.stringify({
          bindings: roleNames(WANTED).map((role) => ({
            role,
            members: [accountMember()],
          })),
        }),
      },
      WANTED,
    );

    for (const binding of agentBindings(WANTED)) {
      expect(
        gestures.some(
          (gesture) =>
            gesture.args.includes(`--member=${binding.member}`) &&
            gesture.args.includes(`--role=${binding.role}`) &&
            gesture.does.includes(binding.unlocks),
        ),
      ).toBe(true);
    }
  });

  // On a fresh project the Pub/Sub agent does not exist until Google
  // materialises its identity — a binding naming it first would be refused.
  // The gesture is idempotent: an identity already there is simply returned.
  it('materialises the pub/sub identity before binding its agent', () => {
    const gestures = gesturesClosing(
      {
        ...settled,
        projectPolicy: JSON.stringify({
          bindings: roleNames(WANTED).map((role) => ({
            role,
            members: [accountMember()],
          })),
        }),
      },
      WANTED,
    );

    const identity = gestures.findIndex((gesture) =>
      gesture.args.includes('--service=pubsub.googleapis.com'),
    );
    const binding = gestures.findIndex((gesture) =>
      gesture.args.join(' ').includes('@gcp-sa-pubsub'),
    );
    expect(identity).toBeGreaterThanOrEqual(0);
    expect(binding).toBeGreaterThan(identity);
    expect(gestures[identity]?.args).toContain('identity');
  });

  it('does not materialise an identity whose agent is already bound', () => {
    expect(
      gesturesClosing(settled, WANTED).filter((gesture) =>
        gesture.args.includes('identity'),
      ),
    ).toEqual([]);
  });

  // Found on the first run against the real project: the agent existed there
  // — bound as roles/pubsub.serviceAgent since the api was enabled — and the
  // audit still led with a gesture that had nothing to do. A member the policy
  // names exists; only one it never names may need materialising.
  it('does not materialise an identity whose agent the policy already names', () => {
    const gestures = gesturesClosing(
      {
        ...settled,
        projectPolicy: JSON.stringify({
          bindings: [
            ...roleNames(WANTED).map((role) => ({
              role,
              members: [accountMember()],
            })),
            {
              role: 'roles/pubsub.serviceAgent',
              members: [
                agentBindings(WANTED).map((binding) => binding.member)[0],
              ],
            },
          ],
        }),
      },
      WANTED,
    );

    expect(
      gestures.filter((gesture) => gesture.args.includes('identity')),
    ).toEqual([]);
    expect(
      gestures.filter((gesture) =>
        gesture.args.includes('add-iam-policy-binding'),
      ).length,
    ).toBeGreaterThanOrEqual(agentBindings(WANTED).length);
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

  // The project keeps every role a list once wanted, because the gestures only
  // ever add — so a role the list stops wanting outlives the decision that
  // retired it, silently, for ever. Found with roles/firebase.developViewer:
  // replaced in the list, still bound on the project.
  it('proposes removing a role the account holds that the list no longer wants', () => {
    const gestures = gesturesClosing(
      {
        ...settled,
        projectPolicy: JSON.stringify({
          bindings: [
            ...roleNames(WANTED).map((role) => ({
              role,
              members: [accountMember()],
            })),
            ...agentBindings(WANTED).map((binding) => ({
              role: binding.role,
              members: [binding.member],
            })),
            {
              role: 'roles/firebase.developViewer',
              members: [accountMember()],
            },
          ],
        }),
      },
      WANTED,
    );

    expect(gestures).toHaveLength(1);
    expect(gestures[0]?.args).toContain('remove-iam-policy-binding');
    expect(gestures[0]?.args).toContain('--role=roles/firebase.developViewer');
  });

  // A removal confirmed before the grant that supersedes it leaves the account
  // without the right for as long as the operator hesitates — the grants come
  // first so that at no point between two assents the account can do less than
  // it could before.
  it('grants every missing role before it removes any', () => {
    const gestures = gesturesClosing(
      {
        ...settled,
        projectPolicy: JSON.stringify({
          bindings: [
            {
              role: 'roles/firebase.developViewer',
              members: [accountMember()],
            },
          ],
        }),
      },
      WANTED,
    );

    const kinds = gestures.map((gesture) =>
      gesture.args.includes('remove-iam-policy-binding') ? 'remove' : 'grant',
    );
    expect(kinds.indexOf('remove')).toBeGreaterThan(kinds.lastIndexOf('grant'));
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
