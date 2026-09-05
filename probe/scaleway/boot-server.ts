import { instanceApi, scwConfig } from './client'
import { resolveImageId } from './images'
import { PROBE_PREFIX, PROBE_TAG } from './reaper-policy'

const COMMERCIAL_TYPE = process.env.SCW_COMMERCIAL_TYPE ?? 'DEV1-L'
const BOOT_TIMEOUT_MS = 10 * 60 * 1000

export const since = (start: number) => `${Math.round((Date.now() - start) / 1000)}s`

export interface BootedServer {
  /** The address to ssh to, and the one a caller may have to announce. */
  readonly address: string
  /** Milliseconds, so each caller times its own report against the same start. */
  readonly startedAt: number
}

/**
 * One probe machine, from nothing to `running`. Every probe that needs a
 * machine goes through here: what varies between them is the cloud-init they
 * hand in and what they watch afterwards, never this sequence.
 */
export async function bootProbeServer(sessionId: string, userData: string): Promise<BootedServer> {
  const { zone, projectId } = scwConfig()
  const api = instanceApi()

  // The probe tag, never the ownership tag. Since tranche 1 a `beacon` machine
  // with no open provisioning intent is destroyed by the production watchdog
  // within five minutes — in the middle of a measurement, and for a reason
  // nothing in this script would explain.
  const sessionTag = `session:${sessionId}`
  const tags = [PROBE_TAG, sessionTag]

  // Re-runnable by design: a probe retried after a boot failure must retry, not
  // seed, or the reaper chases resources this run forgot.
  const known = await api.listServers({ zone, project: projectId, tags: [sessionTag] })
  if (known.servers.length > 0) {
    throw new Error(
      `server ${known.servers[0].id} already carries ${sessionTag} — reap it or use another sessionId`,
    )
  }

  const image = await resolveImageId(zone, COMMERCIAL_TYPE)
  const startedAt = Date.now()

  // The ip first, and attached at creation rather than after: the address is
  // known before the machine exists, which is what lets a caller announce it.
  const reusable = await api.listIps({ zone, project: projectId, tags: [sessionTag] })
  const ip = reusable.ips[0] ?? (await api.createIp({ zone, project: projectId, tags })).ip
  if (!ip) throw new Error('createIp returned no ip — nothing to attach, nothing to reap')
  // Loudly, and before a server exists: an ip with no address is a machine
  // nobody can reach, and the caller would otherwise print `ssh root@`.
  if (!ip.address) throw new Error(`ip ${ip.id} carries no address — reap it and retry`)
  console.log(`${since(startedAt).padEnd(6)} ip ${ip.address}`)

  const { server } = await api.createServer({
    zone,
    project: projectId,
    name: `${PROBE_PREFIX}${sessionId}`,
    commercialType: COMMERCIAL_TYPE,
    image,
    publicIps: [ip.id],
    tags,
    protected: false,
  })
  if (!server) throw new Error('createServer returned no server — run scw:reap before retrying')
  console.log(`${since(startedAt).padEnd(6)} server ${server.id} created, ${server.state}`)

  // cloud-init travels as user data, a call of its own, and it must land before
  // the machine boots — there is no second chance at first boot.
  await api.setServerUserData({ zone, serverId: server.id, key: 'cloud-init', content: userData })
  console.log(`${since(startedAt).padEnd(6)} cloud-init posted (${userData.length} bytes)`)

  const running = await api.serverActionAndWait(
    { zone, serverId: server.id, action: 'poweron' },
    { timeout: BOOT_TIMEOUT_MS },
  )
  console.log(`${since(startedAt).padEnd(6)} ${running.state}`)

  return { address: ip.address, startedAt }
}
