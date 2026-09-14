import { InjectionToken } from '@angular/core';
import type { Clock } from '@beacon/session';

/**
 * What time it is, as a provider and not as a parameter. Passed in, the clock
 * would appear in five signatures to serve nothing but the tests — and a knob
 * offered to callers is a decision one has refused to take.
 *
 * The factory returns the real clock, so production provides nothing and a
 * test replaces a single provider. It is already the shape
 * `FIREBASE_CONNECTION` has in this application.
 */
export const CLOCK = new InjectionToken<Clock>('beacon.clock', {
  factory: (): Clock => ({ now: () => new Date() }),
});

export type { Clock };
