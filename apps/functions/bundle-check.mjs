// Loads the built bundle the way the platform installs it: in a folder outside
// the repository, on the dependencies its package.json declares and nothing
// else. Inside the repository, Node would walk up to the root node_modules and
// find steam-user whether the bundle declares it or not.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dist = 'apps/functions/dist';
const FUNCTIONS = ['watchdog', 'onServerStateChange', 'agentReport'];

const fail = (message) => {
  console.error(`bundle-check: ${message}`);
  process.exit(1);
};

const declared = JSON.parse(readFileSync(join(dist, 'package.json'), 'utf8')).dependencies ?? {};
if (!('steam-user' in declared)) fail(`${dist}/package.json does not declare steam-user`);
if (!readFileSync(join(dist, 'main.js'), 'utf8').includes('import("steam-user")')) {
  fail('main.js does not import steam-user from its dependencies: it was bundled, or nothing reads Steam');
}

const isolated = mkdtempSync(join(tmpdir(), 'beacon-functions-'));
try {
  for (const file of ['main.js', 'package.json', 'package-lock.json']) cpSync(join(dist, file), join(isolated, file));
  execFileSync('npm', ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: isolated,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  const load = createRequire(join(isolated, 'main.js'));
  const loaded = load('./main.js');
  // Not fail(): process.exit would skip the finally and leak the install folder.
  for (const name of FUNCTIONS) if (!(name in loaded)) throw new Error(`bundle-check: the bundle exports no ${name}`);
  // Production loads it through a dynamic import, which resolves differently from require.
  await import(pathToFileURL(load.resolve('steam-user')).href);
  console.log('bundle-check: the bundle loads, and steam-user loads from the dependencies it declares');
} finally {
  rmSync(isolated, { recursive: true, force: true });
}
