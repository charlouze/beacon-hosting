import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8')

// The marker already sits six spaces in, so only the following lines get indented.
const compose = read('./docker-compose.yml')
  .trimEnd()
  .split('\n')
  .map((line, index) => (index === 0 || line === '' ? line : `      ${line}`))
  .join('\n')

const serverName = process.env.SERVER_NAME ?? 'Beacon probe'
const serverPassword = process.env.SERVER_PASSWORD
if (!serverPassword) throw new Error('SERVER_PASSWORD is required')

// A function replacement, because `$&` and `$'` in a password would otherwise be
// read as capture-group syntax and silently corrupt it.
const fill = (template, marker, value) => template.replace(marker, () => value)

let rendered = read('./cloud-init/enshrouded.yaml.tmpl')
rendered = fill(rendered, '__DOCKER_COMPOSE__', compose)
rendered = fill(rendered, '__SERVER_NAME__', serverName)
rendered = fill(rendered, '__SERVER_PASSWORD__', serverPassword)

process.stdout.write(rendered)
