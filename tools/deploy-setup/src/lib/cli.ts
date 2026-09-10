import { execSync } from 'node:child_process';
import { commandLine } from './command-line.js';

export class CliFailed extends Error {
  constructor(
    readonly line: string,
    readonly output: string,
  ) {
    super(`${line}\n${output}`);
  }
}

/**
 * The one place a child process is spawned. It holds no decision: what to ask,
 * and what to make of the answer, is decided by the pure modules beside it and
 * by the entry points above it.
 */
export interface Cli {
  /** The command's stdout, or `null` when it named something that is not there. */
  read(args: readonly string[]): string | null;
  run(args: readonly string[]): void;
}

/**
 * @param absent how this program says a thing is not there. Every other
 * failure — an expired credential, a refused call, a quota — has to travel:
 * read as absence it would make the tool propose to create what already
 * exists, or to set what it could not read.
 */
function cliFor(program: string, absent: RegExp): Cli {
  const invoke = (
    args: readonly string[],
  ): { line: string; output: string; failed: boolean } => {
    const line = commandLine(program, args);
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
  };

  return {
    read(args) {
      const { line, output, failed } = invoke(args);
      if (!failed) return output;
      if (absent.test(output)) return null;
      throw new CliFailed(line, output);
    },

    run(args) {
      const { line, output, failed } = invoke(args);
      if (failed) throw new CliFailed(line, output);
    },
  };
}

export const gcloud = cliFor(
  'gcloud',
  /NOT_FOUND|not found|does not exist|Listed 0 items/i,
);

/**
 * `Branch not protected` is a 404 like any other here, and it is the ordinary
 * reading on a repository nobody has configured yet — which is exactly the
 * state this tool exists to close.
 */
export const gh = cliFor('gh', /HTTP 404|Not Found|Branch not protected/i);
