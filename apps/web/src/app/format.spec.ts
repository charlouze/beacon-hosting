import { BOOT_WINDOW_MS, euroLabel, hourLabel, readyWindow, splitCountdown } from './format';

describe('splitCountdown', () => {
  it('separates the falling second, because it is the only thing that is red', () => {
    expect(splitCountdown(2 * 3_600_000 + 47 * 60_000 + 12_000)).toEqual({
      hoursMinutes: '2:47',
      seconds: ':12',
    });
  });

  it('pads minutes and seconds, so the digits never shift under a tabular font', () => {
    expect(splitCountdown(9 * 60_000 + 5_000)).toEqual({ hoursMinutes: '0:09', seconds: ':05' });
  });

  it('never walks past zero: an elapsed deadline reads zero, not a negative', () => {
    expect(splitCountdown(-5_000)).toEqual({ hoursMinutes: '0:00', seconds: ':00' });
  });

  it('leaves the hours unpadded past ten, this being a duration and not a clock', () => {
    expect(splitCountdown(12 * 3_600_000 + 60_000)).toEqual({
      hoursMinutes: '12:01',
      seconds: ':00',
    });
  });
});

describe('hourLabel', () => {
  it('reads as a departure hour, zero-padded on both halves', () => {
    expect(hourLabel(new Date('2026-09-12T00:30:00'))).toBe('00:30');
    expect(hourLabel(new Date('2026-09-12T20:14:59'))).toBe('20:14');
  });
});

describe('euroLabel', () => {
  it('always shows two decimals: 0.1 euro is not "€0.1"', () => {
    expect(euroLabel(0.13)).toBe('€0.13');
    expect(euroLabel(0.1)).toBe('€0.10');
    expect(euroLabel(0)).toBe('€0.00');
  });
});

describe('readyWindow', () => {
  /**
   * Measured, not guessed: 4 min 49 s then 7 min 58 s on the same size in the
   * same zone, an hour apart (probe/RESULTS.md, §S). A single announced hour
   * would be three minutes wrong one time in two.
   */
  it('announces a window, opened from the instant the state began', () => {
    expect(readyWindow(new Date('2026-09-12T20:14:00'))).toEqual({
      from: '20:19',
      to: '20:22',
    });
  });

  it('derives from the instant it is given, never from now', () => {
    expect(readyWindow(new Date('2026-09-12T23:58:00'))).toEqual({
      from: '00:03',
      to: '00:06',
    });
  });

  it('holds the measured bounds, and says where they come from', () => {
    expect(BOOT_WINDOW_MS).toEqual([300_000, 480_000]);
  });
});
