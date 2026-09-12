import { bootstrapApplication } from '@angular/platform-browser';
import { initializeApp, type FirebaseOptions } from 'firebase/app';
import { appConfig } from './app/app.config';
import { App, FIREBASE_CONNECTION, type FirebaseConnection } from './app/app';

/**
 * Hosting serves this file itself, filled with the project's own configuration.
 * Asking for it is what keeps every real identifier out of this repository (§7)
 * and leaves nothing to paste in once tranche 4 deploys Hosting.
 *
 * Anything but a configuration — a 404, the dev server's index.html, no server
 * at all — means nobody is hosting us, and then the only base worth talking to
 * is the emulator.
 */
async function connect(): Promise<FirebaseConnection> {
  try {
    const response = await fetch('/__/firebase/init.json');
    if (response.ok) return { app: initializeApp((await response.json()) as FirebaseOptions) };
  } catch {
    // Unreachable is the same answer as unserved.
  }
  return {
    app: initializeApp({
      projectId: 'demo-beacon',
      apiKey: 'demo',
      // Asserted and then ignored, and it has to be both. `_getRedirectUrl`
      // refuses without it — `auth/auth-domain-config-required` — before it
      // ever looks at whether an emulator is connected; `getHandlerBase` then
      // drops it and sends the popup to the emulator's own widget. So the
      // value is never dialled, and its absence made signing in impossible
      // against the only preproduction this project has (§10).
      authDomain: 'localhost',
    }),
    emulator: { host: '127.0.0.1', port: 8080 },
  };
}

connect()
  .then((connection) =>
    bootstrapApplication(App, {
      ...appConfig,
      providers: [...appConfig.providers, { provide: FIREBASE_CONNECTION, useValue: connection }],
    }),
  )
  .catch((err: unknown) => console.error(err));
