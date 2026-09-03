export const PROBE_PREFIX = 'beacon-probe-'
export const PROBE_TAG = 'beacon-probe'

// Shaped after the SDK's own types, which say `server?: ServerSummary` and not
// `server: T | null`. An unattached ip therefore arrives as `undefined`, and a
// strict `=== null` would have reported no orphan ever.
type Attachable = { server?: { id?: string } }

export type ProbeServer = { id: string; name: string; state: string; tags: string[] }
export type ProbeIp = { id: string; address: string; tags: string[] } & Attachable
export type ProbeVolume = { id: string; name: string; size: number } & Attachable

export type ProbeInventory = { servers: ProbeServer[]; ips: ProbeIp[]; volumes: ProbeVolume[] }

/**
 * How a doomed server has to die. `terminate` takes the server and its volumes
 * in one call, but the API refuses it on anything not running: a server that
 * never booted answers "invalid state 'stopped' for the action 'terminate'".
 * Such a server dies by deleteServer, which leaves its disks behind — hence
 * `volumeIds`, the ones the caller must then delete itself.
 */
export type DoomedServer = ProbeServer & { terminable: boolean; volumeIds: string[] }

export type Doomed = {
  servers: DoomedServer[]
  ips: ProbeIp[]
  /** Untagged and unattached: billed, probably ours, never destroyed on our own. */
  orphanIps: ProbeIp[]
  /** Detached and outliving their server: reported, never destroyed on our own. */
  strayVolumes: ProbeVolume[]
}

const isAttached = (resource: Attachable) => resource.server?.id != null

export function selectDoomed(
  inventory: ProbeInventory,
  options: { includeOrphanIps: boolean },
): Doomed {
  const doomedServers = inventory.servers.filter((server) => server.name.startsWith(PROBE_PREFIX))
  const doomedServerIds = new Set(doomedServers.map((server) => server.id))

  const servers: DoomedServer[] = doomedServers.map((server) => {
    const terminable = server.state === 'running'
    return {
      ...server,
      terminable,
      // Only worth listing when terminate will not do it for us.
      volumeIds: terminable
        ? []
        : inventory.volumes
            .filter((volume) => volume.server?.id === server.id)
            .map((volume) => volume.id),
    }
  })

  const isOurs = (ip: ProbeIp) =>
    ip.tags.includes(PROBE_TAG) || (isAttached(ip) && doomedServerIds.has(ip.server!.id!))
  const isOrphan = (ip: ProbeIp) => !isOurs(ip) && !isAttached(ip)

  const orphanIps = inventory.ips.filter(isOrphan)
  const ips = inventory.ips.filter(
    (ip) => isOurs(ip) || (options.includeOrphanIps && isOrphan(ip)),
  )

  // A volume has no tag of ours to carry — it is created by the server, not by
  // us. Detached, it is billed and invisible: reported, never auto-destroyed.
  const strayVolumes = inventory.volumes.filter((volume) => !isAttached(volume))

  return { servers, ips, orphanIps: options.includeOrphanIps ? [] : orphanIps, strayVolumes }
}
