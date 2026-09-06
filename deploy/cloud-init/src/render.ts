import { renderCloudInit, renderCompose } from './lib/catalog.js';
import { isGame } from '@beacon/session';

/**
 * What tranche 0's `render-cloud-init.mjs` did, from the one source that now
 * exists. It is a development tool: the function renders its own cloud-init
 * at provisioning time and never shells out to this.
 */
const game = process.env['GAME'] ?? 'enshrouded';
if (!isGame(game)) throw new Error(`GAME must name a game, got "${game}"`);

if (process.env['WHAT'] === 'compose') {
  process.stdout.write(renderCompose(game));
} else {
  const serverPassword = process.env['SERVER_PASSWORD'];
  if (!serverPassword) throw new Error('SERVER_PASSWORD is required');
  process.stdout.write(
    renderCloudInit(game, {
      serverName: process.env['SERVER_NAME'] ?? 'Beacon',
      serverPassword,
      slotCount: Number(process.env['SLOT_COUNT'] ?? 4),
    }),
  );
}
