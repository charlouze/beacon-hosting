import type { Clock } from './ports.js';
import type { SessionSettings } from './settings.js';

/**
 * The instant a session closes. Immutable: extending returns another one.
 *
 * It carries the reading of time and not the writing of it — which is what
 * lets §4's clamp be applied on read as well as on write. A mutable deadline
 * would make "the value shown is already the one the watchdog converges to"
 * a promise instead of a property.
 */
export class Deadline {
  private constructor(private readonly instant: Date) {}

  static at(instant: Date): Deadline {
    // Copied, because a Date is mutable and the caller keeps a reference to
    // the one it passed in. A value object that a caller can move is not one.
    return new Deadline(new Date(instant.getTime()));
  }

  static opening(clock: Clock, settings: SessionSettings): Deadline {
    return Deadline.at(new Date(clock.now().getTime() + settings.sessionDurationMs));
  }

  get at(): Date {
    return new Date(this.instant.getTime());
  }

  isWithinExtensionWindow(clock: Clock, settings: SessionSettings): boolean {
    const remaining = this.instant.getTime() - clock.now().getTime();
    // Strictly positive: once the deadline is behind us there is no evening
    // left to extend, only a shutdown to watch.
    return remaining > 0 && remaining <= settings.extensionWindowMs;
  }

  extended(settings: SessionSettings): Deadline {
    return Deadline.at(new Date(this.instant.getTime() + settings.extensionStepMs));
  }

  clampedTo(clock: Clock, settings: SessionSettings): Deadline {
    const bound = clock.now().getTime() + settings.sessionDurationMs;
    return this.instant.getTime() <= bound ? this : Deadline.at(new Date(bound));
  }

  isPastBy(clock: Clock, graceMs: number): boolean {
    return clock.now().getTime() - this.instant.getTime() > graceMs;
  }

  equals(other: Deadline): boolean {
    return this.instant.getTime() === other.instant.getTime();
  }
}
