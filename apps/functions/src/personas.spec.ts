import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { adminWorldRecord } from '@beacon/session-record';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DEV_WORLD_ID, PERSONAS, personas } from './personas.js';

process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';
process.env['FIREBASE_AUTH_EMULATOR_HOST'] ??= '127.0.0.1:9099';

let app: ReturnType<typeof initializeApp>;
let db: Firestore;

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-beacon' }, 'personas-spec');
  db = getFirestore(app);
});

afterAll(async () => {
  await deleteApp(app);
});

describe('personas', () => {
  it('gives the emulator a world every persona plays in', async () => {
    await personas();

    const world = await adminWorldRecord(db).read(DEV_WORLD_ID);
    expect(world?.game).toBe('enshrouded');
    for (const persona of PERSONAS.filter((persona) => persona.role !== null)) {
      expect(world?.hasPlayer(persona.uid)).toBe(true);
    }

    await personas(); // idempotent
  });
});
