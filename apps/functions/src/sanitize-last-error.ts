const MAX_LAST_ERROR_LENGTH = 500;

/**
 * What a member reads is bounded and redacted: `server/current.lastError` and
 * every event detail reach every member's browser, and the failure they
 * summarise can carry a cloud-init in its text — nothing proves the provider's
 * SDK keeps the agent token or the S3 secret key out of an error message.
 *
 * Two limits, honestly stated rather than hidden by the name: the guarantee
 * is length-based, not credential-based — nothing here knows what a secret
 * looks like, only how long one usually is, so a short human-chosen password
 * would pass through untouched. And the pattern collapses anything that
 * long on sight, credential or not — a UUID, an object key — which is
 * exactly why the full text goes to the platform journal (`expunged`, in
 * platform-journal.ts): what a member reads is not a place to understand
 * what actually failed.
 */
export function sanitizeLastError(detail: string): string {
  const scrubbed = detail.replace(/[A-Za-z0-9+/_=-]{20,}/g, '[redacted]');
  return scrubbed.length > MAX_LAST_ERROR_LENGTH
    ? `${scrubbed.slice(0, MAX_LAST_ERROR_LENGTH)}…`
    : scrubbed;
}
