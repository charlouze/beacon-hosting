import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  renderAgentSetup,
  REPORT_INTERVAL_MS,
  SETUP_REPORT_INTERVAL_MS,
  type AgentSetup,
} from '@beacon/agent-protocol';
import { GAME_LOG_TAIL_BYTES, readLogTail } from './game-log.js';
import { loadAgentSetup, setupWatch } from './setup-watch.js';

const SETUP: AgentSetup = {
  startStep: 'fetching-game',
  markers: [
    { pattern: 'fetching: ([0-9.]+)%', step: 'fetching-game', activity: 'downloading' },
    { pattern: 'installed', step: 'starting-game' },
  ],
};

let folder: string;

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'beacon-setup-watch-'));
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

describe('setupWatch', () => {
  it('declares the start step while no line has answered a marker', () => {
    const watch = setupWatch(SETUP, () => 'booting\n');

    expect(watch.declared()).toEqual({ step: 'fetching-game' });
  });

  it('declares what the markers decide on the end of the output', () => {
    const watch = setupWatch(SETUP, () => 'fetching: 41.7%\n');

    expect(watch.declared()).toEqual({
      step: 'fetching-game',
      activity: 'downloading',
      progress: 41,
    });
  });

  it('follows the output as it grows', () => {
    let output = 'fetching: 10%\n';
    const watch = setupWatch(SETUP, () => output);
    watch.declared();

    output += 'installed\n';

    expect(watch.declared()).toEqual({ step: 'starting-game' });
  });

  // The game goes on printing: the line that decided leaves what is read, and
  // the step it decided is still the current one.
  it('keeps what a marker decided once its line is out of what it reads', () => {
    let output = 'installed\n';
    const watch = setupWatch(SETUP, () => output);
    watch.declared();

    output = 'serving\nserving\n';

    expect(watch.declared()).toEqual({ step: 'starting-game' });
  });

  it('declares the start step for a game that has no marker', () => {
    const watch = setupWatch({ startStep: 'starting-game', markers: [] }, () => 'anything');

    expect(watch.declared()).toEqual({ step: 'starting-game' });
  });

  it('declares the start step when the decisive line left the file before it was ever read', () => {
    const path = join(folder, 'game.log');
    writeFileSync(path, `installed\n${'x'.repeat(GAME_LOG_TAIL_BYTES)}\n`);
    const watch = setupWatch(SETUP, () => readLogTail(path));

    expect(watch.declared()).toEqual({ step: 'fetching-game' });
  });

  it('declares the start step when the file of the output is not there', () => {
    const watch = setupWatch(SETUP, () => readLogTail(join(folder, 'absent.log')));

    expect(watch.declared()).toEqual({ step: 'fetching-game' });
  });

  it('is followed every ten seconds when the game has markers', () => {
    expect(setupWatch(SETUP, () => '').intervalMs).toBe(SETUP_REPORT_INTERVAL_MS);
  });

  // A game with no marker has nothing new to say between two minutes.
  it('is followed once a minute when the game has no marker', () => {
    const watch = setupWatch({ startStep: 'starting-game', markers: [] }, () => '');

    expect(watch.intervalMs).toBe(REPORT_INTERVAL_MS);
  });
});

describe('loadAgentSetup', () => {
  const INSTRUCTIONS = { state: 'PROVISIONING' as const, deadlineIso: null };

  it('reads the markers the cloud-init wrote', async () => {
    const path = join(folder, 'setup-markers.json');
    writeFileSync(path, `${renderAgentSetup(SETUP)}\n`);
    const report = vi.fn(async () => INSTRUCTIONS);

    await expect(loadAgentSetup(path, { report, log: vi.fn() })).resolves.toEqual(SETUP);
    expect(report).not.toHaveBeenCalled();
  });

  it('declares a failure and gives up on a file it cannot read', async () => {
    const path = join(folder, 'setup-markers.json');
    writeFileSync(path, '{ "startStep": "booting" }');
    const report = vi.fn(async () => INSTRUCTIONS);

    await expect(loadAgentSetup(path, { report, log: vi.fn() })).rejects.toThrow(/setup markers/);
    expect(report).toHaveBeenCalledWith({
      phase: 'failed',
      detail: expect.stringContaining('setup markers'),
    });
  });

  it('declares a failure and gives up on a file that is not there', async () => {
    const report = vi.fn(async () => INSTRUCTIONS);

    await expect(
      loadAgentSetup(join(folder, 'absent.json'), { report, log: vi.fn() }),
    ).rejects.toThrow(/setup markers/);
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ phase: 'failed' }));
  });

  it('gives up all the same when the failure could not be declared', async () => {
    const log = vi.fn();
    const report = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });

    await expect(loadAgentSetup(join(folder, 'absent.json'), { report, log })).rejects.toThrow(
      /setup markers/,
    );
    expect(log).toHaveBeenCalledWith(expect.stringContaining('ECONNRESET'));
  });
});
