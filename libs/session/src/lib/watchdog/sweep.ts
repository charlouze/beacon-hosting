import type { ServerRecord, WatchdogLimits } from './view.js';

/**
 * Whether this pass has any reason to ask the provider anything.
 *
 * It reads every world's record and the last sweep, and nothing else — it has
 * to decide *before* the calls it may avoid. Which is why it is deliberately
 * blind to the open intents: reading them here would put them before the
 * inventory, and that order is what stops a machine born between two reads
 * from being destroyed on its first minute.
 *
 * It takes every record and not one: it is enough that a single world is not
 * IDLE, or not IDLE-clean, for the pass to interrogate the provider — a
 * healthy world elsewhere buys no rest for a stuck one.
 *
 * The hole that leaves is IDLE with an intent still open, which takes a hand
 * edit to reach — the function and the watchdog both close an intent in the
 * same breath as they write IDLE. And it is bounded: such a resource is found
 * at the next sweep, within thirty minutes, still inside its first billed hour.
 */
export function mustSweep(
  servers: readonly (ServerRecord | null)[],
  sweptAt: Date | null,
  now: Date,
  limits: WatchdogLimits,
): boolean {
  if (servers.some((server) => needsAttention(server))) return true;
  if (sweptAt === null) return true;
  return now.getTime() - sweptAt.getTime() >= limits.quietSweepIntervalMs;
}

function needsAttention(server: ServerRecord | null): boolean {
  if (server === null) return true;
  if (server.state !== 'IDLE') return true;
  return server.hasReservedFacts;
}
