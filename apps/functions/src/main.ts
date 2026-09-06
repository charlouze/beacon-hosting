import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { sessionFrom } from '@beacon/session-record';
import {
  buildDeps,
  buildProvisionDeps,
  DYNHOST_PASSWORD,
  DYNHOST_USER,
  SCW_SECRET_KEY,
  SERVER_PASSWORD,
} from './container.js';
import { runStateChange } from './provisioning.js';
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

/**
 * The single trigger of the system (§4): `events` is an audit journal and
 * nothing subscribes to it. This wrapper holds nothing — everything it
 * decides is tested next door, without a network.
 */
export const onServerStateChange = onDocumentWritten(
  {
    document: 'server/current',
    region: 'europe-west1',
    secrets: [SCW_SECRET_KEY, SERVER_PASSWORD, DYNHOST_USER, DYNHOST_PASSWORD],
    timeoutSeconds: 540,
    // One at a time. Two deliveries racing is what the transactional claim
    // answers; two *sessions* provisioning at once is not a case this system
    // has — one instance at a time, whatever the number of games (§13).
    concurrency: 1,
    retry: false,
  },
  async (event) => {
    const after = event.data?.after;
    if (after === undefined || !after.exists) return;
    const session = sessionFrom(after.data() ?? {});
    if (session === null) return;
    await runStateChange(buildProvisionDeps(), session);
  },
);
