import { instanceApi, scwConfig } from './client'
import type { ProbeInventory } from './reaper-policy'

// Library only, deliberately: `reap.ts` imports this, and a module-level
// runScript here would run the report every time the reaper starts.
// The human-facing listing lives in inventory-report.ts.
export async function readInventory(): Promise<ProbeInventory> {
  const { zone, projectId } = scwConfig()
  const api = instanceApi()
  const [servers, ips, volumes] = await Promise.all([
    api.listServers({ zone, project: projectId }),
    api.listIps({ zone, project: projectId }),
    // The quietest resource of the lot: a volume outlives its server if the
    // terminate action does not take it, and appears in neither list above.
    api.listVolumes({ zone, project: projectId }),
  ])
  return {
    servers: servers.servers,
    ips: ips.ips,
    volumes: Object.values(volumes.volumes ?? {}),
  }
}
