import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Copies the Function secrets into the place the emulator actually reads them.
 *
 * `defineSecret` does not read `.env`: the emulator fetches those values from
 * Secret Manager unless it finds an override in `.secret.local`, inside the
 * declared functions source directory. And every build wipes `dist/`, so this
 * runs after each one.
 *
 * Node and not a shell one-liner: `mise` runs tasks through the platform's own
 * shell, and a pattern with alternation is read as a pipe by cmd.
 *
 * The file it writes holds real credentials. It is covered by `.gitignore` and
 * must never leave the machine — which is also why it is written into `dist/`
 * and not tracked anywhere.
 */
const SECRETS = ['SCW_SECRET_KEY', 'SERVER_PASSWORD', 'DYNHOST_USER', 'DYNHOST_PASSWORD'];

const source = 'apps/functions/.env';
const target = 'apps/functions/dist/.secret.local';

const lines = readFileSync(source, 'utf8')
  .split(/\r?\n/)
  .filter((line) => SECRETS.some((key) => line.startsWith(`${key}=`)));

const missing = SECRETS.filter((key) => !lines.some((line) => line.startsWith(`${key}=`)));
if (missing.length > 0) {
  // Loud, and naming what is absent: a missing secret shows up much later as
  // an emulator reaching for Secret Manager and failing to authenticate.
  throw new Error(`${source} is missing ${missing.join(', ')}`);
}

writeFileSync(target, `${lines.join('\n')}\n`);
console.log(`${target}: ${SECRETS.length} secrets written`);
