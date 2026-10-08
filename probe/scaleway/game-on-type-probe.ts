import { GetObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3'
import { Blockv1 } from '@scaleway/sdk'
import { renderCloudInit } from '../../deploy/cloud-init/src/lib/catalog.js'
import { instanceApi, marketplaceApi, runScript, scwClient, scwConfig } from './client'
import { PROBE_PREFIX, PROBE_TAG } from './reaper-policy'

/**
 * The production machine of one game, on a commercial type production does not
 * order yet, to read what only the real thing shows: how long the game takes
 * to finish loading there, how full the disk gets, and how long a loaded
 * machine takes to let go of its volume.
 *
 * The cloud-init is production's own, rendered by the same function, minus the
 * companion's agent: nothing here pushes a save or reports to the control
 * plane. The s3 key is the read-only one, so the restore reads the world and
 * the game files and nothing on this machine could write either bucket.
 *
 *   --worlds                      the world ids the saves bucket holds
 *   --can-read <worldId>          which key of probe/.env reads what the restore needs
 *   <worldId>                     boot the machine on that world's newest save
 *   --destroy <sessionId>         terminate it, timing the volume's release
 *
 * SCW_COMMERCIAL_TYPE picks the type (default PLAY2-MICRO), DISK_GB the disk,
 * PROBE_GAME the game (default sunkenland), PROBE_S3_KEY=full the key that the
 * games bucket lets in.
 */

const GAME = process.env.PROBE_GAME === 'enshrouded' ? ('enshrouded' as const) : ('sunkenland' as const)
/** Only one of the two cannot download its own files, and reads them from the games bucket. */
const READS_GAME_FILES = GAME === 'sunkenland'
const COMMERCIAL_TYPE = process.env.SCW_COMMERCIAL_TYPE ?? 'PLAY2-MICRO'
const DISK_BYTES = Number(process.env.DISK_GB ?? 20) * 1_000_000_000
const SAVES_BUCKET = process.env.BEACON_SAVES_BUCKET ?? 'beacon-saves'
const GAMES_BUCKET = process.env.BEACON_GAMES_BUCKET ?? 'beacon-games'

const started = Date.now()
const at = () => `${((Date.now() - started) / 1000).toFixed(1).padStart(6)}s`
const say = (line: string) => console.log(`${at()}  ${line}`)
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const required = (name: string): string => {
  const value = process.env[name]
  if (!value) throw new Error(`probe/.env is missing ${name}`)
  return value
}

const isGone = (error: unknown) => {
  const e = error as { status?: number; type?: string }
  return e.status === 404 || e.type === 'not_found'
}

/**
 * Production's compose without its third service. Cut out of the rendered
 * document rather than rendered apart, so that everything else — the entry
 * point, the filter, the restore — is byte for byte what a session boots.
 */
const withoutAgent = (cloudInit: string): string => {
  const lines = cloudInit.split('\n')
  const from = lines.findIndex((line) => /^ {8}agent:\s*$/.test(line))
  const to = lines.findIndex((line, index) => index > from && /^ {2}\S/.test(line))
  if (from === -1 || to === -1) {
    throw new Error('the rendered cloud-init no longer has the shape this probe cuts the agent from')
  }
  return [...lines.slice(0, from), ...lines.slice(to)].join('\n')
}

/**
 * Which pair of `probe/.env` the machine is handed. The read-only one unless
 * `PROBE_S3_KEY=full` says otherwise: the games bucket opens its reads by a
 * bucket policy, and a key that lists the saves is not thereby let into it —
 * measured the expensive way, on a booted machine whose restore was denied.
 */
const KEY_PAIRS = {
  ro: ['SCW_S3_RO_ACCESS_KEY', 'SCW_S3_RO_SECRET_KEY'],
  full: ['SCW_S3_ACCESS_KEY', 'SCW_S3_SECRET_KEY'],
} as const
type KeyPair = keyof typeof KEY_PAIRS
const CHOSEN: KeyPair = process.env.PROBE_S3_KEY === 'full' ? 'full' : 'ro'

const s3For = (pair: KeyPair) =>
  new S3Client({
    endpoint: required('SCW_S3_ENDPOINT'),
    region: required('SCW_S3_REGION'),
    credentials: {
      accessKeyId: required(KEY_PAIRS[pair][0]),
      secretAccessKey: required(KEY_PAIRS[pair][1]),
    },
  })

/** Free, and to run before any boot: what the restore will read, read from here. */
const canRead = async (worldId: string) => {
  for (const pair of Object.keys(KEY_PAIRS) as KeyPair[]) {
    if (!process.env[KEY_PAIRS[pair][0]]) {
      console.log(`${pair.padEnd(5)} not in probe/.env`)
      continue
    }
    const s3 = s3For(pair)
    const verdict = async (label: string, call: () => Promise<unknown>) => {
      try {
        // `bytes 0-0/<total>`: the object's size, for the price of one byte.
        const range = ((await call()) as { ContentRange?: string } | undefined)?.ContentRange
        const total = range ? ` — ${(Number(range.split('/')[1]) / 1e9).toFixed(2)} GB` : ''
        console.log(`${pair.padEnd(5)} ${label.padEnd(44)} ok${total}`)
      } catch (error) {
        const e = error as { name?: string; $metadata?: { httpStatusCode?: number } }
        console.log(`${pair.padEnd(5)} ${label.padEnd(44)} ${e.name} ${e.$metadata?.httpStatusCode ?? ''}`)
      }
    }
    if (READS_GAME_FILES) {
      await verdict(`get ${GAMES_BUCKET}/${GAME}/game.tar (first byte)`, () =>
        s3.send(new GetObjectCommand({ Bucket: GAMES_BUCKET, Key: `${GAME}/game.tar`, Range: 'bytes=0-0' })),
      )
    }
    await verdict(`list ${SAVES_BUCKET}`, async () => {
      const listed = await s3.send(new ListObjectsV2Command({ Bucket: SAVES_BUCKET, MaxKeys: 1000 }))
      const key = listed.Contents?.map((each) => each.Key ?? '').find((each) => each.includes(`/${worldId}/`))
      if (!key) throw Object.assign(new Error(), { name: `no object under */${worldId}/` })
      await verdict(`get ${SAVES_BUCKET}/${key} (first byte)`, () =>
        s3.send(new GetObjectCommand({ Bucket: SAVES_BUCKET, Key: key, Range: 'bytes=0-0' })),
      )
    })
  }
}

const listWorlds = async () => {
  const s3 = s3For(CHOSEN)
  const prefixes = async (prefix: string) =>
    (
      await s3.send(new ListObjectsV2Command({ Bucket: SAVES_BUCKET, Prefix: prefix, Delimiter: '/' }))
    ).CommonPrefixes?.map((each) => each.Prefix ?? '') ?? []

  for (const origin of await prefixes('')) {
    console.log(origin)
    for (const world of await prefixes(origin)) console.log(`  ${world.slice(origin.length)}`)
  }
}

const boot = async (worldId: string) => {
  const { zone, projectId } = scwConfig()
  const instance = instanceApi()
  const block = new Blockv1.API(scwClient())

  const sessionId = `game-${Date.now().toString(36)}`
  const sessionTag = `session:${sessionId}`
  const tags = [PROBE_TAG, sessionTag]

  // Rendered before anything is billed: a refusal here costs nothing.
  const userData = withoutAgent(
    renderCloudInit(GAME, {
      world: { worldId, name: 'Beacon probe' },
      serverPassword: required('SERVER_PASSWORD'),
      slotCount: 4,
      adminSteamIds: [],
      sessionId,
      agentToken: '0'.repeat(64),
      endpoint: 'https://probe.invalid/agentReport',
      saves: {
        endpoint: required('SCW_S3_ENDPOINT'),
        region: required('SCW_S3_REGION'),
        savesBucket: SAVES_BUCKET,
        gamesBucket: GAMES_BUCKET,
        accessKey: required(KEY_PAIRS[CHOSEN][0]),
        secretKey: required(KEY_PAIRS[CHOSEN][1]),
      },
    }),
  )

  const { localImages } = await marketplaceApi().listLocalImages({
    imageLabel: 'ubuntu_noble',
    zone,
    pageSize: 100,
  })
  const image = localImages.find(
    (each) =>
      each.type === 'instance_sbs' && (each.compatibleCommercialTypes ?? []).includes(COMMERCIAL_TYPE),
  )
  if (!image) throw new Error(`no instance_sbs ubuntu_noble image for ${COMMERCIAL_TYPE} in ${zone}`)

  const { ip } = await instance.createIp({ zone, project: projectId, tags })
  if (!ip?.address) throw new Error('createIp returned no address — nothing was booted')
  say(`ip ${ip.address}`)

  const destroy = `npx tsx ${process.argv[1]} --destroy ${sessionId}`
  try {
    const { server } = await instance.createServer({
      zone,
      project: projectId,
      name: `${PROBE_PREFIX}${sessionId}`,
      commercialType: COMMERCIAL_TYPE,
      image: image.id,
      volumes: { '0': { size: DISK_BYTES, volumeType: 'sbs_volume' } },
      publicIps: [ip.id],
      tags,
      protected: false,
    })
    if (!server) throw new Error('createServer returned no server')
    say(`server ${server.id} (${COMMERCIAL_TYPE}, ${DISK_BYTES / 1e9} GB block)`)

    for (const volume of Object.values(server.volumes)) {
      await block.updateVolume({ zone, volumeId: volume.id, tags })
    }
    await instance.setServerUserData({
      zone,
      serverId: server.id,
      key: 'cloud-init',
      content: userData,
    })
    await instance.serverActionAndWait(
      { zone, serverId: server.id, action: 'poweron' },
      { timeout: 8 * 60_000 },
    )
    say('running')
  } catch (error) {
    console.error(`\nboot failed — destroy what exists with:\n  ${destroy}\n`)
    throw error
  }

  console.log(`
=== à relever ===
  la mise en place (quelques minutes) :
    ssh root@${ip.address} 'cloud-init status --wait; docker ps -a'
  le journal du jeu :
    ssh root@${ip.address} 'docker logs -t ${GAME} 2>&1 | tail -20'
  le processeur, le disque et la mémoire :
    ssh root@${ip.address} 'lscpu | grep "Model name"; df -h /; docker stats --no-stream'
  le pic du disque, échantillonné dix minutes :
    ssh root@${ip.address} 'm=0; for i in $(seq 1 120); do u=$(df --output=used -BM / | tail -1 | tr -dc 0-9); [ "$u" -gt "$m" ] && m=$u; sleep 5; done; echo "pic $m Mo"; df -h / | tail -1'

=== détruire, en mesurant la libération du volume ===
  cd ${process.cwd()} && ${destroy}
`)
}

const destroy = async (sessionId: string) => {
  const { zone, projectId } = scwConfig()
  const instance = instanceApi()
  const block = new Blockv1.API(scwClient())
  const sessionTag = `session:${sessionId}`
  const mine = <T extends { tags?: string[] }>(resources: T[]) =>
    resources.filter((each) => (each.tags ?? []).includes(sessionTag) && each.tags?.includes(PROBE_TAG))

  const { ips } = await instance.listIps({ zone, project: projectId, tags: [sessionTag] })
  for (const ip of mine(ips)) {
    await instance.deleteIp({ zone, ip: ip.id })
    say(`ip ${ip.address} deleted`)
  }

  const { servers } = await instance.listServers({ zone, project: projectId, tags: [sessionTag] })
  for (const server of mine(servers)) {
    if (server.state === 'running') {
      await instance.serverAction({ zone, serverId: server.id, action: 'terminate' })
      say(`server ${server.id} terminate accepted`)
    } else {
      await instance.deleteServer({ zone, serverId: server.id })
      say(`server ${server.id} (${server.state}) deleted`)
    }
  }

  // By tag, never by attachment: the instance api neither lists nor deletes a
  // block volume — measured, see `volume-probe.ts`.
  const asked = Date.now()
  const pending = new Set(
    mine(
      (await block.listVolumes({ zone, projectId, tags: [sessionTag], includeDeleted: false })).volumes,
    ).map((each) => each.id),
  )
  let last = ''
  while (pending.size > 0 && Date.now() - asked < 10 * 60_000) {
    for (const volumeId of pending) {
      try {
        const volume = await block.getVolume({ zone, volumeId })
        const now = `${volume.status} ${volume.references.map((r) => r.status).join(',')}`
        if (now !== last) say(`  volume ${volumeId}: ${now || 'no reference'}`)
        last = now
        if (volume.references.length === 0) {
          say(`  detached ${((Date.now() - asked) / 1000).toFixed(1)}s after the destruction was asked`)
          await block.deleteVolume({ zone, volumeId })
        }
      } catch (error) {
        if (!isGone(error)) throw error
        say(`  volume ${volumeId} gone`)
        pending.delete(volumeId)
      }
    }
    await sleep(1000)
  }
  if (pending.size > 0) console.error(`!! STILL THERE: volume(s) ${[...pending].join(', ')}`)
}

runScript(async () => {
  const [first, second] = process.argv.slice(2)
  if (first === '--check') {
    // No network, no key: what the machine would run, with nothing secret in it.
    const rendered = withoutAgent(
      renderCloudInit(GAME, {
        world: { worldId: 'check', name: 'check' },
        serverPassword: 'check',
        slotCount: 4,
        adminSteamIds: [],
        sessionId: 'check',
        agentToken: '0'.repeat(64),
        endpoint: 'https://probe.invalid/agentReport',
        saves: {
          endpoint: 'https://s3.fr-par.scw.cloud',
          region: 'fr-par',
          savesBucket: SAVES_BUCKET,
          gamesBucket: GAMES_BUCKET,
          accessKey: 'CHECK',
          secretKey: 'CHECK',
        },
      }),
    )
    console.log(rendered.split('\n').filter((line) => /^ {8}\S+:\s*$|container_name|^ {2}- path|^runcmd|^ {2}- \[/.test(line)).join('\n'))
    return
  }
  if (first === '--worlds') return listWorlds()
  if (first === '--can-read' && second) return canRead(second)
  if (first === '--destroy' && second) return destroy(second)
  if (!first || first.startsWith('--')) {
    throw new Error('usage: game-on-type-probe.ts --worlds | <worldId> | --destroy <sessionId>')
  }
  return boot(first)
})
