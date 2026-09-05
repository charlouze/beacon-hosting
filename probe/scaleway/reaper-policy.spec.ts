import { describe, expect, it } from 'vitest'
import { PRODUCTION_TAG, PROBE_PREFIX, PROBE_TAG, selectDoomed } from './reaper-policy'

const server = (id: string, name: string, tags: string[] = []) => ({ id, name, tags, state: 'running' })
// The SDK leaves `server` absent rather than null when nothing is attached.
const ip = (id: string, address: string, tags: string[] = [], serverId?: string) => ({
  id,
  address,
  tags,
  ...(serverId ? { server: { id: serverId } } : {}),
})
const volume = (id: string, serverId?: string) => ({
  id,
  name: `${id}-vol`,
  size: 80_000_000_000,
  ...(serverId ? { server: { id: serverId } } : {}),
})

const inventory = (parts: Partial<{ servers: any[]; ips: any[]; volumes: any[] }>) => ({
  servers: parts.servers ?? [],
  ips: parts.ips ?? [],
  volumes: parts.volumes ?? [],
})

const withoutOrphans = { includeOrphanIps: false }
const withOrphans = { includeOrphanIps: true }

describe('selectDoomed', () => {
  it('claims a server whose name carries the probe prefix', () => {
    const doomed = selectDoomed(inventory({ servers: [server('s1', `${PROBE_PREFIX}0001`)] }), withoutOrphans)
    expect(doomed.servers.map((s) => s.id)).toEqual(['s1'])
  })

  it('leaves a server that is none of ours alone', () => {
    const doomed = selectDoomed(inventory({ servers: [server('s1', 'prod-web')] }), withoutOrphans)
    expect(doomed.servers).toEqual([])
  })

  // The reaper must never guess about a volume: it carries none of our tags,
  // and destroying someone else's disk is not a mistake it gets to make.
  it('reports a detached volume without ever claiming it', () => {
    const doomed = selectDoomed(inventory({ volumes: [volume('v1')] }), withOrphans)
    expect(doomed.strayVolumes.map((v) => v.id)).toEqual(['v1'])
  })

  it('says nothing about a volume still attached to a server', () => {
    const doomed = selectDoomed(
      inventory({ servers: [server('s1', `${PROBE_PREFIX}0001`)], volumes: [volume('v1', 's1')] }),
      withoutOrphans,
    )
    expect(doomed.strayVolumes).toEqual([])
  })

  // A running server dies by `terminate`, which takes its volumes with it. A
  // stopped one refuses that action entirely — it dies by deleteServer, which
  // leaves the disk behind, billed and attached to nothing. Measured on a
  // never-started probe server: "invalid state 'stopped' for the action
  // 'terminate'". The policy has to say which, because the two paths differ.
  it('marks a running server as terminable, volumes included', () => {
    const doomed = selectDoomed(
      inventory({
        servers: [{ ...server('s1', `${PROBE_PREFIX}0001`), state: 'running' }],
        volumes: [volume('v1', 's1')],
      }),
      withoutOrphans,
    )
    expect(doomed.servers[0].terminable).toBe(true)
    expect(doomed.servers[0].volumeIds).toEqual([])
  })

  it('marks a stopped server as needing its volumes deleted by hand', () => {
    const doomed = selectDoomed(
      inventory({
        servers: [{ ...server('s1', `${PROBE_PREFIX}0001`), state: 'stopped' }],
        volumes: [volume('v1', 's1'), volume('v2', 's1'), volume('v3', 'other')],
      }),
      withoutOrphans,
    )
    expect(doomed.servers[0].terminable).toBe(false)
    expect(doomed.servers[0].volumeIds).toEqual(['v1', 'v2'])
  })

  // Deliberate, and worth a test so that it stays a decision: on a project
  // dedicated to the probe, our tag outranks whose server the ip hangs off.
  it('claims a tagged ip even when it hangs off a server we spare', () => {
    const doomed = selectDoomed(
      inventory({ servers: [server('s1', 'prod-web')], ips: [ip('i1', '51.15.0.1', [PROBE_TAG], 's1')] }),
      withoutOrphans,
    )
    expect(doomed.ips.map((i) => i.id)).toEqual(['i1'])
  })

  // An ip has no name at Scaleway, only tags. Without this the reaper would be
  // blind to exactly the resource that keeps billing after its server dies.
  it('claims an ip by its probe tag alone', () => {
    const doomed = selectDoomed(inventory({ ips: [ip('i1', '51.15.0.1', [PROBE_TAG])] }), withoutOrphans)
    expect(doomed.ips.map((i) => i.id)).toEqual(['i1'])
  })

  it('claims an ip attached to a doomed server even without the tag', () => {
    const doomed = selectDoomed(
      inventory({ servers: [server('s1', `${PROBE_PREFIX}0001`)], ips: [ip('i1', '51.15.0.1', [], 's1')] }),
      withoutOrphans,
    )
    expect(doomed.ips.map((i) => i.id)).toEqual(['i1'])
  })

  it('reports an untagged unattached ip without claiming it', () => {
    const doomed = selectDoomed(inventory({ ips: [ip('i1', '51.15.0.1')] }), withoutOrphans)
    expect(doomed.ips).toEqual([])
    expect(doomed.orphanIps.map((i) => i.id)).toEqual(['i1'])
  })

  // Regression: the policy first compared `server === null`, and the SDK
  // renders an unattached ip with `server` absent — no orphan was ever seen.
  it('treats an absent server field as unattached, not as attached', () => {
    const doomed = selectDoomed(inventory({ ips: [{ id: 'i1', address: '51.15.0.1', tags: [] }] }), withoutOrphans)
    expect(doomed.orphanIps.map((i) => i.id)).toEqual(['i1'])
  })

  it('claims the untagged unattached ip once asked to', () => {
    const doomed = selectDoomed(inventory({ ips: [ip('i1', '51.15.0.1')] }), withOrphans)
    expect(doomed.ips.map((i) => i.id)).toEqual(['i1'])
  })

  it('never lists the same ip twice when tag and attachment both match', () => {
    const doomed = selectDoomed(
      inventory({ servers: [server('s1', `${PROBE_PREFIX}0001`)], ips: [ip('i1', '51.15.0.1', [PROBE_TAG], 's1')] }),
      withOrphans,
    )
    expect(doomed.ips).toHaveLength(1)
  })

  // Since tranche 1 a watchdog runs in production and creates ips tagged
  // `beacon`. Between createIp and createServer one of them is attached to
  // nothing — which is exactly what isOrphan() describes. Reaping it cuts a
  // session that is being provisioned right now.
  it('never claims an unattached ip carrying the production ownership tag', () => {
    const doomed = selectDoomed(
      inventory({ ips: [ip('i1', '1.2.3.4', [PRODUCTION_TAG])] }),
      withOrphans,
    )
    expect(doomed.ips).toEqual([])
    expect(doomed.orphanIps).toEqual([])
  })

  it('never claims a server carrying the production ownership tag', () => {
    const doomed = selectDoomed(
      inventory({ servers: [server('s1', `${PROBE_PREFIX}0001`, [PRODUCTION_TAG])] }),
      withOrphans,
    )
    expect(doomed.servers).toEqual([])
  })

  // The probe tag and the production tag are two different strings, and the
  // filter that reads them is exact. A probe resource stays reapable.
  it('still claims a probe resource that carries no production tag', () => {
    const doomed = selectDoomed(
      inventory({ servers: [server('s1', `${PROBE_PREFIX}0001`, [PROBE_TAG])] }),
      withoutOrphans,
    )
    expect(doomed.servers.map((s) => s.id)).toEqual(['s1'])
  })
})
