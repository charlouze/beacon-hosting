import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { DEFAULT_SETTINGS } from '@beacon/session';
import { sessionFrom, settingsFrom } from './fields.js';

const document = {
  state: 'RUNNING',
  sessionId: 's1',
  game: 'enshrouded',
  startedBy: 'u1',
  startedAt: Timestamp.fromDate(new Date('2026-09-06T20:00:00Z')),
  deadline: Timestamp.fromDate(new Date('2026-09-07T00:00:00Z')),
  instanceSize: 'DEV1-L',
  joinInfo: { game: 'enshrouded', hostname: 'h', address: '1.2.3.4', port: 15637 },
};

describe('sessionFrom', () => {
  it('reads a running session without losing anything the domain uses', () => {
    const session = sessionFrom(document);
    expect(session?.state).toBe('RUNNING');
    expect(session?.sessionId).toBe('s1');
    expect(session?.game).toBe('enshrouded');
    expect(session?.instanceSize).toBe('DEV1-L');
    expect(session?.deadline.at).toEqual(new Date('2026-09-07T00:00:00Z'));
  });

  it('reads the seeded document as no session at all', () => {
    expect(sessionFrom({ state: 'IDLE', sessionId: null })?.state).toBe('IDLE');
  });

  // Null rather than a guess, like `toState` of tranche 1. A document this
  // vocabulary does not recognise must not become a session with invented
  // fields: the caller shows that it cannot read it, and the watchdog — which
  // has its own view and never needed this one — carries on regardless.
  it('refuses to invent a session from a document it cannot read', () => {
    expect(sessionFrom({ state: 'RUNNING', sessionId: 's1' })).toBeNull();
    expect(sessionFrom({ state: 'BANANA' })).toBeNull();
  });

  it('reads the join point as an opinion of the document, never as one of its own', () => {
    expect(sessionFrom(document)?.hasJoinInfo).toBe(true);
    expect(sessionFrom({ ...document, joinInfo: null })?.hasJoinInfo).toBe(false);
  });
});

describe('settingsFrom', () => {
  it('reads what an admin wrote', () => {
    const settings = settingsFrom({
      sessionDurationMs: 7_200_000,
      extensionStepMs: 1_800_000,
      extensionWindowMs: 600_000,
      defaultInstanceSize: 'DEV1-L',
      tariffPerHour: { 'DEV1-L': 0.06 },
    });
    expect(settings.sessionDurationMs).toBe(7_200_000);
    expect(settings.tariffPerHour['DEV1-L']).toBe(0.06);
  });

  // A missing document must not silently become a four-hour session with a
  // made-up price: the defaults are the spec's own values, and the seed writes
  // them, so falling back to them is falling back to what is deployed.
  it('falls back field by field on a document that is missing pieces', () => {
    expect(settingsFrom({ extensionStepMs: 1_800_000 })).toEqual({
      ...DEFAULT_SETTINGS,
      extensionStepMs: 1_800_000,
    });
  });

  it('ignores a tariff that is not a number', () => {
    expect(settingsFrom({ tariffPerHour: { 'DEV1-L': 'free' } }).tariffPerHour).toEqual({});
  });
});
