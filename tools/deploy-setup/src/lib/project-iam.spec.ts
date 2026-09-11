import { rolesHeldBeyond, rolesMissingFrom } from './project-iam.js';

describe('rolesMissingFrom', () => {
  const member =
    'serviceAccount:beacon-deploy@beacon-hosting-charlouze.iam.gserviceaccount.com';

  it('names the wanted roles the member does not hold', () => {
    const policy = JSON.stringify({
      bindings: [{ role: 'roles/run.admin', members: [member] }],
    });

    expect(
      rolesMissingFrom(policy, member, [
        'roles/run.admin',
        'roles/pubsub.admin',
      ]),
    ).toEqual(['roles/pubsub.admin']);
  });

  it('does not count a binding carried under a condition', () => {
    const policy = JSON.stringify({
      bindings: [
        {
          role: 'roles/run.admin',
          members: [member],
          condition: {
            title: 'expires',
            expression: 'request.time < timestamp("2027-01-01T00:00:00Z")',
          },
        },
      ],
    });

    expect(rolesMissingFrom(policy, member, ['roles/run.admin'])).toEqual([
      'roles/run.admin',
    ]);
  });
});

describe('rolesHeldBeyond', () => {
  const member =
    'serviceAccount:beacon-deploy@beacon-hosting-charlouze.iam.gserviceaccount.com';

  it('names the roles the member holds that are not wanted', () => {
    const policy = JSON.stringify({
      bindings: [
        { role: 'roles/run.admin', members: [member] },
        { role: 'roles/firebase.developViewer', members: [member] },
      ],
    });

    expect(rolesHeldBeyond(policy, member, ['roles/run.admin'])).toEqual([
      'roles/firebase.developViewer',
    ]);
  });

  it('leaves the bindings of every other member alone', () => {
    const policy = JSON.stringify({
      bindings: [
        { role: 'roles/owner', members: ['user:me@charlouze.com'] },
      ],
    });

    expect(rolesHeldBeyond(policy, member, ['roles/run.admin'])).toEqual([]);
  });

  // Symmetric with rolesMissingFrom: a conditional grant is a different right,
  // put there by a different decision, and this tool never made it — so it
  // does not get to propose unmaking it either.
  it('does not touch a binding carried under a condition', () => {
    const policy = JSON.stringify({
      bindings: [
        {
          role: 'roles/firebase.developViewer',
          members: [member],
          condition: {
            title: 'expires',
            expression: 'request.time < timestamp("2027-01-01T00:00:00Z")',
          },
        },
      ],
    });

    expect(rolesHeldBeyond(policy, member, ['roles/run.admin'])).toEqual([]);
  });
});
