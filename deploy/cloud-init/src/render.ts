import { renderCloudInit, renderCompose } from './lib/catalog.js';
import { SERVERID_FILTER } from './lib/sunkenland.js';
import { isGame } from '@beacon/session';

/**
 * What tranche 0's `render-cloud-init.mjs` did, from the one source that now
 * exists. It is a development tool: the function renders its own cloud-init
 * at provisioning time and never shells out to this.
 */
function render(): string {
  // Named before the game is even read, because it names no game to render:
  // the extraction filter is one entry's, and a harness that wants to feed it
  // a real trace must get the file itself. Digging it back out of a rendered
  // cloud-init would mean parsing a block scalar — one more parser, in a test,
  // on a format that moves.
  if (process.env['WHAT'] === 'serverid-filter') return SERVERID_FILTER;

  const game = process.env['GAME'] ?? 'enshrouded';
  if (!isGame(game)) throw new Error(`GAME must name a game, got "${game}"`);
  if (process.env['WHAT'] === 'compose') return renderCompose(game);

  const serverPassword = process.env['SERVER_PASSWORD'];
  if (!serverPassword) throw new Error('SERVER_PASSWORD is required');
  return renderCloudInit(game, {
    serverName: process.env['SERVER_NAME'] ?? 'Beacon',
    serverPassword,
    slotCount: Number(process.env['SLOT_COUNT'] ?? 4),
    // Rendering values, never real credentials: this target exists so a human
    // can read the cloud-init, and it must not be a way to print a token.
    sessionId: 'render',
    agentToken: '0'.repeat(64),
    endpoint: 'https://example.invalid/agentReport',
    saves: {
      endpoint: 'https://s3.fr-par.scw.cloud',
      region: 'fr-par',
      savesBucket: 'beacon-saves',
      gamesBucket: 'beacon-games',
      accessKey: 'RENDER-ONLY',
      secretKey: 'RENDER-ONLY',
    },
  });
}

process.stdout.write(render());
