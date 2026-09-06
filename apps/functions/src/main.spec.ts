import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import express from 'express';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

// `agentReport` is real, all the way through firebase-functions' `onRequest`
// wrapping (§7: this is the public front door, and the review that promoted
// this finding wants the wrapping exercised, not only `runAgentReport`).
// What is mocked is everything past the frontier: the decision function
// itself — pinned on its own, without a network, in `agent-report.spec.ts` —
// and the deps factory, which would otherwise need real secrets and a real
// Scaleway zone to build.
vi.mock('./agent-report.js', () => ({ runAgentReport: vi.fn() }));
vi.mock('./container.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./container.js')>();
  return { ...actual, buildAgentReportDeps: vi.fn() };
});

import { runAgentReport } from './agent-report.js';
import { agentReport } from './main.js';

const mockRunAgentReport = vi.mocked(runAgentReport);

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.all('*', (request, response) => {
    void agentReport(
      request as unknown as Parameters<typeof agentReport>[0],
      response,
    );
  });
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(
  () =>
    new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    ),
);

afterEach(() => {
  mockRunAgentReport.mockReset();
});

const post = (body: unknown, headers: Record<string, string> = {}) =>
  fetch(baseUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

describe('the agentReport http wrapper', () => {
  it('answers 405 to anything but POST', async () => {
    const response = await fetch(baseUrl, { method: 'GET' });
    expect(response.status).toBe(405);
    expect(await response.text()).toBe('');
    expect(mockRunAgentReport).not.toHaveBeenCalled();
  });

  it('answers 400 when the body does not parse as a report', async () => {
    const response = await post(
      { nonsense: true },
      { authorization: `Bearer ${'a'.repeat(64)}` },
    );
    expect(response.status).toBe(400);
    expect(await response.text()).toBe('');
    expect(mockRunAgentReport).not.toHaveBeenCalled();
  });

  it('answers 400 when the authorization header is absent', async () => {
    const response = await post({ sessionId: 's1', phase: 'alive' });
    expect(response.status).toBe(400);
    expect(mockRunAgentReport).not.toHaveBeenCalled();
  });

  // The decision function answers null for every reason a credential can be
  // refused — an unverified token, a session it was never issued for — and
  // the wrapper must not let any of them read differently to the caller.
  it('answers 401 with no body when the credential is refused, whatever the reason', async () => {
    mockRunAgentReport.mockResolvedValueOnce(null);
    const wrongToken = await post(
      { sessionId: 's1', phase: 'alive' },
      { authorization: `Bearer ${'a'.repeat(64)}` },
    );
    expect(wrongToken.status).toBe(401);
    expect(await wrongToken.text()).toBe('');

    mockRunAgentReport.mockResolvedValueOnce(null);
    const unknownSession = await post(
      { sessionId: 'never-seen', phase: 'alive' },
      { authorization: `Bearer ${'b'.repeat(64)}` },
    );
    expect(unknownSession.status).toBe(401);
    expect(await unknownSession.text()).toBe('');
  });

  it('answers the instructions on the happy path', async () => {
    mockRunAgentReport.mockResolvedValueOnce({
      state: 'RUNNING',
      deadlineIso: '2026-09-07T00:00:00.000Z',
    });
    const response = await post(
      { sessionId: 's1', phase: 'alive' },
      { authorization: `Bearer ${'a'.repeat(64)}` },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      state: 'RUNNING',
      deadlineIso: '2026-09-07T00:00:00.000Z',
    });
    expect(mockRunAgentReport).toHaveBeenCalledWith(undefined, 'a'.repeat(64), {
      sessionId: 's1',
      phase: 'alive',
    });
  });
});
