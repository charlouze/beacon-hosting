import { instanceApi, scwConfig, runScript } from './client'
import { readInventory } from './inventory'
import { selectDoomed } from './reaper-policy'

runScript(async () => {
  const { zone } = scwConfig()
  const api = instanceApi()
  const confirmed = process.argv.includes('--yes')
  const includeOrphanIps = process.argv.includes('--include-orphan-ips')

  const doomed = selectDoomed(await readInventory(), { includeOrphanIps })

  for (const server of doomed.servers) {
    const how = server.terminable
      ? 'terminate, volumes included'
      : `delete + ${server.volumeIds.length} volume(s) by hand`
    console.log(`server ${server.id} ${server.name} ${server.state} — ${how}`)
  }
  for (const ip of doomed.ips) {
    console.log(`flexible ip ${ip.id} ${ip.address}`)
  }
  if (doomed.orphanIps.length > 0) {
    console.log(
      `\n${doomed.orphanIps.length} unattached, untagged ip(s) left alone and still billed: ` +
        `${doomed.orphanIps.map((ip) => ip.address).join(', ')}\n` +
        'rerun with --include-orphan-ips to destroy them too',
    )
  }
  if (doomed.strayVolumes.length > 0) {
    console.log(
      `\n${doomed.strayVolumes.length} detached volume(s), billed and attached to nothing: ` +
        `${doomed.strayVolumes.map((volume) => volume.id).join(', ')}\n` +
        'they carry no tag of ours — destroy them by hand once identified',
    )
  }

  if (!confirmed) {
    console.log('\ndry run — rerun with --yes to destroy the resources listed above')
    return
  }

  // The ip goes first: an orphaned flexible ip keeps billing after its server dies.
  for (const ip of doomed.ips) {
    await api.deleteIp({ zone, ip: ip.id })
    console.log(`destroyed flexible ip ${ip.id}`)
  }
  for (const server of doomed.servers) {
    if (server.terminable) {
      // One call, and it takes the attached volumes with it. Deliberately not
      // serverActionAndWait: that helper polls the server until it settles, and
      // terminate deletes it — the poll then chases a 404 and throws *after* a
      // successful destruction, aborting the loop before the next server.
      await api.serverAction({ zone, serverId: server.id, action: 'terminate' })
      console.log(`terminated server ${server.id}`)
      continue
    }

    // A server that never ran refuses `terminate` outright. Deleting it leaves
    // the disks behind — billed, detached, and absent from the server list.
    await api.deleteServer({ zone, serverId: server.id })
    console.log(`deleted server ${server.id} (was ${server.state})`)
    for (const volumeId of server.volumeIds) {
      await api.deleteVolume({ zone, volumeId })
      console.log(`  deleted its volume ${volumeId}`)
    }
  }
})
