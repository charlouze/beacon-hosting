import { SETUP_REPORT_INTERVAL_MS } from '@beacon/agent-protocol';
import type { Clock, SetupDeclaration } from '@beacon/session';
import type { Reporter } from './reporter.js';

/** How long a setup declaration waits for its answer before the machine moves on. */
export const SETUP_REPORT_TIMEOUT_MS = 5_000;

export interface SetupDeclarerDeps {
  readonly report: Reporter['send'];
  readonly log: (message: string) => void;
  readonly clock: Clock;
}

export interface SetupDeclarer {
  /** Sent once the previous declaration was answered. Never rejects. */
  declare(setup: SetupDeclaration): Promise<void>;
  /**
   * Sent only if no declaration waits for its answer and the last one began at
   * least one setup interval ago. For what moves faster than it is worth
   * telling — the bytes of a download.
   */
  declareIfDue(setup: SetupDeclaration): void;
}

/**
 * What the restore says of the setup while it runs. A declaration is only ever
 * displayed, so one that fails or takes too long is written in the log and
 * stops nothing.
 */
export function setupDeclarer(deps: SetupDeclarerDeps): SetupDeclarer {
  let answered: Promise<void> = Promise.resolve();
  let waiting = 0;
  let lastBeganAt = Number.NEGATIVE_INFINITY;

  const send = async (setup: SetupDeclaration): Promise<void> => {
    try {
      await deps.report({ phase: 'alive', setup }, { timeoutMs: SETUP_REPORT_TIMEOUT_MS });
    } catch (error) {
      deps.log(`could not declare ${setup.step}: ${String(error)}`);
    }
  };

  const declare = (setup: SetupDeclaration): Promise<void> => {
    waiting += 1;
    lastBeganAt = deps.clock.now().getTime();
    answered = answered
      .then(() => send(setup))
      .finally(() => {
        waiting -= 1;
      });
    return answered;
  };

  return {
    declare,
    declareIfDue(setup: SetupDeclaration): void {
      if (waiting > 0) return;
      if (deps.clock.now().getTime() - lastBeganAt < SETUP_REPORT_INTERVAL_MS) return;
      void declare(setup);
    },
  };
}
