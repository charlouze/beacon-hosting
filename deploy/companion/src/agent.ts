import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { REPORT_INTERVAL_MS } from '@beacon/agent-protocol';
import { a2sInfo, probeFor } from './lib/a2s.js';
import { runAgentLoop } from './lib/agent-loop.js';
import { readConfig } from './lib/config.js';
import { buildSaveStore } from './lib/container.js';
import { pushSave, stopAndPush, type PushDeps } from './lib/push.js';
import { httpReporter } from './lib/reporter.js';

const config = readConfig(process.env);
const probe = probeFor(config.readyProbe);
const log = (message: string) => console.log(`beacon: ${message}`);

/** Half the report interval: a probe must never be what makes a report late. */
const PROBE_TIMEOUT_MS = Math.floor(REPORT_INTERVAL_MS / 2);

const probeReady = () => a2sInfo(probe.host, probe.port, PROBE_TIMEOUT_MS);

const pushDeps: PushDeps = {
  store: buildSaveStore(config),
  report: httpReporter(config).send,
  probeReady,
  touch: (path: string) => writeFile(path, ''),
  sleep: (ms: number) => delay(ms),
  log,
  clock: { now: () => new Date() },
  config,
  // Twice the compose's stop_grace_period, so a server using all ninety seconds
  // of its own shutdown is not archived while it is still writing.
  shutdownGraceMs: 180_000,
};

await runAgentLoop({
  probeReady,
  report: httpReporter(config).send,
  onStopping: () => stopAndPush(pushDeps),
  onPushDue: () => pushSave(pushDeps, 'auto'),
  sleep: (ms: number) => delay(ms),
  log,
  clock: { now: () => new Date() },
  reportIntervalMs: REPORT_INTERVAL_MS,
  pushIntervalMs: config.pushIntervalMs,
});
