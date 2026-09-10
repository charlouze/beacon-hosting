/**
 * The emulator's project id, fixed by `firebase emulators:start --project`
 * in the `emulators` mise task.
 */
export const EMULATOR_PROJECT = 'demo-beacon';

/** Declared on every function in `apps/functions/src/main.ts`. */
export const FUNCTIONS_REGION = 'europe-west1';

/** The one endpoint a game machine talks to (§7). */
export const AGENT_FUNCTION = 'agentReport';

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
