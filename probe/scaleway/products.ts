import { instanceApi, scwConfig, runScript } from './client'

// RAM is reported in bytes of GiB; volume sizes in bytes of GB. Mixing the two
// units is how a 8 GiB machine reads as "9 Go" and a range reads as a capacity.
const GIB = 1024 ** 3
const GB = 1000 ** 3
const range = (min?: number, max?: number) =>
  min === undefined || max === undefined
    ? 'block only'
    : min === max
      ? `${min / GB} Go`
      : `${min / GB}-${max / GB} Go`

runScript(async () => {
  const { zone } = scwConfig()
  const needle = (process.argv[2] ?? '').toUpperCase()

  const api = instanceApi()
  const [{ servers }, availability] = await Promise.all([
    api.listServersTypes({ zone, perPage: 100 }),
    // A type can be catalogued, priced, not end-of-service — and still refuse to
    // be created because the zone has no capacity. Listing without this column
    // is how a default was chosen that could not be provisioned.
    api.getServerTypesAvailability({ zone, perPage: 100 }),
  ])

  const matching = Object.entries(servers ?? {}).filter(([name]) => !needle || name.includes(needle))
  if (matching.length === 0) {
    console.log(`no commercial type matching "${needle}" in ${zone}`)
    return
  }

  for (const [name, type] of matching.sort((a, b) => a[1].hourlyPrice - b[1].hourlyPrice)) {
    const local = type.perVolumeConstraint?.lSsd
    console.log(
      [
        name.padEnd(19),
        `${type.ncpus} vCPU`.padEnd(8),
        `${Math.round(type.ram / GIB)} Gio`.padEnd(8),
        `local ${range(local?.minSize, local?.maxSize)}`.padEnd(22),
        `total ${range(type.volumesConstraint?.minSize, type.volumesConstraint?.maxSize)}`.padEnd(22),
        `${type.hourlyPrice} EUR/h`.padEnd(16),
        (availability.servers?.[name]?.availability ?? '?').padEnd(11),
        // The one field neither the pricing page nor the raw catalogue exposes,
        // and the only honest answer to "is this range going away?".
        type.endOfService ? 'END OF SERVICE' : '',
      ].join('  ').trimEnd(),
    )
  }
})
