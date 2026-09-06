import type { Instancev1 } from '@scaleway/sdk';
import type { Zone } from '@scaleway/sdk-client';
import type { InstanceApi } from './instance-api.js';

/** A listing the sdk hands back as a promise *and* as pages. */
interface Pages<T> {
  [Symbol.asyncIterator](): AsyncGenerator<T[], void, void>;
}

/**
 * Every page, not the first. Awaiting one of these promises yields fifty items
 * and says nothing about what followed. `listVolumes` is why it matters: it
 * takes no tag filter, so it enumerates the whole Scaleway project, and past
 * fifty volumes the third list of §6 would quietly stop reporting the very
 * leak it exists to catch — no error, no event, nothing to notice.
 */
async function drain<T>(pages: Pages<T>): Promise<T[]> {
  const all: T[] = [];
  for await (const page of pages) all.push(...page);
  return all;
}

/**
 * The one place the sdk's types are named. The zone is a fact of the
 * deployment, so it is closed over here once instead of being threaded through
 * seven signatures, every test and every fake.
 */
export function fromSdk(api: Instancev1.API, zone: Zone): InstanceApi {
  return {
    listServers: async (request) => ({
      servers: await drain(api.listServers({ ...request, zone })),
    }),
    listIps: async (request) => ({ ips: await drain(api.listIps({ ...request, zone })) }),
    listVolumes: async () => ({ volumes: await drain(api.listVolumes({ zone })) }),
    serverAction: (request) => api.serverAction({ ...request, zone }),
    deleteServer: (request) => api.deleteServer({ ...request, zone }),
    deleteVolume: (request) => api.deleteVolume({ ...request, zone }),
    deleteIp: (request) => api.deleteIp({ ...request, zone }),
    createIp: (request) => api.createIp({ ...request, zone }),
    createServer: (request) => api.createServer({ ...request, zone }),
    setServerUserData: (request) =>
      api.setServerUserData({ ...request, zone, key: 'cloud-init' }),
    // Waits for `running`, unlike every destruction path here: a machine that
    // never reached it is a provisioning failure, and the caller has to learn
    // it while it can still tear the resources down.
    //
    // Which is what fixes the eight minutes. The provisioning Function is
    // killed at 540 s, so any wait at or above that expires never — the
    // caller would be dead before it heard, and the resources would live on.
    // 480 s leaves the destruction its minute, and is still thirty times the
    // 15 s the probe measured from `poweron` to `running`.
    powerOn: async (request) => {
      await api.serverActionAndWait(
        { ...request, zone, action: 'poweron' },
        { timeout: 8 * 60_000 },
      );
    },
  };
}
