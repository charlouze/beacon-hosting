import { describe, expect, it } from 'vitest';
import { readConfig } from './config.js';

const ENV = {
  BEACON_SESSION_ID: 's1',
  BEACON_GAME: 'enshrouded',
  BEACON_TOKEN: 'a'.repeat(64),
  BEACON_ENDPOINT: 'https://europe-west1-beacon.cloudfunctions.net/agentReport',
  BEACON_S3_ENDPOINT: 'https://s3.fr-par.scw.cloud',
  BEACON_S3_REGION: 'fr-par',
  BEACON_S3_ACCESS_KEY: 'SCWXXXXXXXXXXXXXXXXX',
  BEACON_S3_SECRET_KEY: 's3cr3t',
  BEACON_SAVES_BUCKET: 'beacon-saves',
  BEACON_GAMES_BUCKET: 'beacon-games',
  BEACON_SAVE_DIR: '/opt/enshrouded/savegame',
  BEACON_SAVE_OWNER: '4711:4711',
  BEACON_READY_PROBE: 'a2s://enshrouded:15637',
  BEACON_STOP_FLAG: '/opt/beacon/control/stop',
  BEACON_PUSH_INTERVAL_MS: '600000',
};

describe('readConfig', () => {
  it('reads what the cloud-init wrote', () => {
    const config = readConfig(ENV);
    expect(config.sessionId).toBe('s1');
    expect(config.game).toBe('enshrouded');
    expect(config.saveDir).toBe('/opt/enshrouded/savegame');
    expect(config.pushIntervalMs).toBe(600_000);
  });

  // Failing here beats failing three minutes into a boot with an unreadable
  // message — the lesson of the probe's own start script, which refuses
  // outright rather than launching a server that cannot find its world.
  it('names the variable that is missing', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropped on purpose, kept named for the regex below
    const { BEACON_TOKEN, ...without } = ENV;
    expect(() => readConfig(without)).toThrow(/BEACON_TOKEN/);
  });

  // §4: the companion knows no game. It is told which folder to move and which
  // port answers; a value it did not receive is not one it may invent.
  it('refuses a game the domain does not name', () => {
    expect(() => readConfig({ ...ENV, BEACON_GAME: 'minecraft' })).toThrow(/minecraft/);
  });

  it('refuses an interval that is not a number', () => {
    expect(() => readConfig({ ...ENV, BEACON_PUSH_INTERVAL_MS: 'often' })).toThrow(
      /BEACON_PUSH_INTERVAL_MS/,
    );
  });
});
