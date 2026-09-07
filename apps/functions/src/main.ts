import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { parseReport } from '@beacon/agent-protocol';
import { sessionFrom } from '@beacon/session-record';
import {
  buildAgentReportDeps,
  buildDeps,
  buildProvisionDeps,
  DYNHOST_PASSWORD,
  DYNHOST_USER,
  S3_SECRET_KEY,
  SCW_SECRET_KEY,
  SERVER_PASSWORD,
} from './container.js';
import { runAgentReport } from './agent-report.js';
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
    secrets: [SCW_SECRET_KEY, SERVER_PASSWORD, S3_SECRET_KEY],
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
    const acted = await runStateChange(buildProvisionDeps(), session);
    // In addition to the schedule, never instead of it. The five-minute pass
    // catches what nothing announces — a resource no session explains — and
    // that is worth exactly as much as the fact that nobody has to trigger it.
    // This one only shortens the wait for what we just did: a failed boot gets
    // reclaimed now instead of in five minutes, and a FAILED is retried at once.
    if (acted) await runWatchdog(buildDeps());
  },
);

/**
 * The one endpoint a game machine talks to (§7). It is public because the
 * caller has no Google identity and never will — what authorises it is the
 * session token, and nothing else. This wrapper holds no decision: everything
 * it does is tested next door, without a network.
 *
 * Called roughly once a minute by every live session's companion, and one of
 * the calls it can trigger, on a `saved` report with origin `pre-shutdown`
 * while STOPPING, is the instance's destruction (§6 étape 3) — moved here from
 * `onServerStateChange` so the machine gets a chance to push its final save
 * before it is gone.
 */
export const agentReport = onRequest(
  {
    region: 'europe-west1',
    // SCW_SECRET_KEY joined this list with task 9 bis: agentReport now builds
    // a ServerHost to destroy on a `saved` report while STOPPING (§6 étape 3),
    // which the state-change trigger used to do alone.
    secrets: [DYNHOST_USER, DYNHOST_PASSWORD, SCW_SECRET_KEY],
    // Without this, gen2 requires a Google identity on every call and the
    // machine — which holds none, by §7 — would get 403 forever.
    invoker: 'public',
    timeoutSeconds: 60,
    // Bounds concurrent instances, not the request rate a flood can still
    // send — each one answers in milliseconds and costs nothing near what a
    // stuck instance would. The cap is what stops a runaway from scaling
    // Functions themselves into a bill; it is not a rate limit.
    maxInstances: 4,
    cors: false,
  },
  async (request, response) => {
    if (request.method !== 'POST') {
      response.status(405).send();
      return;
    }

    const header = request.get('authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    const report = parseReport(request.body);
    if (token === null || report === null) {
      response.status(400).send();
      return;
    }

    const instructions = await runAgentReport(buildAgentReportDeps(), token, report);
    if (instructions === null) {
      // No body, and no reason. A 401 that explained itself would tell whoever
      // is probing which half of the credential they got right.
      response.status(401).send();
      return;
    }
    response.json(instructions);
  },
);
