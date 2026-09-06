import { describe, expect, it } from 'vitest';
import { Deadline } from './deadline.js';
import { DEFAULT_SETTINGS } from './settings.js';

const at = (iso: string) => ({ now: () => new Date(iso) });
const S = DEFAULT_SETTINGS;

describe('Deadline', () => {
  it('opens one session duration ahead of now', () => {
    expect(Deadline.opening(at('2026-09-06T20:00:00Z'), S).at).toEqual(
      new Date('2026-09-07T00:00:00Z'),
    );
  });

  it('closes the extension window while more than its width remains', () => {
    const deadline = Deadline.at(new Date('2026-09-07T00:00:00Z'));
    expect(deadline.isWithinExtensionWindow(at('2026-09-06T23:29:59Z'), S)).toBe(false);
  });

  it('opens the extension window on the exact minute it becomes true', () => {
    const deadline = Deadline.at(new Date('2026-09-07T00:00:00Z'));
    expect(deadline.isWithinExtensionWindow(at('2026-09-06T23:30:00Z'), S)).toBe(true);
  });

  // The button is dead once the deadline is behind us: what follows is a
  // shutdown, not an evening someone can still save.
  it('closes the window again once the deadline is past', () => {
    const deadline = Deadline.at(new Date('2026-09-07T00:00:00Z'));
    expect(deadline.isWithinExtensionWindow(at('2026-09-07T00:00:01Z'), S)).toBe(false);
  });

  // From the deadline, never from now. Extending at 23:45 for a midnight
  // closing has to buy an hour of play, not fifteen minutes of it.
  it('pushes one step past the deadline, not past now', () => {
    const deadline = Deadline.at(new Date('2026-09-07T00:00:00Z'));
    expect(deadline.extended(S).at).toEqual(new Date('2026-09-07T01:00:00Z'));
  });

  it('leaves an honest deadline alone when clamping', () => {
    const deadline = Deadline.at(new Date('2026-09-06T23:00:00Z'));
    expect(deadline.clampedTo(at('2026-09-06T20:00:00Z'), S).at).toEqual(
      new Date('2026-09-06T23:00:00Z'),
    );
  });

  // §6: a forged deadline is brought back to the bound. §4: the same bound is
  // applied on read, so the countdown never walks backwards on screen.
  it('brings a forged deadline back to one session duration ahead', () => {
    const forged = Deadline.at(new Date('2026-09-07T08:00:00Z'));
    expect(forged.clampedTo(at('2026-09-06T20:00:00Z'), S).at).toEqual(
      new Date('2026-09-07T00:00:00Z'),
    );
  });

  it('answers whether it is past by more than a grace period', () => {
    const deadline = Deadline.at(new Date('2026-09-07T00:00:00Z'));
    expect(deadline.isPastBy(at('2026-09-07T00:01:59Z'), 2 * 60_000)).toBe(false);
    expect(deadline.isPastBy(at('2026-09-07T00:02:01Z'), 2 * 60_000)).toBe(true);
  });

  it('is a value: two deadlines on the same instant are equal', () => {
    const instant = new Date('2026-09-07T00:00:00Z');
    expect(Deadline.at(instant).equals(Deadline.at(new Date(instant)))).toBe(true);
  });

  it('reads its hour for an audit line, UTC and zero-padded', () => {
    expect(Deadline.at(new Date('2026-09-06T09:05:00Z')).auditHour()).toBe('09:05 UTC');
  });

  // Exactly midnight has to read 00:00, not 24:00 — toISOString never
  // produces the latter, but a hand-rolled formatter could.
  it('reads midnight as 00:00 UTC, not 24:00', () => {
    expect(Deadline.at(new Date('2026-09-07T00:00:00Z')).auditHour()).toBe('00:00 UTC');
  });
});
