import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { runScript } from './client'
import { bootProbeServer, since } from './boot-server'

const RENDERER = fileURLToPath(new URL('../../deploy/render-cloud-init.mjs', import.meta.url))

runScript(async () => {
  const sessionId = process.argv[2]
  if (!sessionId) throw new Error('usage: scw:session -- <sessionId>')
  if (!process.env.SERVER_PASSWORD) throw new Error('probe/.env is missing SERVER_PASSWORD')

  // The very same renderer the deploy README documents: what boots is what was
  // tested locally.
  const userData = execFileSync('node', [RENDERER], { encoding: 'utf8' })
  const { address, startedAt } = await bootProbeServer(sessionId, userData)

  console.log(`
=== à relever, montre en main ===
  création → running          ${since(startedAt)}
  ssh root@${address} 'cloud-init status --wait; docker logs -f enshrouded'

Le compte à rebours du produit continue au-delà de « running » : SteamCMD mange
les minutes suivantes, et c'est cette durée-là qu'annonce l'interface.

détruire :  npm --prefix probe run scw:reap -- --yes`)
})
