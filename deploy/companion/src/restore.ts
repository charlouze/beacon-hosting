import { takeOwnership } from './lib/archive.js';
import { readConfig } from './lib/config.js';
import { buildGameFiles, buildSaveStore } from './lib/container.js';
import { httpReporter } from './lib/reporter.js';
import { runRestore } from './lib/restore.js';

/**
 * The one-shot service. The game container waits on it with
 * `condition: service_completed_successfully`, so a non-zero exit here is what
 * keeps a player out of a world that is not theirs (§6, étape 7).
 */
try {
  const config = readConfig(process.env);
  await runRestore({
    store: buildSaveStore(config),
    gameFiles: buildGameFiles(config),
    report: httpReporter(config).send,
    takeOwnership,
    log: (message: string) => console.log(`beacon: ${message}`),
    config,
    clock: { now: () => new Date() },
  });
} catch (error) {
  console.error(`beacon: ${String(error)}`);
  process.exitCode = 1;
}
