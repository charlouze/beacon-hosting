import { describe, expect, it } from 'vitest';
import { mustSweep } from './sweep.js';
import { DEFAULT_LIMITS } from './view.js';

const NOW = new Date('2026-09-06T20:00:00Z');
const quiet = { state: 'IDLE' as const, sessionId: null, stateSince: null, hasReservedFacts: false };
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

describe('mustSweep', () => {
  it('sweeps while anything is not idle', () => {
    expect(mustSweep({ ...quiet, state: 'RUNNING' }, ago(1), NOW, DEFAULT_LIMITS)).toBe(true);
  });

  // IDLE while a reserved field still holds something is the record disagreeing
  // with itself — exactly what the reconciliation is for, so it must look.
  it('sweeps while a reserved field still holds something', () => {
    expect(mustSweep({ ...quiet, hasReservedFacts: true }, ago(1), NOW, DEFAULT_LIMITS)).toBe(
      true,
    );
  });

  // A document that does not exist is not a quiet system, it is an unseeded or
  // damaged one. Deciding to look at nothing because we can read nothing is
  // the mistake this line exists to refuse.
  it('sweeps when there is no record at all', () => {
    expect(mustSweep(null, ago(1), NOW, DEFAULT_LIMITS)).toBe(true);
  });

  it('sweeps when nothing has ever swept', () => {
    expect(mustSweep(quiet, null, NOW, DEFAULT_LIMITS)).toBe(true);
  });

  it('does not sweep on a quiet pass that follows a recent one', () => {
    expect(mustSweep(quiet, ago(5), NOW, DEFAULT_LIMITS)).toBe(false);
  });

  // §11: the started hour is due on each resource separately, so a stray
  // reclaimed at thirty minutes costs exactly what it would at five. Thirty is
  // also the ceiling: at sixty, one missed pass buys a second billed hour.
  it('sweeps again once the quiet interval has passed', () => {
    expect(mustSweep(quiet, ago(30), NOW, DEFAULT_LIMITS)).toBe(true);
  });
});
