import 'dotenv/config'
import { createClient } from '@scaleway/sdk-client'
import { Instancev1, Marketplacev2 } from '@scaleway/sdk'

export function scwConfig() {
  const required = ['SCW_ACCESS_KEY', 'SCW_SECRET_KEY', 'SCW_PROJECT_ID', 'SCW_ZONE'] as const
  const missing = required.filter((key) => !process.env[key])
  if (missing.length > 0) {
    throw new Error(`probe/.env is missing: ${missing.join(', ')}`)
  }
  return {
    accessKey: process.env.SCW_ACCESS_KEY!,
    secretKey: process.env.SCW_SECRET_KEY!,
    projectId: process.env.SCW_PROJECT_ID!,
    zone: process.env.SCW_ZONE!,
  }
}

// One client for the whole probe. The SDK is the vendor's own: it knows the
// request shapes we kept guessing wrong — an image is a uuid and not a label,
// cloud-init user data is not JSON — and those guesses were failing after a
// billed resource existed.
export function scwClient() {
  const { accessKey, secretKey, projectId, zone } = scwConfig()
  return createClient({
    accessKey,
    secretKey,
    defaultProjectId: projectId,
    defaultZone: zone,
    defaultRegion: zone.slice(0, zone.lastIndexOf('-')),
  })
}

export const instanceApi = () => new Instancev1.API(scwClient())
export const marketplaceApi = () => new Marketplacev2.API(scwClient())

// Every probe script ends the same way; without this, six copies of the same
// six lines drift apart and one of them forgets to set a failing exit code.
export function runScript(main: () => Promise<void>): void {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
