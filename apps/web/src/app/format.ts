/**
 * How the screen renders what it is given. Pure functions, no Angular, and no
 * reading of `Date.now()`: each one is handed the instant it needs, which is
 * what lets every test of this screen run on an injected clock rather than on
 * the wall clock.
 */

/**
 * How long a machine takes to answer, measured and not guessed: 4 min 49 s
 * then 7 min 58 s on the same size in the same zone, an hour apart
 * (`probe/RESULTS.md`, §S). Its own conclusion is written as a constraint —
 * a single announced hour would be three minutes wrong one time in two, and an
 * hour contradicted releases nobody.
 *
 * It lives here and not in `config/settings` on purpose: an admin who could
 * change it would be editing a measurement. The day real evenings narrow the
 * window, this line is the one that moves — and two sessions are not enough to
 * narrow it.
 */
export const BOOT_WINDOW_MS: readonly [number, number] = [300_000, 480_000];

const pad = (value: number): string => String(value).padStart(2, '0');

/**
 * Two pieces and not one string: only the seconds are red, and a component
 * that had to slice text apart to colour it would be doing typography with
 * `substring`.
 */
export function splitCountdown(remainingMs: number): {
  hoursMinutes: string;
  seconds: string;
} {
  // Zero and never a negative: a deadline that has passed has no evening left
  // to count, and a countdown that walks past zero says the opposite.
  const total = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  // The hours are not padded: this is a duration, not a clock face.
  return { hoursMinutes: `${hours}:${pad(minutes)}`, seconds: `:${pad(total % 60)}` };
}

/** `HH:MM`, in the reader's own zone — a departure hour is read where it is read. */
export function hourLabel(instant: Date): string {
  return `${pad(instant.getHours())}:${pad(instant.getMinutes())}`;
}

/** Two decimals always: €0.1 is not a price, and money that ragged stops lining up. */
export function euroLabel(euros: number): string {
  return `€${euros.toFixed(2)}`;
}

/** The two hours between which the server should answer, opened from `stateSince`. */
export function readyWindow(stateSince: Date): { from: string; to: string } {
  const [earliest, latest] = BOOT_WINDOW_MS;
  return {
    from: hourLabel(new Date(stateSince.getTime() + earliest)),
    to: hourLabel(new Date(stateSince.getTime() + latest)),
  };
}
