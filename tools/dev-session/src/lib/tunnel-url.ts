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
