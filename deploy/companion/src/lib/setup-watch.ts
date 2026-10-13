import { readFileSync } from 'node:fs';
import {
  declaredByMarkers,
  parseAgentSetup,
  REPORT_INTERVAL_MS,
  SETUP_REPORT_INTERVAL_MS,
  type AgentSetup,
} from '@beacon/agent-protocol';
import type { SetupDeclaration } from '@beacon/session';
import type { Reporter } from './reporter.js';

export interface LoadAgentSetupDeps {
  readonly report: Reporter['send'];
  readonly log: (message: string) => void;
}

/**
 * The markers the cloud-init wrote, read once at launch. A file this cannot
 * read is a catalogue entry to fix: the failure is declared, best effort, and
 * the agent gives up rather than follow a setup it knows nothing of.
 */
export async function loadAgentSetup(path: string, deps: LoadAgentSetupDeps): Promise<AgentSetup> {
  let setup: AgentSetup | null = null;
  try {
    setup = parseAgentSetup(readFileSync(path, 'utf8'));
  } catch {
    // Absent or unreadable: the same refusal as a file that says nothing.
  }
  if (setup !== null) return setup;

  // The path and never the content: this detail travels.
  const detail = `the setup markers at ${path} could not be read`;
  try {
    await deps.report({ phase: 'failed', detail });
  } catch (error) {
    deps.log(`could not report the failure: ${String(error)}`);
  }
  throw new Error(detail);
}

export interface SetupWatch {
  /**
   * What the game's output says of the setup, read anew on every call. The
   * start step until a line answers a marker; then whatever the last such line
   * decided, kept even once that line is out of what is read.
   */
  declared(): SetupDeclaration;
  /**
   * How long a turn waits while this setup is followed. A game with no marker
   * has nothing new to say between two minutes.
   */
  readonly intervalMs: number;
}

export function setupWatch(setup: AgentSetup, readTail: () => string): SetupWatch {
  let decided: SetupDeclaration = { step: setup.startStep };
  return {
    declared(): SetupDeclaration {
      decided = declaredByMarkers(setup, readTail()) ?? decided;
      return decided;
    },
    intervalMs: setup.markers.length > 0 ? SETUP_REPORT_INTERVAL_MS : REPORT_INTERVAL_MS,
  };
}
