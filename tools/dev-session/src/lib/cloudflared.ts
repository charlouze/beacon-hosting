/**
 * cloudflared prints its url on stderr, in an ascii box, a few seconds after
 * it starts — and the banner above that box carries https urls of its own: the
 * documentation link it always prints, and an update notice it prints
 * sometimes. So this matches the shape of a quick tunnel rather than the first
 * url it sees. What that shape excludes is the point of the test next door.
 */
const QUICK_TUNNEL = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/i;

/** The accumulated stderr so far; `undefined` until the box has landed. */
export function tunnelUrlFrom(text: string): string | undefined {
  return QUICK_TUNNEL.exec(text)?.[0];
}

/** The two levels cloudflared uses for things that are going fine. */
const CHATTER = /^\S+\s+(INF|DBG)\s/;

/**
 * Whether a line still deserves the terminal once the url has been captured.
 *
 * Before that point everything is shown, because the box is in there. After
 * it, cloudflared has said all it usefully can: the forty lines it writes on
 * startup — terms of use, version, protocol, a connectivity pre-check table —
 * bury the dashboard this command exists to present.
 *
 * It is a filter and not a mute, because the tunnel expiring mid-session is
 * one of the three faults the 2026-09-08 log blames for two dead sessions. So
 * only the two levels known to be chatter are silenced; a level this does not
 * recognise is shown, since hiding the unfamiliar is how a new failure mode
 * goes unseen.
 */
export function stillWorthShowing(line: string): boolean {
  if (line.trim() === '') return false;
  return !CHATTER.test(line);
}
