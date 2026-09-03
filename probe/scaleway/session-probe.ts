import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { instanceApi, scwConfig, runScript } from './client'
import { resolveImageId } from './images'
import { PROBE_PREFIX, PROBE_TAG } from './reaper-policy'

const RENDERER = fileURLToPath(new URL('../../deploy/render-cloud-init.mjs', import.meta.url))
const COMMERCIAL_TYPE = process.env.SCW_COMMERCIAL_TYPE ?? 'DEV1-L'
const BOOT_TIMEOUT_MS = 10 * 60 * 1000

const since = (start: number) => `${Math.round((Date.now() - start) / 1000)}s`

runScript(async () => {
  const { zone, projectId } = scwConfig()
  const api = instanceApi()
  const sessionId = process.argv[2]
  if (!sessionId) throw new Error('usage: scw:session -- <sessionId>')
  if (!process.env.SERVER_PASSWORD) throw new Error('probe/.env is missing SERVER_PASSWORD')

  // Two tags, as §5 of the spec has it: one to enumerate, one to match.
  const sessionTag = `session:${sessionId}`
  const tags = [PROBE_TAG, sessionTag]
  const name = `${PROBE_PREFIX}${sessionId}`

  // Re-runnable by design. A probe that is retried after a boot failure must
  // retry, not seed: the reaper would otherwise chase resources this run forgot.
  const known = await api.listServers({ zone, project: projectId, tags: [sessionTag] })
  if (known.servers.length > 0) {
    throw new Error(
      `server ${known.servers[0].id} already carries ${sessionTag} — reap it or use another sessionId`,
    )
  }

  // The very same renderer the deploy README documents: what boots is what was
  // tested locally in task 4.
  const userData = execFileSync('node', [RENDERER], { encoding: 'utf8' })
  const image = await resolveImageId(zone, COMMERCIAL_TYPE)

  const startedAt = Date.now()

  // The ip first, and attached at creation rather than after: the Function owns
  // the address before the machine exists, which is what lets §6 update DynHost
  // from what it knows instead of from what the agent claims.
  const reusable = await api.listIps({ zone, project: projectId, tags: [sessionTag] })
  const ip = reusable.ips[0] ?? (await api.createIp({ zone, project: projectId, tags })).ip
  if (!ip) throw new Error('createIp returned no ip — nothing to attach, nothing to reap')
  console.log(`${since(startedAt).padEnd(6)} ip ${ip.address}`)

  const { server } = await api.createServer({
    zone,
    project: projectId,
    name,
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

  console.log(`
=== à relever, montre en main ===
  création → running          ${since(startedAt)}
  ssh root@${ip.address} 'cloud-init status --wait; docker logs -f enshrouded'

Le compte à rebours du produit continue au-delà de « running » : SteamCMD mange
les minutes suivantes, et c'est cette durée-là qu'annonce l'interface.

détruire :  npm --prefix probe run scw:reap -- --yes`)
})
