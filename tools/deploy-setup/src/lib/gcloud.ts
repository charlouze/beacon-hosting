import { execSync } from 'node:child_process';
import { commandLine } from './command-line.js';

/**
 * How gcloud says a thing is not there. Every other failure — an expired
 * credential, a project that refuses the call, a quota — has to travel, because
 * read as absence it would make this tool propose to create what already
 * exists.
 */
const ABSENT = /NOT_FOUND|not found|does not exist|Listed 0 items/i;

export class GcloudFailed extends Error {
  constructor(
    readonly line: string,
    readonly output: string,
  ) {
    super(`${line}\n${output}`);
  }
}

/**
 * The one place a child process is spawned. It holds no decision: what to ask
 * gcloud, and what to make of the answer, is decided by the pure modules
 * beside it and by the entry point above it.
 */
export interface Gcloud {
  /** The command's stdout, or `null` when it named something that is not there. */
  read(args: readonly string[]): string | null;
  run(args: readonly string[]): void;
}

function invoke(args: readonly string[]): {
  line: string;
  output: string;
  failed: boolean;
} {
  const line = commandLine('gcloud', args);
  try {
    return {
      line,
      output: execSync(line, { encoding: 'utf8', stdio: 'pipe' }),
      failed: false,
    };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string };
    return {
      line,
      output: `${failure.stdout ?? ''}${failure.stderr ?? ''}`,
      failed: true,
    };
  }
}

export const gcloud: Gcloud = {
  read(args) {
    const { line, output, failed } = invoke(args);
    if (!failed) return output;
    if (ABSENT.test(output)) return null;
    throw new GcloudFailed(line, output);
  },

  run(args) {
    const { line, output, failed } = invoke(args);
    if (failed) throw new GcloudFailed(line, output);
  },
};
