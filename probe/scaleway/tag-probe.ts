import { instanceApi, scwConfig, runScript } from './client'
import { resolveImageId } from './images'
import { PROBE_PREFIX, PROBE_TAG } from './reaper-policy'

const SESSION_ID = 'probe0001'
const SESSION_TAG = `session:${SESSION_ID}`
// Not the cheapest of the zone, the only viable one: every other 8 GiB type is
// either in shortage or block-storage-only. Measured, see probe/RESULTS.md.
const PROBE_TYPE = 'DEV1-L'

const show = (label: string, value: unknown) =>
  console.log(`${label.padEnd(34)} ${JSON.stringify(value)}`)

runScript(async () => {
  const { zone, projectId } = scwConfig()
  const api = instanceApi()
  const withServer = process.argv.includes('--with-server')
  const typeIndex = process.argv.indexOf('--type')
  const commercialType = typeIndex === -1 ? PROBE_TYPE : process.argv[typeIndex + 1]

  // The half that decides, and the cheap one: at Scaleway a flexible ip exists
  // on its own, so the tag is measurable without booting anything.
  //
  // Reused when one already carries the session tag: this script is re-run —
  // to add the server half, to retry after a quota error — and creating a
  // billed ip on every pass is how a probe leaks money one centime at a time.
  const existing = await api.listIps({ zone, project: projectId, tags: [SESSION_TAG] })
  const ip =
    existing.ips[0] ??
    (await api.createIp({ zone, project: projectId, tags: [PROBE_TAG, SESSION_TAG] })).ip
  if (!ip) throw new Error('createIp returned no ip — nothing to measure, nothing to reap')
  console.log(
    existing.ips[0] ? `reusing ip ${ip.id} ${ip.address}` : `created ip ${ip.id} ${ip.address}`,
  )
  show('tags as returned', ip.tags)

  const reread = await api.getIp({ zone, ip: ip.id })
  show('tags on re-read', reread.ip?.tags)
  show('server field while unattached', reread.ip?.server ?? null)

  const bySession = await api.listIps({ zone, project: projectId, tags: [SESSION_TAG] })
  show(`filter tags=${SESSION_TAG}`, bySession.ips.map((each) => each.id))

  const byOwnership = await api.listIps({ zone, project: projectId, tags: [PROBE_TAG] })
  show(`filter tags=${PROBE_TAG}`, byOwnership.ips.map((each) => each.id))

  // The question the §5 mechanism actually rests on: can the watchdog enumerate
  // by a prefix it knows, without knowing the session id? If this returns the
  // ip, the constant ownership tag is unnecessary.
  const byPrefix = await api.listIps({ zone, project: projectId, tags: ['session:'] })
  show('filter tags=session: (prefix?)', byPrefix.ips.map((each) => each.id))

  if (!withServer) {
    console.log('\nip half done — rerun with --with-server to also probe the server tag')
    console.log('then destroy with: npm --prefix probe run scw:reap -- --yes')
    return
  }

  const image = await resolveImageId(zone, commercialType)
  const { server } = await api
    .createServer({
      zone,
      project: projectId,
      name: `${PROBE_PREFIX}${SESSION_ID}`,
      commercialType,
      image,
      tags: [PROBE_TAG, SESSION_TAG],
      // Required by the API, and false is what we want: a protected server
      // refuses to be terminated, which is the one thing the reaper must do.
      protected: false,
    })
    .catch((error: { body?: { details?: unknown[] } }) => {
      // The SDK's message drops the details, and for a quota error the details
      // are the whole answer: which quota, and what it currently allows.
      const details = error.body?.details
      if (details) console.error('\ndétail renvoyé par Scaleway :', JSON.stringify(details, null, 2))
      throw error
    })
  if (!server) throw new Error('createServer returned no server — check the reaper before retrying')
  console.log(`\ncreated server ${server.id} (${commercialType}, never powered on)`)
  show('tags returned at creation', server.tags)

  const serversBySession = await api.listServers({ zone, project: projectId, tags: [SESSION_TAG] })
  show(`filter tags=${SESSION_TAG}`, serversBySession.servers.map((each) => each.id))

  console.log('\ndestroy with: npm --prefix probe run scw:reap -- --yes')
})
