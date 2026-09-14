/**
 * The one line that makes these commands unable to reach production.
 *
 * Both variables are what the Admin SDK reads to talk to an emulator instead
 * of Google: unset, the very same code writes to the real database and the
 * real directory with the real credentials. The `mise` tasks always set them,
 * so this guard only fires when someone runs the entry point by hand — which
 * is precisely the moment it is worth having.
 */
export function emulatorsOnly(command: string): void {
  const missing = ['FIRESTORE_EMULATOR_HOST', 'FIREBASE_AUTH_EMULATOR_HOST'].filter(
    (name) => (process.env[name] ?? '') === '',
  );
  if (missing.length > 0) {
    throw new Error(
      `${command} refuses to run without ${missing.join(' and ')}: ` +
        'unset, it would write to production. Run it through `mise run`.',
    );
  }
}
