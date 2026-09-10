import { secretsToAsk } from './secrets-gap.js';

const declared = ['SCW_SECRET_KEY', 'SERVER_PASSWORD'];

const enabled = JSON.stringify([
  { name: 'projects/1/secrets/x/versions/1', state: 'ENABLED' },
]);

describe('secretsToAsk', () => {
  it('asks for the ones that have no version at all', () => {
    expect(
      secretsToAsk(declared, {
        SCW_SECRET_KEY: enabled,
        SERVER_PASSWORD: null,
      }),
    ).toEqual(['SERVER_PASSWORD']);
  });

  // A secret can exist and hold nothing, and that is the shape of the failure
  // task 12 describes: the cli asks for the value, `--non-interactive` turns
  // the question into an error, and it lands after `firebase deploy` has
  // already started. Read as settled because the secret is there, this tool
  // would walk straight past the one case it exists to catch.
  it('asks for one that exists with every version destroyed', () => {
    const destroyed = JSON.stringify([
      { name: 'projects/1/secrets/x/versions/1', state: 'DESTROYED' },
    ]);

    expect(
      secretsToAsk(declared, {
        SCW_SECRET_KEY: enabled,
        SERVER_PASSWORD: destroyed,
      }),
    ).toEqual(['SERVER_PASSWORD']);
  });

  it('asks for all of them when a rotation is wanted', () => {
    expect(
      secretsToAsk(
        declared,
        { SCW_SECRET_KEY: enabled, SERVER_PASSWORD: enabled },
        true,
      ),
    ).toEqual(declared);
  });
});
