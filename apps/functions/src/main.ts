import { onSchedule } from 'firebase-functions/v2/scheduler';
import { buildDeps, SCW_SECRET_KEY } from './container.js';
import { runWatchdog } from './watchdog.js';

/**
 * §6: the most important component of the system for the budget. Everything
 * it decides is tested elsewhere, without a network; this wrapper exists to
 * hold nothing.
 */
export const watchdog = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'Etc/UTC',
    region: 'europe-west1',
    secrets: [SCW_SECRET_KEY],
    timeoutSeconds: 300,
    // No retry: the next pass is five minutes away and idempotent. A retry
    // storm on a provider outage would only multiply the calls.
    retryCount: 0,
  },
  async () => {
    await runWatchdog(buildDeps());
  },
);
