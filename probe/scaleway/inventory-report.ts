import { scwConfig, runScript } from './client'
import { readInventory } from './inventory'

runScript(async () => {
  const { zone } = scwConfig()
  const { servers, ips, volumes } = await readInventory()

  console.log(`\n=== servers in ${zone} (${servers.length}) ===`)
  for (const server of servers) {
    console.log([server.id, server.name, server.state, server.tags.join('|') || '-'].join('  '))
  }

  console.log(`\n=== flexible ips in ${zone} (${ips.length}) ===`)
  for (const ip of ips) {
    console.log(
      [ip.id, ip.address, ip.server?.id ?? 'unattached', ip.tags.join('|') || '-'].join('  '),
    )
  }

  console.log(`\n=== volumes in ${zone} (${volumes.length}) ===`)
  for (const volume of volumes) {
    console.log(
      [volume.id, volume.name, volume.server?.id ?? 'detached', `${volume.size}`].join('  '),
    )
  }
})
