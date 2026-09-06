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
/**
 * Must list every `defineSecret` the Functions declare. The two live apart —
 * this array and `container.ts` — and nothing makes them agree, so adding a
 * secret there without adding it here is a silent gap: the emulator falls back
 * to Secret Manager and fails to authenticate, minutes into a session, far
 * from the commit that caused it. It happened once with `S3_SECRET_KEY`.
 */
const SECRETS = [
  'SCW_SECRET_KEY',
  'SERVER_PASSWORD',
  'DYNHOST_USER',
  'DYNHOST_PASSWORD',
  'S3_SECRET_KEY',
];

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
