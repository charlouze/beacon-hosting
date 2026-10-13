import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SETUP_REPORT_INTERVAL_MS } from '@beacon/agent-protocol';
import { SETUP_REPORT_TIMEOUT_MS, setupDeclarer, type SetupDeclarer } from './declare-setup.js';
import type { Reporter } from './reporter.js';

const INSTRUCTIONS = { state: 'PROVISIONING' as const, deadlineIso: null };
const settle = () => new Promise((resolve) => setImmediate(resolve));

let elapsedMs: number;
let report: ReturnType<typeof vi.fn<Reporter['send']>>;
let log: ReturnType<typeof vi.fn<(message: string) => void>>;
let declarer: SetupDeclarer;

beforeEach(() => {
  elapsedMs = 0;
  report = vi.fn<Reporter['send']>(async () => INSTRUCTIONS);
  log = vi.fn<(message: string) => void>();
  declarer = setupDeclarer({
    report,
    log,
    clock: { now: () => new Date(1_760_000_000_000 + elapsedMs) },
  });
});

describe('setupDeclarer', () => {
  it('declares a step in an alive report, and waits five seconds at most for its answer', async () => {
    await declarer.declare({ step: 'restoring-world' });

    expect(SETUP_REPORT_TIMEOUT_MS).toBe(5_000);
    expect(report).toHaveBeenCalledWith(
      { phase: 'alive', setup: { step: 'restoring-world' } },
      { timeoutMs: SETUP_REPORT_TIMEOUT_MS },
    );
  });

  // What is displayed must not cost a restore.
  it('writes a declaration that failed in its log, and carries on', async () => {
    report.mockRejectedValue(new Error('The operation was aborted due to timeout'));

    await expect(declarer.declare({ step: 'restoring-world' })).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('restoring-world'));
  });

  it('waits for the answer to a declaration before it sends the next one', async () => {
    let answer: () => void = () => undefined;
    report.mockImplementationOnce(
      () => new Promise((resolve) => (answer = () => resolve(INSTRUCTIONS))),
    );

    const first = declarer.declare({ step: 'fetching-game' });
    const second = declarer.declare({ step: 'restoring-world' });
    await settle();
    expect(report).toHaveBeenCalledTimes(1);

    answer();
    await Promise.all([first, second]);
    expect(report).toHaveBeenCalledTimes(2);
  });

  it('sends nothing less than ten seconds after the last declaration began', async () => {
    await declarer.declare({ step: 'fetching-game', activity: 'downloading', progress: 0 });

    elapsedMs = SETUP_REPORT_INTERVAL_MS - 1;
    declarer.declareIfDue({ step: 'fetching-game', activity: 'downloading', progress: 40 });
    await settle();
    expect(report).toHaveBeenCalledTimes(1);

    elapsedMs = SETUP_REPORT_INTERVAL_MS;
    declarer.declareIfDue({ step: 'fetching-game', activity: 'downloading', progress: 60 });
    await settle();
    expect(report).toHaveBeenCalledTimes(2);
    expect(report.mock.calls[1][0].setup).toEqual({
      step: 'fetching-game',
      activity: 'downloading',
      progress: 60,
    });
  });

  it('sends nothing while a declaration still waits for its answer', async () => {
    let answer: () => void = () => undefined;
    report.mockImplementationOnce(
      () => new Promise((resolve) => (answer = () => resolve(INSTRUCTIONS))),
    );
    const pending = declarer.declare({ step: 'fetching-game' });

    elapsedMs = 3 * SETUP_REPORT_INTERVAL_MS;
    declarer.declareIfDue({ step: 'fetching-game', activity: 'downloading', progress: 60 });
    await settle();
    answer();
    await pending;
    await settle();

    expect(report).toHaveBeenCalledTimes(1);
  });
});
