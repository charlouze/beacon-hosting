/**
 * The remote that can *write* the games bucket. Its neighbour `scw-machine`
 * carries the VM's key, which only ever reads it (§7): taking the wrong entry
 * fails at the end of a multi-gigabyte upload rather than before it starts.
 */
export const ADMIN_REMOTE = 'scw-admin';

export interface AdminCredentials {
  readonly endpoint: string;
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

/** The four fields of an rclone s3 remote this tool needs, spelled as rclone spells them. */
const REQUIRED_FIELDS = ['endpoint', 'region', 'access_key_id', 'secret_access_key'] as const;

/**
 * rclone stores the endpoint as it was typed, and its s3 backend reads a bare
 * host as https. The aws sdk refuses one — `TypeError: Invalid URL` — and it
 * refuses it at the deposit, once the multi-gigabyte archive is already built.
 * So a bare host is completed the way rclone itself would read it, and anything
 * already carrying a scheme is left alone: `http://` is how a local MinIO is
 * reached, and upgrading it would aim the deposit at a port that answers
 * nothing.
 */
function absoluteEndpoint(endpoint: string): string {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(endpoint) ? endpoint : `https://${endpoint}`;
}

/**
 * Reads the administrator key out of `rclone config dump`, so that an operator
 * has no credential to export by hand before a deposit — and therefore none to
 * paste into a terminal, a note, or a chat.
 *
 * Every refusal names a remote or a field, never a value: what is missing is
 * all the operator needs, and printing the rest is the leak this whole flow is
 * built to avoid.
 */
export function adminCredentialsFrom(configDump: string, remote: string): AdminCredentials {
  const remotes: unknown = JSON.parse(configDump);
  const entry = (remotes as Record<string, Record<string, string> | undefined>)[remote];
  if (entry === undefined) {
    throw new Error(`no rclone remote named ${remote}: that is where the administrator key lives`);
  }

  for (const field of REQUIRED_FIELDS) {
    if (!entry[field]) throw new Error(`the ${remote} remote has no ${field}`);
  }

  return {
    endpoint: absoluteEndpoint(entry['endpoint']),
    region: entry['region'],
    accessKeyId: entry['access_key_id'],
    secretAccessKey: entry['secret_access_key'],
  };
}

/**
 * The one line printed about the key on every run. Where it came from is worth
 * saying — an operator with two remotes wants to know which one signed — and
 * nothing of the key itself is, which is why this is a function and not a
 * template written at the call site.
 */
export function describeRemote(remote: string, credentials: AdminCredentials): string {
  return `admin key loaded from ${remote} — ${credentials.endpoint}, region ${credentials.region}`;
}
