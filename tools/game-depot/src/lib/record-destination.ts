/**
 * Where the admin SDK will write, as the environment decides it: with
 * `FIRESTORE_EMULATOR_HOST` set it writes to the emulator without a word.
 * Called once `adminFirestore(env)` has accepted the environment, so the
 * project is present.
 */
export function recordDestinationFrom(env: Record<string, string | undefined>): string {
  const project = env['BEACON_FIREBASE_PROJECT'];
  const emulator = env['FIRESTORE_EMULATOR_HOST'];
  if (emulator === undefined || emulator === '') return `Firestore of project ${project}`;
  return `the Firestore emulator at ${emulator}, project ${project}`;
}
