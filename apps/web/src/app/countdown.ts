import {
  DestroyRef,
  Injectable,
  Signal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CLOCK } from './clock';
import { splitCountdown } from './format';

/**
 * One clock, one interval. The page is entitled to one animation and to one
 * only, and two components each starting their own `setInterval` would give
 * two seconds falling at different instants — invisible on a screen, visible
 * on a capture, and wrong by construction.
 *
 * It is provided in root so that the beat exists once however many countdowns
 * read it, and it stops with the injector that made it.
 */
@Injectable({ providedIn: 'root' })
class Beat {
  private readonly clock = inject(CLOCK);
  readonly now = signal(this.clock.now());

  constructor() {
    const timer = setInterval(() => this.now.set(this.clock.now()), 1_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}

/**
 * What is left before an instant, refreshed every second. Null when there is
 * no deadline — which is every state but the one that has a session running.
 *
 * The deadline arrives as a signal because it moves: extending is exactly
 * that, and a countdown that had to be rebuilt to follow it would lose the
 * second it was on.
 */
export function countdownTo(
  deadline: Signal<Date | null>,
): Signal<{ hoursMinutes: string; seconds: string } | null> {
  const beat = inject(Beat);
  return computed(() => {
    const at = deadline();
    if (at === null) return null;
    return splitCountdown(at.getTime() - beat.now().getTime());
  });
}

/**
 * The same beat read by a list rather than by one band. A screen showing
 * several worlds has as many seconds falling as it has worlds in service, and
 * how many is only known once the list arrives — too late for a call to
 * `countdownTo`, which has to reach the injector. One call, one array, and the
 * seconds still fall together.
 */
export function countdownsTo(
  deadlines: Signal<readonly (Date | null)[]>,
): Signal<readonly ({ hoursMinutes: string; seconds: string } | null)[]> {
  const beat = inject(Beat);
  return computed(() => {
    const now = beat.now().getTime();
    return deadlines().map((at) => (at === null ? null : splitCountdown(at.getTime() - now)));
  });
}
