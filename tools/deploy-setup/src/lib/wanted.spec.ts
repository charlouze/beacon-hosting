import { roleNames, serviceNames, WANTED } from './wanted.js';

describe('WANTED', () => {
  // A role spelled `role/run.admin` matches nothing in a policy, so the audit
  // reports it missing, grants it, and reports it missing again on the next
  // run — for ever, with no error anywhere. Same for an api name missing its
  // suffix. The shapes are checked here because nothing downstream can.
  it('spells every role the way a policy spells one', () => {
    expect(
      roleNames(WANTED).filter((role) => !role.startsWith('roles/')),
    ).toEqual([]);
  });

  it('spells every api as a service name', () => {
    expect(
      serviceNames(WANTED).filter(
        (service) => !service.endsWith('.googleapis.com'),
      ),
    ).toEqual([]);
  });

  it('names each role once', () => {
    expect(new Set(roleNames(WANTED)).size).toBe(WANTED.roles.length);
  });

  // Not a role, so no table of roles can carry it, and it is the one API whose
  // absence fails before anything is published: `google-github-actions/auth`
  // impersonates the account, and that is the call it authorises.
  it('enables iamcredentials, which no role implies', () => {
    expect(serviceNames(WANTED)).toContain('iamcredentials.googleapis.com');
  });

  // The operator confirms one command at a time, and confirms it on what this
  // string says. A role whose reason is empty asks them to grant an
  // administrator right on a project on the strength of its name alone — which
  // is how a list of thirteen gets waved through as a block.
  it('says of every role what it unblocks', () => {
    expect(WANTED.roles.filter((role) => role.unlocks.trim() === '')).toEqual(
      [],
    );
  });

  it('says of every api why it is enabled', () => {
    expect(
      WANTED.services.filter((service) => service.unlocks.trim() === ''),
    ).toEqual([]);
  });
});
