import type { ServerRecord, WatchdogLimits } from './view.js';

/**
 * Whether this pass has any reason to ask the provider anything.
 *
 * It reads the record and the last sweep, and nothing else — it has to decide
 * *before* the calls it may avoid. Which is why it is deliberately blind to
 * the open intents: reading them here would put them before the inventory, and
 * that order is what stops a machine born between two reads from being
 * destroyed on its first minute.
 *
 * The hole that leaves is IDLE with an intent still open, which takes a hand
 * edit to reach — the function and the watchdog both close an intent in the
 * same breath as they write IDLE. And it is bounded: such a resource is found
 * at the next sweep, within thirty minutes, still inside its first billed hour.
 */
export function mustSweep(
  server: ServerRecord | null,
  sweptAt: Date | null,
  now: Date,
  limits: WatchdogLimits,
): boolean {
  if (server === null) return true;
  if (server.state !== 'IDLE') return true;
  if (server.hasReservedFacts) return true;
  if (sweptAt === null) return true;
  return now.getTime() - sweptAt.getTime() >= limits.quietSweepIntervalMs;
}
