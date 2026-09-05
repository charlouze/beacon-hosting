/** A session's identity, drawn by whoever opens it. */
export type SessionId = string;

export const SESSION_STATES = [
  'IDLE',
  'PROVISIONING',
  'RUNNING',
  'STOPPING',
  'FAILED',
] as const;

export type SessionState = (typeof SESSION_STATES)[number];
