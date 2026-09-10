import { describe, expect, it } from 'vitest';
import { agentEndpointFor } from './agent-endpoint.js';

const TUNNEL = 'https://ripe-badge-outer-quest.trycloudflare.com';
const ENDPOINT = `${TUNNEL}/demo-beacon/europe-west1/agentReport`;

describe('the endpoint a game machine will report to', () => {
  // demo-beacon is the emulator project, europe-west1 the region declared on
  // every function in apps/functions/src/main.ts, agentReport the function
  // name. All three are duplicated here from places this project cannot
  // import — and all three are checked at every run by the 401 probe, which
  // answers 404 the moment one of them drifts, before a machine is billed.
  it('builds the full path the functions emulator serves', () => {
    expect(agentEndpointFor(TUNNEL)).toBe(ENDPOINT);
  });

  it('does not double the slash when the url carries a trailing one', () => {
    expect(agentEndpointFor(`${TUNNEL}/`)).toBe(ENDPOINT);
  });
});
