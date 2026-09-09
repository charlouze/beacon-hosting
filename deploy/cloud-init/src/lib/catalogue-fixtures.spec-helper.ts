import type { BootRequest } from './catalog.js';

/**
 * The boot request both catalogue suites render from. Shared rather than
 * copied: two entries asserting against two drifting fixtures is the failure
 * where one suite proves something the other no longer tests, and nothing says
 * so. No value here holds a `$`, and that is not an oversight: the frontier
 * refuses one in everything that reaches a machine, so a fixture carrying one
 * would render nothing and prove nothing but the refusal.
 */
export const REQUEST: BootRequest = {
  serverName: 'Beacon',
  serverPassword: 'hunter2',
  slotCount: 4,
  // The account of the 2026-09-05 measurement, so a suite that does not care
  // about administrators still renders the boot that was actually observed.
  adminSteamIds: ['76561197965918116'],
  sessionId: 's1',
  agentToken: 'a'.repeat(64),
  endpoint: 'https://europe-west1-beacon.cloudfunctions.net/agentReport',
  saves: {
    endpoint: 'https://s3.fr-par.scw.cloud',
    region: 'fr-par',
    savesBucket: 'beacon-saves',
    gamesBucket: 'beacon-games',
    accessKey: 'SCWXXXXXXXXXXXXXXXXX',
    secretKey: 'a-secret-with-no-dollar-in-it',
  },
};

/**
 * One service's own lines, not the whole compose: depth is syntax here exactly
 * as it is in the cloud-init's own block scalar — a line belongs to a service
 * until the next line at its own two-space depth opens the next one.
 *
 * Scoping matters more than it looks: `[\s\S]*` crosses service boundaries, so
 * an assertion against the full text still passes with one service's mount
 * deleted, as long as some *other* service still mentions the same path.
 */
export function serviceBlock(compose: string, name: string): string {
  const lines = compose.split('\n');
  const start = lines.findIndex((line) => line === `  ${name}:`);
  if (start === -1) throw new Error(`no "${name}" service in this compose`);
  let end = start + 1;
  while (end < lines.length && !/^ {2}\S/.test(lines[end])) end += 1;
  return lines.slice(start, end).join('\n');
}
