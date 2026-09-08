import { describe, expect, it } from 'vitest';
import { agentEndpointFor, withAgentEndpoint } from './agent-endpoint.js';

const TUNNEL = 'https://ripe-badge-outer-quest.trycloudflare.com';
const ENDPOINT = `${TUNNEL}/demo-beacon/europe-west1/agentReport`;

/** Five fake secrets, in the shape the real file has. None may ever be printed. */
const SCW_SECRET = 'scw-secret-that-must-never-be-printed';
const S3_SECRET = 's3-secret-that-must-never-be-printed';
const DYNHOST_SECRET = 'dynhost-secret-that-must-never-be-printed';

const ENV = [
  '# Non-secret Scaleway parameters, read by the watchdog.',
  'SCW_ACCESS_KEY=SCWXXXXXXXXXXXXXXXXX',
  'SCW_PROJECT_ID=00000000-0000-0000-0000-000000000000',
  'SCW_ZONE=fr-par-1',
  `SCW_SECRET_KEY=${SCW_SECRET}`,
  '',
  'AGENT_ENDPOINT=https://a-tunnel-that-died-last-night.trycloudflare.com/demo-beacon/europe-west1/agentReport',
  'S3_ENDPOINT=https://s3.fr-par.scw.cloud',
  'S3_ACCESS_KEY=SCWYYYYYYYYYYYYYYYYY',
  `S3_SECRET_KEY=${S3_SECRET}`,
  'SAVES_BUCKET=beacon-saves',
  'GAMES_BUCKET=beacon-games',
  'SERVER_PASSWORD=a-password-that-must-never-be-printed',
  'DYNHOST_USER=beacon.charlouze.com',
  `DYNHOST_PASSWORD=${DYNHOST_SECRET}`,
  '',
].join('\n');

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

describe('rewriting AGENT_ENDPOINT and nothing else', () => {
  it('puts the new endpoint in, and leaves every other line byte for byte', () => {
    const { text } = withAgentEndpoint(ENV, ENDPOINT);
    expect(text).toContain(`AGENT_ENDPOINT=${ENDPOINT}`);
    expect(text).not.toContain('a-tunnel-that-died-last-night');

    const before = ENV.split('\n');
    const after = text.split('\n');
    expect(after).toHaveLength(before.length);
    before.forEach((line, index) => {
      if (line.startsWith('AGENT_ENDPOINT=')) return;
      expect(after[index]).toBe(line);
    });
  });

  it('counts the assignments, so the operator is told what was left alone', () => {
    expect(withAgentEndpoint(ENV, ENDPOINT).assignments).toBe(13);
  });

  // The file on a Windows checkout has CRLF endings. Splitting and rejoining
  // would silently rewrite all thirteen lines, and the diff would say the
  // command touched everything it promised not to.
  it('leaves CRLF endings exactly as it found them', () => {
    const { text } = withAgentEndpoint(ENV.replace(/\n/g, '\r\n'), ENDPOINT);
    expect(text).toContain(`AGENT_ENDPOINT=${ENDPOINT}\r\n`);
    expect(text.split('\r\n')).toHaveLength(ENV.split('\n').length);
  });

  // A key that only ends with the name is not the key. dotenv reads
  // BEACON_AGENT_ENDPOINT as its own variable, and rewriting it would leave
  // the real one pointing at last night's tunnel.
  it('does not match a longer key that ends with the name', () => {
    const decoy = 'BEACON_AGENT_ENDPOINT=https://elsewhere.example\nAGENT_ENDPOINT=\n';
    const { text } = withAgentEndpoint(decoy, ENDPOINT);
    expect(text).toContain('BEACON_AGENT_ENDPOINT=https://elsewhere.example');
    expect(text).toContain(`\nAGENT_ENDPOINT=${ENDPOINT}`);
  });

  // Adding the line would be helpful and wrong: a .env without this key is not
  // the file this command thinks it is holding.
  it('refuses a file that has no such key, and names .env.example', () => {
    let message = '';
    try {
      withAgentEndpoint('S3_ENDPOINT=https://s3.fr-par.scw.cloud\n', ENDPOINT);
    } catch (error) {
      message = String(error);
    }
    expect(message).toContain('AGENT_ENDPOINT');
    expect(message).toContain('.env.example');
  });

  it('refuses a file that declares the key twice, rather than guessing which wins', () => {
    const twice = 'AGENT_ENDPOINT=https://one.example\nAGENT_ENDPOINT=https://two.example\n';
    expect(() => withAgentEndpoint(twice, ENDPOINT)).toThrow(/twice/);
  });
});

/**
 * The load-bearing test of this module. Whatever goes wrong, the five secrets
 * in that file must not reach a terminal, a log, or a stack trace.
 */
describe('what a failure is allowed to say', () => {
  it('names no value from the file, whatever the fault', () => {
    const broken = ENV.replace(/^AGENT_ENDPOINT=.*$/m, '');
    let message = '';
    try {
      withAgentEndpoint(broken, ENDPOINT);
    } catch (error) {
      message = `${String(error)}${error instanceof Error ? error.stack : ''}`;
    }
    expect(message).not.toBe('');
    for (const secret of [SCW_SECRET, S3_SECRET, DYNHOST_SECRET]) {
      expect(message).not.toContain(secret);
    }
  });
});
