/** A token that is not in the database, and must never be. */
export const PROBE_TOKEN = 'nope';

/**
 * The smallest body `parseReport` accepts. If it ever stops being accepted the
 * probe answers 400, and the verdict says so in those words rather than
 * blaming the tunnel.
 */
export const PROBE_BODY = { sessionId: 'x', phase: 'alive' } as const;

export type Probe = { readonly status: number } | { readonly unreachable: string };

export interface Verdict {
  readonly ok: boolean;
  readonly lines: readonly string[];
}

/**
 * One POST, three proofs: the tunnel carries, the function is loaded, and the
 * token barrier bites. Every other answer says which of the three failed —
 * that is the whole value of doing this before a machine exists rather than
 * discovering it from a session dying in PROVISIONING.
 */
export function verdictFor(probe: Probe): Verdict {
  if ('unreachable' in probe) {
    return {
      ok: false,
      lines: [
        'the tunnel did not answer at all.',
        'cloudflared is up but nothing came back — the quick tunnel may still be',
        'propagating, or it has already expired.',
      ],
    };
  }

  switch (probe.status) {
    case 401:
      return { ok: true, lines: ['401 — the tunnel carries, the function is loaded, the token barrier bites'] };
    case 200:
      return {
        ok: false,
        lines: [
          'agentReport accepted a token that does not exist.',
          'Nothing is guarding the endpoint a game machine reports to. Do not provision.',
        ],
      };
    case 400:
      return {
        ok: false,
        lines: [
          'agentReport refused the probe body, not the token.',
          "This command's probe has drifted from @beacon/agent-protocol —",
          'the tunnel is most likely fine.',
        ],
      };
    case 404:
      return {
        ok: false,
        lines: [
          'the tunnel carries, but that path is not agentReport.',
          'One of the project, region or function name in agent-endpoint.ts is wrong.',
        ],
      };
    case 502:
    case 503:
    case 504:
    case 530:
      return {
        ok: false,
        lines: [
          `${probe.status} — the tunnel carries, but nothing is listening behind it.`,
          'The functions emulator is not serving on the port the tunnel points at.',
        ],
      };
    default:
      return { ok: false, lines: [`${probe.status} — no story for this answer, and it is not the 401 expected`] };
  }
}
