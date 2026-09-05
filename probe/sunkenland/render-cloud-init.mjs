import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

// The markers sit six spaces in, so only the following lines get indented.
const indent = (text) =>
  text
    .trimEnd()
    .split('\n')
    .map((line, index) => (index === 0 || line === '' ? line : `      ${line}`))
    .join('\n')

const required = (name) => {
  const value = process.env[name]
  if (!value) throw new Error(`${name} is required`)
  return value
}

// A function replacement, and every occurrence: `$&` and `$'` inside a password
// or a secret key would otherwise be read as capture-group syntax and silently
// corrupt it.
const fill = (template, marker, value) => template.replaceAll(marker, () => value)

// The password survives this renderer, then docker compose eats it: interpolation
// reads `$bc` as an unset variable, and `a$bc${REGION}d` reaches the server as
// `aeud` — measured. Refused here rather than repaired, because this is the last
// moment before a billed machine exists, and because a password nobody can read
// back from the log is the one value that must not be silently rewritten.
const password = () => {
  const value = required('GAME_PASSWORD')
  if (value.includes('$')) {
    throw new Error('GAME_PASSWORD must not contain `$`: docker compose would swallow it')
  }
  return value
}

let rendered = read('./cloud-init.yaml.tmpl')
rendered = fill(rendered, '__START_SH__', indent(read('./start.sh')))
rendered = fill(rendered, '__DOCKER_COMPOSE__', indent(read('./docker-compose.yml')))
rendered = fill(rendered, '__WORLD_GUID__', required('WORLD_GUID'))
rendered = fill(rendered, '__GAME_PASSWORD__', password())
rendered = fill(rendered, '__ADMIN_STEAM_IDS__', process.env.ADMIN_STEAM_IDS ?? '')
rendered = fill(rendered, '__S3_ENDPOINT__', required('SCW_S3_ENDPOINT'))
rendered = fill(rendered, '__S3_REGION__', required('SCW_S3_REGION'))
rendered = fill(rendered, '__S3_ACCESS_KEY__', required('SCW_S3_RO_ACCESS_KEY'))
rendered = fill(rendered, '__S3_SECRET_KEY__', required('SCW_S3_RO_SECRET_KEY'))
rendered = fill(rendered, '__BUCKET__', required('SCW_BUCKET'))

process.stdout.write(rendered)
