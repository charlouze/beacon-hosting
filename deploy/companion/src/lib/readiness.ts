import { REPORT_INTERVAL_MS } from '@beacon/agent-protocol';
import { a2sInfo } from './a2s.js';
import { readServerId } from './serverid.js';

/**
 * What a probe answers. `serverId` only ever comes from the second mechanism
 * below — the game that answers like a player asks has an address to publish
 * instead, never an identifier.
 */
export type Readiness = { readonly ready: false } | { readonly ready: true; readonly serverId?: string };

/** Half the report interval: a probe must never be what makes a report late. */
const PROBE_TIMEOUT_MS = Math.floor(REPORT_INTERVAL_MS / 2);

const A2S_URL = /^a2s:\/\/([^:/]+):(\d+)$/;
const SERVERID_URL = /^serverid:\/\/(.+)$/;

/**
 * `BEACON_READY_PROBE`, as the catalogue writes it. §4 keeps every game
 * detail in `deploy/cloud-init/games/`, so this reads a value and never
 * guesses one, and a form it cannot read is a catalogue entry to fix, said at
 * launch.
 *
 * The result is the probe itself, already wired to whichever mechanism the
 * url names — which is what lets `agent.ts` run either one without ever
 * knowing which it is running.
 */
export function probeFor(url: string): () => Promise<Readiness> {
  const a2s = A2S_URL.exec(url);
  if (a2s !== null) {
    const host = a2s[1];
    const port = Number(a2s[2]);
    return async (): Promise<Readiness> =>
      (await a2sInfo(host, port, PROBE_TIMEOUT_MS)) ? { ready: true } : { ready: false };
  }

  const serverid = SERVERID_URL.exec(url);
  if (serverid !== null) {
    return readServerId(serverid[1]);
  }

  throw new Error(`BEACON_READY_PROBE is not a probe this companion can run: ${url}`);
}
