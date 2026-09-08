/**
 * The emulator's project id, fixed by `firebase emulators:start --project`
 * in the `emulators` mise task.
 */
export const EMULATOR_PROJECT = 'demo-beacon';

/** Declared on every function in `apps/functions/src/main.ts`. */
export const FUNCTIONS_REGION = 'europe-west1';

/** The one endpoint a game machine talks to (§7). */
export const AGENT_FUNCTION = 'agentReport';

const KEY = 'AGENT_ENDPOINT';

/**
 * All three names above are duplicated from files this project cannot import,
 * which is the shape of drift. What makes it survivable is that the 401 probe
 * calls this very url at every run: a wrong project, region or function name
 * answers 404 and the command refuses — before a machine is billed.
 */
export function agentEndpointFor(tunnelUrl: string): string {
  const host = tunnelUrl.replace(/\/+$/, '');
  return `${host}/${EMULATOR_PROJECT}/${FUNCTIONS_REGION}/${AGENT_FUNCTION}`;
}

export interface EnvRewrite {
  /** The whole file, one line changed. Never printed, never logged. */
  readonly text: string;
  /** How many `KEY=` lines the file holds, so the operator hears what was spared. */
  readonly assignments: number;
}

/**
 * Twelve of the thirteen values in `apps/functions/.env` are none of this
 * command's business, and five of them are credentials. So this replaces one
 * line by regex rather than parsing and re-emitting the file: bytes that are
 * not the endpoint are never rebuilt, and CRLF endings survive.
 *
 * Nothing here — return value, error message, or stack — carries a value read
 * out of that file.
 */
export function withAgentEndpoint(envText: string, endpoint: string): EnvRewrite {
  const assignment = new RegExp(`^${KEY}=[^\\r\\n]*`, 'gm');
  const found = envText.match(assignment)?.length ?? 0;

  if (found === 0) {
    throw new Error(
      `apps/functions/.env holds no ${KEY}= line. ` +
        `That is not the file this expects — apps/functions/.env.example says which keys belong in it.`,
    );
  }
  if (found > 1) {
    throw new Error(`apps/functions/.env declares ${KEY} twice, and nothing here will guess which one is read`);
  }

  return {
    text: envText.replace(assignment, `${KEY}=${endpoint}`),
    assignments: envText.match(/^[A-Z_][A-Z0-9_]*=/gm)?.length ?? 0,
  };
}
