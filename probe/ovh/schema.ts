// Kept, and deliberately self-contained: this is the command that founds
// section T of probe/RESULTS.md, and a measurement whose command no longer runs
// is not a measurement. It must survive the removal of everything else OVH.

const SCHEMA_URL = 'https://eu.api.ovh.com/1.0/cloud.json'

type Model = { properties?: Record<string, { type?: string }>; enum?: string[] }

// Names alone cannot answer "does this resource carry free-form metadata", which
// is the only reason to read the schema at all. One line per model, fields
// included, stays dense enough to skim and complete enough to conclude.
function describe(name: string, model: Model): string {
  if (model.enum) return `${name}  enum: ${model.enum.join(' | ')}`
  const properties = Object.entries(model.properties ?? {})
    .map(([field, spec]) => `${field}: ${spec.type ?? '?'}`)
    .join(', ')
  return `${name}  { ${properties} }`
}

async function main() {
  const needle = (process.argv[2] ?? 'metadata').toLowerCase()
  const schema = (await (await fetch(SCHEMA_URL)).json()) as {
    apis: { path: string; operations: { httpMethod: string }[] }[]
    models: Record<string, Model>
  }

  console.log(`=== paths matching "${needle}" ===`)
  for (const api of schema.apis) {
    if (api.path.toLowerCase().includes(needle)) {
      console.log(api.path, api.operations.map((operation) => operation.httpMethod).join(','))
    }
  }

  console.log(`\n=== models mentioning "${needle}" ===`)
  for (const [name, model] of Object.entries(schema.models)) {
    if (JSON.stringify(model).toLowerCase().includes(needle)) {
      console.log(describe(name, model))
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
