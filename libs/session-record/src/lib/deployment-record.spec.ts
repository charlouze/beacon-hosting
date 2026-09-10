import { describe, expect, it } from 'vitest';
import { agentEndpointFrom } from './deployment-record.js';

describe('agentEndpointFrom', () => {
  it('reads the address the deployment stamped', () => {
    expect(
      agentEndpointFrom({ agentEndpoint: 'https://agentreport-abc.a.run.app' }),
    ).toBe('https://agentreport-abc.a.run.app');
  });

  // A freshly seeded database carries null here, and so does one whose last
  // deployment failed before étape 5. Provisioning on it would build a machine
  // that reports nowhere: the session would sit in PROVISIONING until the
  // watchdog collected it, on a games night, with nothing saying why. Refusing
  // turns that into a FAILED session carrying a reason.
  it('refuses an unstamped document rather than provisioning into the void', () => {
    expect(() => agentEndpointFrom({ agentEndpoint: null })).toThrow(
      /no deployment/,
    );
    expect(() => agentEndpointFrom({})).toThrow(/no deployment/);
  });

  it('refuses a value that is not an address', () => {
    expect(() => agentEndpointFrom({ agentEndpoint: 42 })).toThrow(
      /no deployment/,
    );
  });
});
