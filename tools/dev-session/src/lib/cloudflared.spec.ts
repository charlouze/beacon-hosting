import { describe, expect, it } from 'vitest';
import { stillWorthShowing, tunnelUrlFrom } from './cloudflared.js';

/**
 * What cloudflared really writes on stderr, banner included. The documentation
 * link comes *before* the box: a reader that took "the first https url" would
 * point AGENT_ENDPOINT at Cloudflare's own documentation, which answers 200 to
 * anything — and a billed machine would report into a web page.
 */
const REAL_STDERR = [
  '2026-09-09T20:14:02Z INF Thank you for trying Cloudflare Tunnel. Doing so, without a Cloudflare',
  '  account, is a quick way to experiment and try it out. However, be aware that these',
  '  account-less Tunnels have no uptime guarantee. If you intend to use Tunnels in production',
  '  you should use a pre-created named tunnel by following: https://developers.cloudflare.com/',
  '  cloudflare-one/connections/connect-apps',
  '2026-09-09T20:14:02Z INF Requesting new quick Tunnel on trycloudflare.com...',
  '2026-09-09T20:14:05Z INF +------------------------------------------------------------------+',
  '2026-09-09T20:14:05Z INF |  Your quick Tunnel has been created! Visit it at (it may take     |',
  '2026-09-09T20:14:05Z INF |  some time to be reachable):                                      |',
  '2026-09-09T20:14:05Z INF |  https://ripe-badge-outer-quest.trycloudflare.com                 |',
  '2026-09-09T20:14:05Z INF +------------------------------------------------------------------+',
].join('\n');

describe('finding the tunnel url in what cloudflared says', () => {
  it('takes the quick tunnel, not the documentation link printed above it', () => {
    expect(tunnelUrlFrom(REAL_STDERR)).toBe('https://ripe-badge-outer-quest.trycloudflare.com');
  });

  // stderr arrives in chunks, and the box lands several seconds after the
  // banner. Before it lands there is no answer — and no wrong answer either.
  it('has no answer while only the banner has arrived', () => {
    const banner = REAL_STDERR.slice(0, REAL_STDERR.indexOf('Requesting new quick Tunnel'));
    expect(tunnelUrlFrom(banner)).toBeUndefined();
  });

  it('finds the url once the chunk that carried it is appended', () => {
    const cut = REAL_STDERR.indexOf('https://ripe-badge') + 20;
    expect(tunnelUrlFrom(REAL_STDERR.slice(0, cut))).toBeUndefined();
    expect(tunnelUrlFrom(REAL_STDERR)).toBe('https://ripe-badge-outer-quest.trycloudflare.com');
  });

  // The url sits inside an ascii box, padded up to a closing pipe. Carrying one
  // trailing space into AGENT_ENDPOINT would build an endpoint that resolves to
  // nothing, and the 401 probe would blame the tunnel.
  it('stops at the url, not at the box border that follows it', () => {
    const boxed = '2026-09-09T20:14:05Z INF |  https://ripe-badge-outer-quest.trycloudflare.com    |';
    expect(tunnelUrlFrom(boxed)).toBe('https://ripe-badge-outer-quest.trycloudflare.com');
  });

  it('ignores an update notice, which is also an https url on stderr', () => {
    const notice =
      '2026-09-09T20:14:01Z INF cloudflared version 2026.8.3 is out: https://github.com/cloudflare/cloudflared/releases';
    expect(tunnelUrlFrom(notice)).toBeUndefined();
  });
});

/**
 * Measured on 2026-09-09: cloudflared writes about forty lines before its `ok`
 * — terms of use, version, protocol, and a whole connectivity pre-check table
 * — and the dashboard drowns in them. Once the url is out, none of that is
 * worth the screen. What still is: the tunnel expiring mid-session, which the
 * 2026-09-08 log names as one of the three faults this command exists for.
 */
describe('what cloudflared still deserves the screen for, once the url is out', () => {
  it('drops the chatter that made the dashboard unreadable', () => {
    for (const line of [
      '2026-09-09T20:14:07Z INF |  DNS Resolution    region1.v2.argotunnel.com  PASS  |',
      '2026-09-09T20:14:07Z INF Registered tunnel connection connIndex=0 protocol=quic',
      '2026-09-09T20:14:06Z INF Version 2026.8.3 (Checksum 83e726ed18ea78c5)',
      '2026-09-09T20:14:06Z DBG Retrying connection in up to 2s',
    ]) {
      expect(stillWorthShowing(line)).toBe(false);
    }
  });

  it('keeps what says the tunnel is in trouble', () => {
    for (const line of [
      '2026-09-09T21:02:11Z WRN Connection terminated error="context canceled"',
      '2026-09-09T21:02:11Z ERR Failed to serve quic connection',
      '2026-09-09T21:02:11Z FTL no more connections active and exiting',
    ]) {
      expect(stillWorthShowing(line)).toBe(true);
    }
  });

  // Hiding what we do not recognise is how a new failure mode goes unseen.
  // The rule only ever silences the two levels it knows are chatter.
  it('keeps anything it does not recognise, rather than guessing it is noise', () => {
    expect(stillWorthShowing('panic: runtime error: invalid memory address')).toBe(true);
    expect(stillWorthShowing('2026-09-09T21:02:11Z NEW a level that did not exist before')).toBe(true);
  });

  it('says nothing about blank lines either way, by keeping them out', () => {
    expect(stillWorthShowing('   ')).toBe(false);
  });
});
