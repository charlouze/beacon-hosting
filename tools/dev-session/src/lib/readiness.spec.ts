import { describe, expect, it } from 'vitest';
import { verdictFor } from './readiness.js';

const said = (probe: Parameters<typeof verdictFor>[0]): string => verdictFor(probe).lines.join(' ');

describe('what one POST with a false token proves', () => {
  // Three things at once, which is why this probe is worth its round trip: the
  // tunnel carries, the function is loaded, and the token barrier bites.
  it('takes 401 as the green light', () => {
    expect(verdictFor({ status: 401 }).ok).toBe(true);
    expect(said({ status: 401 })).toContain('token');
  });

  // The loudest failure in the file. A fake token that is accepted means
  // anything on the internet can drive a session, and the machine this would
  // provision is billed. Never hand over on this.
  it('refuses hardest when a false token is accepted', () => {
    expect(verdictFor({ status: 200 }).ok).toBe(false);
    expect(said({ status: 200 })).toContain('accepted a token that does not exist');
  });

  it('reads 404 as a wrong url rather than a broken tunnel', () => {
    expect(verdictFor({ status: 404 }).ok).toBe(false);
    expect(said({ status: 404 })).toContain('project, region or function name');
  });

  // agentReport answers 400 when parseReport refuses the body. That is this
  // command's own probe drifting from @beacon/agent-protocol — not a fault of
  // the tunnel, and pointing at the tunnel would send the operator hunting in
  // the wrong place.
  it('reads 400 as the probe body having drifted from the protocol', () => {
    expect(verdictFor({ status: 400 }).ok).toBe(false);
    expect(said({ status: 400 })).toContain('agent-protocol');
  });

  // Measured on 2026-09-09 against the emulator: a function that throws while
  // building its dependencies answers 500 before it ever looks at the token.
  // Here the Scaleway sdk refused a malformed access key out of
  // apps/functions/.env — nothing about the tunnel was wrong, and the default
  // "no story for this answer" would have sent the operator to the tunnel.
  it('reads 500 as the function dying before the token was ever checked', () => {
    expect(verdictFor({ status: 500 }).ok).toBe(false);
    expect(said({ status: 500 })).toContain('before it could check the token');
    expect(said({ status: 500 })).toContain('emulator ui');
  });

  it('reads a bad gateway as nothing listening behind the tunnel', () => {
    for (const status of [502, 503, 504, 530]) {
      expect(verdictFor({ status }).ok).toBe(false);
      expect(said({ status })).toContain('nothing is listening');
    }
  });

  it('reads no answer at all as a tunnel that does not carry', () => {
    const verdict = verdictFor({ unreachable: 'fetch failed' });
    expect(verdict.ok).toBe(false);
    expect(said({ unreachable: 'fetch failed' })).toContain('did not answer');
  });

  it('reports a status it has no story for, rather than staying quiet', () => {
    expect(verdictFor({ status: 418 }).ok).toBe(false);
    expect(said({ status: 418 })).toContain('418');
  });
});
