import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { deleteField, doc, setDoc, updateDoc } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'

const RULES_PATH = fileURLToPath(new URL('./firestore.rules', import.meta.url))

const MEMBER_UID = 'alice'
const STRANGER_UID = 'mallory'

// The two halves of server/current, as §5 of the spec splits them.
const REQUESTED_FIELDS = {
  state: 'IDLE',
  sessionId: '',
  startedBy: '',
  startedAt: null,
  deadline: null,
}

const RESERVED_FIELDS = {
  instanceId: 'i-seed',
  ipId: 'f-seed',
  ip: '203.0.113.7',
  provisionClaimedAt: null,
  lastError: '',
}

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-beacon',
    firestore: {
      rules: readFileSync(RULES_PATH, 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
})

afterAll(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore()
    await setDoc(doc(db, 'members', MEMBER_UID), { email: 'alice@example.com', role: 'player' })
    await setDoc(doc(db, 'server', 'current'), { ...REQUESTED_FIELDS, ...RESERVED_FIELDS })
  })
})

const asMember = () => env.authenticatedContext(MEMBER_UID).firestore()
const asStranger = () => env.authenticatedContext(STRANGER_UID).firestore()

describe('field ownership on server/current', () => {
  it('lets a member write a requested field', async () => {
    const db = asMember()
    await assertSucceeds(updateDoc(doc(db, 'server', 'current'), { deadline: 'T+4h' }))
  })

  it('rejects a member writing a reserved field alone', async () => {
    const db = asMember()
    await assertFails(updateDoc(doc(db, 'server', 'current'), { ip: '198.51.100.4' }))
  })

  // The crux: one illegitimate field must sink an otherwise legitimate write.
  it('rejects a mixed write as a whole', async () => {
    const db = asMember()
    await assertFails(
      updateDoc(doc(db, 'server', 'current'), { deadline: 'T+5h', ip: '198.51.100.4' }),
    )
  })

  it('rejects a member deleting a reserved field', async () => {
    const db = asMember()
    await assertFails(updateDoc(doc(db, 'server', 'current'), { ip: deleteField() }))
  })

  it('rejects a member asserting a state only a Function can constate', async () => {
    const db = asMember()
    await assertFails(updateDoc(doc(db, 'server', 'current'), { state: 'RUNNING' }))
  })

  it('rejects a non-member entirely', async () => {
    const db = asStranger()
    await assertFails(updateDoc(doc(db, 'server', 'current'), { deadline: 'T+4h' }))
  })

  it('rejects a client creating the document', async () => {
    await env.clearFirestore()
    await env.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'members', MEMBER_UID), {
        email: 'alice@example.com',
        role: 'player',
      })
    })
    const db = asMember()
    await assertFails(
      setDoc(doc(db, 'server', 'current'), { ...REQUESTED_FIELDS, ...RESERVED_FIELDS }),
    )
  })

  // Observation, not a requirement: diff() reports changed keys, so rewriting a
  // reserved field with its current value may not register as a change at all.
  // Whatever this does, it goes in RESULTS.md — the rules of tranche 4 must know.
  it('records what an identical rewrite of a reserved field does', async () => {
    const db = asMember()
    await assertSucceeds(updateDoc(doc(db, 'server', 'current'), { ip: RESERVED_FIELDS.ip }))
  })
})
