import type { AgentInstructions, AgentReport } from '@beacon/agent-protocol';
import type { CompanionConfig } from './config.js';

/** What the machine says, and what it is told back. Nothing else crosses. */
export interface Reporter {
  send(report: Omit<AgentReport, 'sessionId'>): Promise<AgentInstructions>;
}

/**
 * The one channel out of this machine (§7). It carries the session token and
 * nothing else that authorises anything — a compromised vm gains the ability to
 * lie to this endpoint, and no ability at all to create a resource.
 */
export function httpReporter(config: CompanionConfig): Reporter {
  return {
    async send(report: Omit<AgentReport, 'sessionId'>): Promise<AgentInstructions> {
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${config.token}`,
        },
        body: JSON.stringify({ ...report, sessionId: config.sessionId }),
      });

      if (!response.ok) {
        // The status and never the body: a 401 says nothing on purpose, and a
        // 500 could carry anything. The token is never printed either — this
        // log is the one thing that leaves the machine in a readable form.
        throw new Error(`agentReport answered ${response.status}`);
      }
      return (await response.json()) as AgentInstructions;
    },
  };
}
