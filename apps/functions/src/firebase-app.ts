import { getApp, initializeApp, type App } from 'firebase-admin/app';

/**
 * The default Firebase app, initialised once.
 *
 * It asks `getApp()` rather than `getApps().length === 0`, and the difference
 * is not style. `getApps()` answers "are there any apps at all", including
 * **named** ones; `getFirestore()` wants the *default* one. A process where
 * something else has already initialised a named app therefore skips the
 * guard and then fails on `getFirestore` with "the default Firebase app does
 * not exist" — which is exactly what the Functions emulator produced, since
 * its runtime initialises apps of its own before ours is required.
 *
 * `getApp()` throws when there is no default app, and that throw is the only
 * reliable way to ask the question the callers actually have.
 */
export function defaultApp(): App {
  try {
    return getApp();
  } catch {
    return initializeApp();
  }
}
