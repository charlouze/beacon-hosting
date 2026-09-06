import type { DnsUpdater } from '@beacon/session';

const ENDPOINT = 'https://www.ovh.com/nic/update';

export interface DynHostConfig {
  readonly user: string;
  readonly password: string;
  /** Injected so the suite drives it without a network. */
  readonly fetch?: typeof globalThis.fetch;
}

/**
 * DynHost, which is dyndns2. The protocol answers a refusal with a 200 and a
 * word in the body, so the body is what decides — a status-only reading would
 * make a wrong password look like a success, and leave the record pointing at
 * a machine that no longer exists.
 */
export function dynHostUpdater(config: DynHostConfig): DnsUpdater {
  const call = config.fetch ?? globalThis.fetch;
  const authorization = `Basic ${btoa(`${config.user}:${config.password}`)}`;

  return {
    async point(hostname: string, address: string): Promise<void> {
      const url = `${ENDPOINT}?system=dyndns&hostname=${encodeURIComponent(
        hostname,
      )}&myip=${encodeURIComponent(address)}`;

      const response = await call(url, { headers: { Authorization: authorization } });
      if (!response.ok) {
        throw new Error(`dynhost refused ${hostname}: http ${response.status}`);
      }

      const body = (await response.text()).trim();
      // `good` and `nochg` are the two successes. The second means the record
      // already says what we want, which is what a second session on the same
      // address looks like.
      if (!body.startsWith('good') && !body.startsWith('nochg')) {
        throw new Error(`dynhost refused ${hostname}: ${body}`);
      }
    },
  };
}
