import { rolesMissingFrom } from './project-iam.js';

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
