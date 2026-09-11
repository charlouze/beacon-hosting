import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, forecastCost } from './settings.js';

describe('forecastCost', () => {
  /**
   * §11: the started hour is due, and a rate already sums instance, disk and
   * ip. A full session at the default size, and nothing else — this is a quote,
   * not a spend.
   */
  it('quotes a full session at the default size', () => {
    expect(forecastCost(DEFAULT_SETTINGS)).toBeCloseTo(0.22, 2);
  });

  it('bills the started hour, so a half-hour session still quotes one', () => {
    // 0.05454 and not 0.05: asserted to four places, because two would pass on
    // a rate that had been halved.
    expect(forecastCost({ ...DEFAULT_SETTINGS, sessionDurationMs: 30 * 60_000 })).toBeCloseTo(
      0.0545,
      4,
    );
  });

  /** Same refusal as estimatedCost: an unknown size quotes zero rather than guessing. */
  it('quotes zero for a size no tariff names', () => {
    expect(forecastCost({ ...DEFAULT_SETTINGS, tariffPerHour: {} })).toBe(0);
  });

  it('follows the deployed document, never a rate compiled into a bundle', () => {
    expect(forecastCost({ ...DEFAULT_SETTINGS, tariffPerHour: { 'DEV1-L': 1 } })).toBe(4);
  });
});
