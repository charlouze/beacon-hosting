import { Blockv1, type Instancev1 } from '@scaleway/sdk'
import { instanceApi, marketplaceApi, runScript, scwClient, scwConfig } from './client'
import { PROBE_PREFIX, PROBE_TAG } from './reaper-policy'

/**
 * What a block root volume does at Scaleway, measured before anything is
 * designed on it: which image it wants, whether tags land, what a dying server
 * does to it, and how long it takes to become deletable.
 *
 * The probe tag, never the ownership tag: the production watchdog destroys a
 * `beacon` resource it cannot pair with a session, in the middle of the
 * measurement. Nothing here carries a public ip — a machine reaches `running`
 * without one, and that is all this script watches.
 *
 * Two halves. The cold one never boots: a stopped server is free, its volume
 * costs a fraction of a cent. `--boot` adds the half that needs a running
 * machine — `terminate` is refused on anything else — and that one bills an
 * hour of instance per type.
 */

const TYPES = ['DEV1-L', 'PLAY2-MICRO']
const VOLUME_BYTES = 20_000_000_000
const WATCH_MS = 3 * 60_000

const started = Date.now()
const at = () => `${((Date.now() - started) / 1000).toFixed(1).padStart(6)}s`
const say = (line: string) => console.log(`${at()}  ${line}`)
const show = (label: string, value: unknown) => say(`${label.padEnd(44)} ${JSON.stringify(value)}`)
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Status, type and message, because the sdk's own message drops the details. */
const refusal = (error: unknown) => {
  const e = error as { status?: number; type?: string; message?: string; body?: unknown }
  return { status: e.status, type: e.type, message: e.message, body: e.body }
}

const isGone = (error: unknown) => {
  const e = error as { status?: number; type?: string }
  return e.status === 404 || e.type === 'not_found'
}

const attempt = async <T>(label: string, call: () => Promise<T>): Promise<T | undefined> => {
  try {
    const result = await call()
    say(`${label}: accepted`)
    return result
  } catch (error) {
    show(`${label}: REFUSED`, refusal(error))
    return undefined
  }
}

runScript(async () => {
  const { zone, projectId } = scwConfig()
  const instance = instanceApi()
  const block = new Blockv1.API(scwClient())
  const marketplace = marketplaceApi()

  const boot = process.argv.includes('--boot')
  const typeIndex = process.argv.indexOf('--type')
  const types = typeIndex === -1 ? TYPES : [process.argv[typeIndex + 1]]
  const run = Date.now().toString(36)

  const serverIds = new Set<string>()
  const volumeIds = new Set<string>()

  const volumeState = async (volumeId: string) => {
    try {
      const volume = await block.getVolume({ zone, volumeId })
      return JSON.stringify({
        status: volume.status,
        references: volume.references.map((r) => `${r.productResourceType}:${r.status}`),
      })
    } catch (error) {
      return isGone(error) ? 'gone' : `error ${JSON.stringify(refusal(error))}`
    }
  }

  const serverState = async (serverId: string) => {
    try {
      return (await instance.getServer({ zone, serverId })).server?.state ?? 'no server in answer'
    } catch (error) {
      return isGone(error) ? 'gone' : `error ${JSON.stringify(refusal(error))}`
    }
  }

  /** Every change of either state, timestamped, until both are gone or time is up. */
  const watch = async (serverId: string, volumeId: string, stopWhenVolumeFree: boolean) => {
    const until = Date.now() + WATCH_MS
    let last = ''
    while (Date.now() < until) {
      const now = `server=${await serverState(serverId)} volume=${await volumeState(volumeId)}`
      if (now !== last) say(`  ${now}`)
      last = now
      if (now.includes('volume=gone')) return 'gone'
      if (stopWhenVolumeFree && now.includes('server=gone') && now.includes('"references":[]')) {
        return 'detached'
      }
      await sleep(1000)
    }
    return 'timeout'
  }

  const images = async (commercialType: string) => {
    const { localImages } = await marketplace.listLocalImages({
      imageLabel: 'ubuntu_noble',
      zone,
      pageSize: 100,
    })
    const compatible = localImages.filter((image) =>
      (image.compatibleCommercialTypes ?? []).includes(commercialType),
    )
    show(
      `ubuntu_noble images for ${commercialType}`,
      compatible.map((image) => ({ id: image.id, type: image.type, arch: image.arch })),
    )
    // The first one is what production's resolver takes today, whatever its type.
    show('  the resolver would take today', compatible[0]?.type ?? null)
    return compatible
  }

  const create = async (commercialType: string, sessionTag: string, imageId: string) => {
    const { server } = await instance.createServer({
      zone,
      project: projectId,
      name: `${PROBE_PREFIX}volume-${run}-${commercialType.toLowerCase()}`,
      commercialType,
      image: imageId,
      volumes: { '0': { size: VOLUME_BYTES, volumeType: 'sbs_volume' } },
      dynamicIpRequired: false,
      tags: [PROBE_TAG, sessionTag],
      protected: false,
    } as Instancev1.CreateServerRequest)
    if (!server) throw new Error('createServer returned no server')
    serverIds.add(server.id)
    for (const volume of Object.values(server.volumes)) volumeIds.add(volume.id)
    return server
  }

  /** The image that works, tried in the order sbs then local, with each refusal shown. */
  const createOnBlock = async (commercialType: string, sessionTag: string) => {
    const compatible = await images(commercialType)
    const ordered = [...compatible].sort((a) => (a.type === 'instance_sbs' ? -1 : 1))
    for (const image of ordered) {
      const server = await attempt(
        `createServer ${commercialType}, sbs_volume root, image type ${image.type}`,
        () => create(commercialType, sessionTag, image.id),
      )
      if (server) return server
    }
    return undefined
  }

  const describe = async (server: Instancev1.Server, sessionTag: string) => {
    const root = Object.values(server.volumes)[0]
    show('server.volumes as the instance api returns it', server.volumes)
    const volume = await block.getVolume({ zone, volumeId: root.id })
    show('the same volume, by the block api', volume)

    await attempt('block updateVolume, two tags', () =>
      block.updateVolume({ zone, volumeId: root.id, tags: [PROBE_TAG, sessionTag] }),
    )
    show('tags on re-read', (await block.getVolume({ zone, volumeId: root.id })).tags)
    show('references, server created and never started', await volumeState(root.id))

    const fromInstance = await instance.listVolumes({ zone, project: projectId })
    const seen = fromInstance.volumes.find((each) => each.id === root.id)
    show(
      'instance listVolumes sees this block volume',
      seen ? { volumeType: seen.volumeType, tags: seen.tags, server: seen.server?.id } : false,
    )
    return root.id
  }

  const listByTag = async (label: string, tags: string[]) => {
    const { volumes } = await block.listVolumes({ zone, projectId, tags, includeDeleted: false })
    show(`block listVolumes tags=${JSON.stringify(tags)} ${label}`, volumes.map((each) => each.id))
  }

  const destroyVolume = async (volumeId: string) => {
    await attempt('instance deleteVolume on the detached block volume', () =>
      instance.deleteVolume({ zone, volumeId }),
    )
    show('  after it, the block api says', await volumeState(volumeId))
    if ((await volumeState(volumeId)) === 'gone') return
    const before = Date.now()
    await attempt('block deleteVolume on the detached volume', () =>
      block.deleteVolume({ zone, volumeId }),
    )
    while ((await volumeState(volumeId)) !== 'gone' && Date.now() - before < WATCH_MS) {
      await sleep(1000)
    }
    show('  gone after (ms)', Date.now() - before)
  }

  try {
    // ---- cold half: a server that never boots ----
    const cold: { type: string; tag: string; volumeId: string; serverId: string }[] = []
    for (const type of types) {
      say(`\n== ${type}, never started ==`)
      const tag = `session:volume-${run}-${type.toLowerCase()}`
      const server = await createOnBlock(type, tag)
      if (!server) continue
      cold.push({ type, tag, serverId: server.id, volumeId: await describe(server, tag) })
    }

    if (cold.length === 0) {
      say('\nno server could be created — nothing to measure, see the refusals above')
      return
    }

    // With two volumes carrying two session tags, a filter that is exact
    // returns one id per tag, and one that is not returns both.
    say('\n== the tag filter of the block api ==')
    for (const each of cold) await listByTag(`(${each.type})`, [each.tag])
    await listByTag('(shared tag)', [PROBE_TAG])
    await listByTag('(prefix?)', ['session:'])
    if (cold.length > 0) await listByTag('(two tags: and, or?)', [cold[0].tag, 'no-such-tag'])

    for (const each of cold) {
      say(`\n== ${each.type}: deleting the stopped server ==`)
      await attempt('block deleteVolume while still attached', () =>
        block.deleteVolume({ zone, volumeId: each.volumeId }),
      )
      await instance.deleteServer({ zone, serverId: each.serverId })
      say('deleteServer accepted, watching')
      const outcome = await watch(each.serverId, each.volumeId, true)
      show('  the volume, once the server is gone', outcome)
      if (outcome !== 'gone') await destroyVolume(each.volumeId)
    }

    if (!boot) {
      say('\ncold half done — rerun with --boot for what terminate does (bills an hour per type)')
      return
    }

    // ---- warm half: a running server, then terminate ----
    for (const type of types) {
      say(`\n== ${type}, booted then terminated ==`)
      const tag = `session:volume-${run}-${type.toLowerCase()}-boot`
      const server = await createOnBlock(type, tag)
      if (!server) continue
      const volumeId = Object.values(server.volumes)[0].id
      await block.updateVolume({ zone, volumeId, tags: [PROBE_TAG, tag] })

      const before = Date.now()
      const running = await attempt('poweron, waiting for running', () =>
        instance.serverActionAndWait(
          { zone, serverId: server.id, action: 'poweron' },
          { timeout: 8 * 60_000 },
        ),
      )
      if (!running) continue
      show('  running after (ms)', Date.now() - before)
      show('  the volume while its server runs', await volumeState(volumeId))
      show('  its specs', (await block.getVolume({ zone, volumeId })).specs)

      await instance.serverAction({ zone, serverId: server.id, action: 'terminate' })
      say('terminate accepted, watching')
      const outcome = await watch(server.id, volumeId, true)
      show('  terminate took the volume with it', outcome === 'gone')
      if (outcome !== 'gone') await destroyVolume(volumeId)
    }
  } finally {
    // Whatever the measures did, nothing this run created may outlive it.
    say('\n== cleanup ==')
    for (const serverId of serverIds) {
      const state = await serverState(serverId)
      if (state === 'gone') continue
      if (state === 'running') {
        await attempt(`terminate ${serverId}`, () =>
          instance.serverAction({ zone, serverId, action: 'terminate' }),
        )
      } else {
        await attempt(`deleteServer ${serverId}`, () => instance.deleteServer({ zone, serverId }))
      }
    }
    for (const volumeId of volumeIds) {
      const until = Date.now() + WATCH_MS
      while (Date.now() < until) {
        const state = await volumeState(volumeId)
        if (state === 'gone') break
        if (state.includes('"references":[]')) {
          await block.deleteVolume({ zone, volumeId }).catch(() => undefined)
        }
        await sleep(2000)
      }
      const left = await volumeState(volumeId)
      say(left === 'gone' ? `volume ${volumeId} gone` : `!! volume ${volumeId} STILL THERE: ${left}`)
    }
    for (const serverId of serverIds) {
      const left = await serverState(serverId)
      if (left !== 'gone') say(`!! server ${serverId} STILL THERE: ${left}`)
    }
  }
})
