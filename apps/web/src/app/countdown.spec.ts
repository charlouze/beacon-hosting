import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CLOCK } from './clock';
import { countdownTo } from './countdown';

describe('countdownTo', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** Injected, never wall-clock: a test that reads the real time is a test that fails at midnight. */
  const clockAt = (iso: string) => {
    let now = new Date(iso);
    const clock = {
      now: () => now,
      advance: (ms: number) => {
        now = new Date(now.getTime() + ms);
        vi.advanceTimersByTime(ms);
      },
    };
    TestBed.configureTestingModule({ providers: [{ provide: CLOCK, useValue: clock }] });
    return clock;
  };

  it('reads the remaining time the instant it is created', () => {
    clockAt('2026-09-12T20:00:00');
    const deadline = signal(new Date('2026-09-12T22:47:12'));
    TestBed.runInInjectionContext(() => {
      expect(countdownTo(deadline)()).toEqual({ hoursMinutes: '2:47', seconds: ':12' });
    });
  });

  it('falls one second at a time, which is the page’s only motion', () => {
    const clock = clockAt('2026-09-12T20:00:00');
    const deadline = signal(new Date('2026-09-12T20:00:10'));
    TestBed.runInInjectionContext(() => {
      const countdown = countdownTo(deadline);
      expect(countdown()).toEqual({ hoursMinutes: '0:00', seconds: ':10' });
      clock.advance(1_000);
      expect(countdown()).toEqual({ hoursMinutes: '0:00', seconds: ':09' });
      clock.advance(4_000);
      expect(countdown()).toEqual({ hoursMinutes: '0:00', seconds: ':05' });
    });
  });

  it('stops at zero rather than counting into the negative', () => {
    const clock = clockAt('2026-09-12T20:00:00');
    const deadline = signal(new Date('2026-09-12T20:00:02'));
    TestBed.runInInjectionContext(() => {
      const countdown = countdownTo(deadline);
      clock.advance(10_000);
      expect(countdown()).toEqual({ hoursMinutes: '0:00', seconds: ':00' });
    });
  });

  it('says nothing when there is no deadline to count to', () => {
    clockAt('2026-09-12T20:00:00');
    TestBed.runInInjectionContext(() => {
      expect(countdownTo(signal(null))()).toBeNull();
    });
  });

  it('follows a deadline that moves, which is what an extension does', () => {
    clockAt('2026-09-12T20:00:00');
    const deadline = signal(new Date('2026-09-12T20:30:00'));
    TestBed.runInInjectionContext(() => {
      const countdown = countdownTo(deadline);
      expect(countdown()?.hoursMinutes).toBe('0:30');
      deadline.set(new Date('2026-09-12T21:30:00'));
      expect(countdown()?.hoursMinutes).toBe('1:30');
    });
  });

  it('leaves no timer behind when its injector is destroyed', () => {
    clockAt('2026-09-12T20:00:00');
    TestBed.runInInjectionContext(() => {
      countdownTo(signal(new Date('2026-09-12T21:00:00')));
    });
    TestBed.resetTestingModule();
    expect(vi.getTimerCount()).toBe(0);
  });
});
