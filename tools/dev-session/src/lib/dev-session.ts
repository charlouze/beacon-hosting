import { agentEndpointFor } from './agent-endpoint.js';
import { type EmulatorPorts, emulatorPortsFrom } from './emulator-ports.js';
import {
  PROBE_BODY,
  PROBE_TOKEN,
  type Probe,
  verdictFor,
} from './readiness.js';
import { stillWorthShowing, tunnelUrlFrom } from './cloudflared.js';

export const FUNCTIONS_ENV = 'apps/functions/.env';
export const FIREBASE_CONFIG = 'firebase.dev.json';
/** Angular's default. Announced only — see step 7 for why that is enough. */
export const PILOT_URL = 'http://localhost:4200';

/** A long-running child this command is responsible for killing. */
export interface Started {
  readonly name: string;
  stop(): Promise<void>;
  running(): boolean;
}

export interface Spawned extends Started {
  /** Everything the child has written so far, stdout and stderr merged. */
  output(): string;
  /**
   * Narrows what reaches the terminal to the lines `keep` accepts. What
   * `output()` returns is unaffected — the child goes on being read in full,
   * it just stops writing all of it on the screen.
   */
  quieten(keep: (line: string) => boolean): void;
}

export interface Head {
  readonly branch: string;
  readonly sha: string;
  readonly clean: boolean;
}

export interface DevSessionPorts {
  readonly head: () => Promise<Head>;
  readonly readText: (path: string) => string;
  readonly writeText: (path: string, text: string) => void;
  readonly spawn: (
    name: string,
    command: string,
    args: readonly string[],
  ) => Spawned;
  /** Runs to completion and answers its exit code. */
  readonly run: (
    name: string,
    command: string,
    args: readonly string[],
  ) => Promise<number>;
  readonly probe: (url: string, token: string, body: unknown) => Promise<Probe>;
  /** A plain GET that only answers whether something is listening. */
  readonly reachable: (url: string) => Promise<boolean>;
  /** Polls `check` until true or the deadline passes. */
  readonly waitUntil: (
    what: string,
    check: () => Promise<boolean> | boolean,
    timeoutMs: number,
  ) => Promise<boolean>;
  readonly say: (line: string) => void;
  /** Resolves when the operator asks for the window back. */
  readonly hold: () => Promise<void>;
}

export type DevSessionOutcome =
  /** The window was held, then handed back. */
  | 'held'
  /** Something was wrong; nothing was left running. */
  | 'refused';

/** The quick tunnel prints its box a few seconds in; sixty is generous. */
const TUNNEL_URL_TIMEOUT_MS = 60_000;
/** `mise run emulators` builds the functions first, and that build is not fast. */
const EMULATOR_TIMEOUT_MS = 300_000;
/** Angular's first compile, on a cold cache. */
const PILOT_TIMEOUT_MS = 240_000;
/** A fresh quick tunnel takes a few seconds to be reachable from outside. */
const PROBE_TIMEOUT_MS = 60_000;

/**
 * One command for the gesture that used to be seven, in the one order that
 * works. The order is not a convenience: `apps/functions/dist/.env` is a copy
 * the build lays down, and the emulator reads it once at startup. Rewriting
 * after the build, or building after the emulator, provisions a billed machine
 * that reports to a dead url — which is what happened on 2026-09-08.
 *
 * Every long-running child is pushed on a stack as it starts, and the stack is
 * unwound in reverse on any exit — a failed step as much as a ctrl-c. Nothing
 * this command started outlives it, and a tunnel left behind is an url that
 * carries nothing while still looking alive.
 */
export async function runDevSession(
  ports: DevSessionPorts,
): Promise<DevSessionOutcome> {
  const { say } = ports;
  const started: Started[] = [];

  say('beacon: a test session, from the tunnel to the pilot');

  try {
    say('');
    say('1. The tree this emulator will serve');
    const head = await ports.head();
    say(
      `  ok    ${head.branch} @ ${head.sha}${head.clean ? '' : ', with uncommitted changes'}`,
    );
    // Said, never refused. main is a legitimate tree to test from, and the
    // build below makes the tree served and the tree checked out the same
    // thing — so the only thing left worth doing is naming it.
    say('        this command builds what is here, so that is what will run');

    const emulator: EmulatorPorts = emulatorPortsFrom(
      ports.readText(FIREBASE_CONFIG),
    );

    // Both files are read before anything is started, and the rewrite is
    // rehearsed against a url that will never be written. A file this command
    // cannot use costs nothing to find out about here; found out after the
    // next step, it costs an open tunnel and the operator's attention.
    try {
      ports.readText(FUNCTIONS_ENV);
    } catch (error) {
      say(
        `  STOP  ${FUNCTIONS_ENV} is not usable, and nothing has been started yet.`,
      );
      // Safe to print: the read failure names a path, and the rewrite is
      // written never to carry a value out of that file.
      say(`        ${error instanceof Error ? error.message : String(error)}`);
      say(
        '        That file is git-ignored and holds real credentials, so a fresh worktree',
      );
      say(
        '        has none: run this from the main checkout, or copy the file into yours.',
      );
      return 'refused';
    }
    say(`  ok    ${FUNCTIONS_ENV} is readable`);

    say('');
    say('2. The tunnel');
    const tunnel = ports.spawn('tunnel', 'cloudflared', [
      'tunnel',
      '--no-autoupdate',
      '--url',
      `http://127.0.0.1:${emulator.functions}`,
    ]);
    started.push(tunnel);
    const gotUrl = await ports.waitUntil(
      'tunnel url',
      () => tunnelUrlFrom(tunnel.output()) !== undefined,
      TUNNEL_URL_TIMEOUT_MS,
    );
    const tunnelUrl = gotUrl ? tunnelUrlFrom(tunnel.output()) : undefined;
    if (tunnelUrl === undefined) {
      say('  STOP  cloudflared printed no quick tunnel url.');
      say('        Nothing was rewritten and nothing else was started.');
      return 'refused';
    }
    // Its startup chatter has done its job: the url was in it. From here only
    // what cloudflared complains about is worth the screen — a tunnel that
    // expires mid-session is one of the three faults this command answers.
    tunnel.quieten(stillWorthShowing);
    say(`  ok    ${tunnelUrl} -> http://127.0.0.1:${emulator.functions}`);

    const endpoint = agentEndpointFor(tunnelUrl);

    say('');
    say('3. The emulator, which builds first');
    const emulatorProcess = ports.spawn('emulator', 'mise', [
      'run',
      'emulators',
    ]);
    started.push(emulatorProcess);
    // The hub, not a log line. `firebase-tools` rewords "All emulators ready"
    // between versions; the hub answering on its declared port is a contract.
    const up = await ports.waitUntil(
      'emulator',
      () => ports.reachable(`http://127.0.0.1:${emulator.hub}/emulators`),
      EMULATOR_TIMEOUT_MS,
    );
    if (!up) {
      say('  STOP  the emulator hub never answered.');
      return 'refused';
    }
    say(`  ok    functions on ${emulator.functions}, hub on ${emulator.hub}`);
    say(
      `  ok    emulator ui   http://127.0.0.1:${emulator.ui}   database and function logs`,
    );

    say('');
    say('4. The seed');
    if ((await ports.run('seed', 'mise', ['run', 'seed'])) !== 0) {
      say('  STOP  the seed did not finish.');
      return 'refused';
    }
    say('  ok    server/current, config/settings');

    say('');
    say('5. The endpoint, stamped where the watchdog reads it');
    // §4: `agentEndpoint` lives on `config/settings`, written by the deployment
    // in production and by this step in local. It has to come after the seed,
    // which is what creates the document, and it is a targeted field write —
    // so it survives being run twice with two different tunnels.
    if ((await ports.run('stamp', 'mise', ['run', 'stamp', endpoint])) !== 0) {
      say(
        '  STOP  the endpoint was not stamped, so a provisioned machine would report nowhere.',
      );
      return 'refused';
    }
    say('  ok    config/settings.agentEndpoint');

    say('');
    say('6. The 401, through the tunnel');
    let verdict = verdictFor(
      await ports.probe(endpoint, PROBE_TOKEN, PROBE_BODY),
    );
    if (!verdict.ok) {
      // A quick tunnel takes a few seconds to be reachable from outside, so
      // one red answer is not yet an answer.
      await ports.waitUntil(
        'endpoint',
        async () => {
          verdict = verdictFor(
            await ports.probe(endpoint, PROBE_TOKEN, PROBE_BODY),
          );
          return verdict.ok;
        },
        PROBE_TIMEOUT_MS,
      );
    }
    if (!verdict.ok) {
      say(
        '  STOP  the endpoint a game machine would report to is not answering as it must.',
      );
      for (const line of verdict.lines) say(`        ${line}`);
      return 'refused';
    }
    for (const line of verdict.lines) say(`  ok    ${line}`);

    say('');
    say('7. The pilot');
    const pilot = ports.spawn('pilot', 'mise', ['run', 'serve']);
    started.push(pilot);
    // Announced, not depended on — unlike the emulator ports, nothing here
    // points at 4200. So a pilot that took longer than the wait, or that
    // picked another port because 4200 was busy, is worth a line and not a
    // refusal: its own output above already said where it is listening.
    if (
      await ports.waitUntil(
        'pilot',
        () => ports.reachable(PILOT_URL),
        PILOT_TIMEOUT_MS,
      )
    ) {
      say(`  ok    ${PILOT_URL}`);
    } else {
      say(
        `  !     nothing answered on ${PILOT_URL} — read the pilot's own output above for its port`,
      );
    }

    say('');
    say('  --    ctrl-c stops all three, in reverse order');
    await ports.hold();
    return 'held';
  } finally {
    say('');
    for (const child of [...started].reverse()) {
      await child.stop();
      // Not a politeness. A tunnel or an emulator that survives holds a port,
      // and the next run fails on it several minutes from here, far from the
      // cause.
      if (child.running()) {
        say(
          `  !     ${child.name} is still alive after being asked and then killed — stop it by hand`,
        );
      } else {
        say(`  ok    ${child.name} stopped`);
      }
    }
  }
}
