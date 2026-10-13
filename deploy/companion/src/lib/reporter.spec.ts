import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CompanionConfig } from './config.js';
import { httpReporter, type Reporter } from './reporter.js';

let server: Server;
let answerAfterMs: number;
let reporter: Reporter;

beforeEach(async () => {
  answerAfterMs = 0;
  server = createServer((_request, response) => {
    setTimeout(() => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ state: 'PROVISIONING', deadlineIso: null }));
    }, answerAfterMs);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  reporter = httpReporter({
    endpoint: `http://127.0.0.1:${port}/`,
    token: 'a'.repeat(64),
    sessionId: 's1',
  } as CompanionConfig);
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

describe('httpReporter', () => {
  it('answers what the control plane said', async () => {
    await expect(reporter.send({ phase: 'alive' })).resolves.toEqual({
      state: 'PROVISIONING',
      deadlineIso: null,
    });
  });

  it('gives up on an answer that takes longer than the delay it was given', async () => {
    answerAfterMs = 500;

    await expect(reporter.send({ phase: 'alive' }, { timeoutMs: 50 })).rejects.toThrow();
  });

  // Only a setup declaration is given a delay: every other report waits.
  it('waits for a slow answer when it was given no delay', async () => {
    answerAfterMs = 200;

    await expect(reporter.send({ phase: 'alive' })).resolves.toEqual({
      state: 'PROVISIONING',
      deadlineIso: null,
    });
  });
});
