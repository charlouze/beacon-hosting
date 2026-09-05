import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { runScript } from './client'
import { bootProbeServer, since } from './boot-server'

const RENDERER = fileURLToPath(new URL('../sunkenland/render-cloud-init.mjs', import.meta.url))

runScript(async () => {
  const sessionId = process.argv[2]
  if (!sessionId) throw new Error('usage: scw:sunkenland -- <sessionId>')

  const userData = execFileSync('node', [RENDERER], { encoding: 'utf8' })
  const { address, startedAt } = await bootProbeServer(sessionId, userData)

  console.log(`
=== à relever, montre en main ===
  création → running          ${since(startedAt)}
  ssh root@${address} 'cloud-init status --wait; cat /var/log/beacon-probe.log'
  ssh root@${address} 'docker logs -f beacon-probe-sunkenland'

  adresse à annoncer au second essai : ${address}

détruire :  npm --prefix probe run scw:reap -- --yes`)
})
