const MAX_LAST_ERROR_LENGTH = 500;

/**
 * §5: « ce qui atteint un champ lisible est borné et expurgé ».
 * `server/current.lastError` is read by every member's browser, live, and the
 * failure it summarises can carry a cloud-init in its text — nothing proves
 * the provider's SDK keeps the agent token or the S3 secret key out of an
 * error message. This is the one gate between an internal failure and a
 * client-readable field; `events/{id}.detail` keeps the full, un-sanitised
 * text, for the platform log only members with production access ever read.
 *
 * Two limits, honestly stated rather than hidden by the name: the guarantee
 * is length-based, not credential-based — nothing here knows what a secret
 * looks like, only how long one usually is, so a short human-chosen password
 * would pass through untouched. And the pattern collapses anything that
 * long on sight, credential or not — a UUID, an object key — which is
 * exactly why the full text still has to go somewhere: this field alone is
 * not a place to read what actually failed.
 */
export function sanitizeLastError(detail: string): string {
  const scrubbed = detail.replace(/[A-Za-z0-9+/_=-]{20,}/g, '[redacted]');
  return scrubbed.length > MAX_LAST_ERROR_LENGTH
    ? `${scrubbed.slice(0, MAX_LAST_ERROR_LENGTH)}…`
    : scrubbed;
}
