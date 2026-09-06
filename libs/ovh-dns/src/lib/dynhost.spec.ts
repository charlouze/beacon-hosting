import { describe, expect, it, vi } from 'vitest';
import { dynHostUpdater } from './dynhost.js';

const ok = (body = 'good 51.15.42.7') =>
  vi.fn<typeof globalThis.fetch>(async () => new Response(body, { status: 200 }));

describe('the dynhost updater', () => {
  it('asks ovh to point the record at the address', async () => {
    const fetch = ok();
    await dynHostUpdater({ user: 'u', password: 'p', fetch }).point(
      'enshrouded.beacon.charlouze.com',
      '51.15.42.7',
    );
    const [url] = fetch.mock.calls[0];
    expect(String(url)).toBe(
      'https://www.ovh.com/nic/update?system=dyndns&hostname=enshrouded.beacon.charlouze.com&myip=51.15.42.7',
    );
  });

  // Basic auth, and the credentials never reach the query string: a url ends
  // up in a log, a proxy, a browser history. §7 keeps them in Secret Manager.
  // The password is chosen so it appears nowhere else in the url — a
  // one-letter password like `p` also occurs in `https` and `myip`.
  it('authenticates in a header and never in the url', async () => {
    const fetch = ok();
    await dynHostUpdater({ user: 'u', password: 'sekret', fetch }).point('h', '1.2.3.4');
    const [url, init] = fetch.mock.calls[0];
    expect(String(url)).not.toContain('sekret');
    expect((init?.headers as Record<string, string>)['Authorization']).toBe(
      `Basic ${btoa('u:sekret')}`,
    );
  });

  // `nochg` is a success: it means the record already says what we want. A
  // second session on a machine that kept its address would otherwise fail on
  // the one answer that proves everything is fine.
  it('accepts the answer that says nothing changed', async () => {
    const fetch = ok('nochg 51.15.42.7');
    await expect(
      dynHostUpdater({ user: 'u', password: 'p', fetch }).point('h', '51.15.42.7'),
    ).resolves.toBeUndefined();
  });

  // Two hundred and a refusal in the body — ovh answers `badauth` with a 200.
  // Read as a status code alone, a wrong password would look like a success,
  // and the record would silently point at last week's machine.
  it('rejects a refusal that arrives with a 200', async () => {
    const fetch = ok('badauth');
    await expect(
      dynHostUpdater({ user: 'u', password: 'p', fetch }).point('h', '1.2.3.4'),
    ).rejects.toThrow(/badauth/);
  });

  it('rejects an http failure', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response('nope', { status: 500 }));
    await expect(
      dynHostUpdater({ user: 'u', password: 'p', fetch }).point('h', '1.2.3.4'),
    ).rejects.toThrow(/500/);
  });
});
