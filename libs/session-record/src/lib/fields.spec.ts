import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
import { DEFAULT_SETTINGS } from '@beacon/session';
import { displayedFactsFrom, sessionFrom, settingsFrom } from './fields.js';

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

describe('displayedFactsFrom', () => {
  it('renders the three fields the screen shows, and no other', () => {
    const facts = displayedFactsFrom({
      state: 'RUNNING',
      instanceId: 'i-1',
      ipId: 'ip-1',
      provisionClaimedAt: new Date(),
      ip: '51.159.84.12',
      joinInfo: {
        game: 'enshrouded',
        hostname: 'enshrouded.beacon.charlouze.com',
        address: '51.159.84.12',
        port: 15637,
      },
      lastError: null,
    });
    expect(Object.keys(facts).sort()).toEqual(['ip', 'joinInfo', 'lastError']);
    expect(facts.ip).toBe('51.159.84.12');
    expect(facts.joinInfo).toEqual({
      game: 'enshrouded',
      hostname: 'enshrouded.beacon.charlouze.com',
      address: '51.159.84.12',
      port: 15637,
    });
  });

  /**
   * §8: a refused creation cleans up and returns to IDLE with lastError set.
   * That document is the most common failure screen there is, and a view that
   * dropped the field on an idle document would leave the screen unable to say
   * the previous attempt failed.
   */
  it('keeps lastError on an idle document, where it is the whole message', () => {
    const facts = displayedFactsFrom({
      state: 'IDLE',
      lastError: 'no capacity left for this machine size in the zone',
    });
    expect(facts.lastError).toBe('no capacity left for this machine size in the zone');
    expect(facts.joinInfo).toBeNull();
    expect(facts.ip).toBeNull();
  });

  it('says nothing rather than inventing, on a document that carries nothing', () => {
    expect(displayedFactsFrom({ state: 'IDLE' })).toEqual({
      ip: null,
      joinInfo: null,
      lastError: null,
    });
  });

  it('refuses a joinInfo whose game is not one this vocabulary knows', () => {
    expect(
      displayedFactsFrom({ joinInfo: { game: 'minecraft', hostname: 'x' } }).joinInfo,
    ).toBeNull();
  });

  // A shape half written is not a join point. The screen prints every field it
  // is handed, so half of one would be a line telling a player to copy
  // `undefined`.
  it('refuses a shape whose own game has not filled it in', () => {
    expect(displayedFactsFrom({ joinInfo: { game: 'enshrouded', hostname: 'h' } }).joinInfo).toBeNull();
    expect(
      displayedFactsFrom({ joinInfo: { game: 'sunkenland', serverId: 'a~b', region: 'Europe' } })
        .joinInfo,
    ).toBeNull();
  });

  it('refuses a lastError that is not a string, rather than rendering an object', () => {
    expect(displayedFactsFrom({ lastError: { code: 42 } }).lastError).toBeNull();
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
