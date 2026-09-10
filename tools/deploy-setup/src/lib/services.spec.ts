import { servicesMissingFrom } from './services.js';

describe('servicesMissingFrom', () => {
  it('names the wanted apis the project has not enabled', () => {
    const listed = JSON.stringify([
      { config: { name: 'run.googleapis.com' }, state: 'ENABLED' },
      { config: { name: 'pubsub.googleapis.com' }, state: 'ENABLED' },
    ]);

    expect(
      servicesMissingFrom(listed, [
        'run.googleapis.com',
        'iamcredentials.googleapis.com',
      ]),
    ).toEqual(['iamcredentials.googleapis.com']);
  });
});
