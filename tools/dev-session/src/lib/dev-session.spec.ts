import { describe, expect, it } from 'vitest';
import {
  type DevSessionPorts,
  type Spawned,
  runDevSession,
} from './dev-session.js';

const SECRET = 'the-secret-that-must-never-be-printed';

const ENV = [`SCW_SECRET_KEY=${SECRET}`, ''].join('\n');

const FIREBASE_CONFIG = JSON.stringify({
  emulators: {
    firestore: { port: 8080 },
    functions: { port: 5001 },
    hub: { port: 4400 },
    ui: { enabled: true, port: 4000 },
  },
});

const TUNNEL_STDERR =
  'INF |  https://ripe-badge-outer-quest.trycloudflare.com  |';

interface Recorded {
  readonly calls: string[];
  readonly said: string[];
  readonly written: Map<string, string>;
}

function fakePorts(overrides: Partial<DevSessionPorts> = {}): {
  ports: DevSessionPorts;
  log: Recorded;
} {
  const log: Recorded = { calls: [], said: [], written: new Map() };

  const spawn = (name: string): Spawned => {
    log.calls.push(`spawn:${name}`);
    let alive = true;
    return {
      name,
      output: () => (name === 'tunnel' ? TUNNEL_STDERR : ''),
      running: () => alive,
      quieten: () => log.calls.push(`quieten:${name}`),
      stop: async () => {
        log.calls.push(`stop:${name}`);
        alive = false;
      },
    };
  };

  const ports: DevSessionPorts = {
    head: async () => ({ branch: 'main', sha: '292bfab', clean: true }),
    readText: (path) => {
      log.calls.push(`read:${path}`);
      return path.endsWith('.env') ? ENV : FIREBASE_CONFIG;
    },
    writeText: (path, text) => {
      log.calls.push(`write:${path}`);
      log.written.set(path, text);
    },
    spawn,
    run: async (name) => {
      log.calls.push(`run:${name}`);
      return 0;
    },
    probe: async () => {
      log.calls.push('probe');
      return { status: 401 };
    },
    reachable: async () => true,
    waitUntil: async (what) => {
      log.calls.push(`wait:${what}`);
      return true;
    },
    say: (line) => log.said.push(line),
    hold: async () => {
      log.calls.push('hold');
    },
    ...overrides,
  };
  return { ports, log };
}

describe('the order, which is the whole point of the command', () => {
  it('runs the steps in the one order that works', async () => {
    const { ports, log } = fakePorts();
    expect(await runDevSession(ports)).toBe('held');

    // The stamp lands after the seed and before the probe, and that order is
    // the whole of it: the seed creates `config/settings`, the stamp writes
    // `agentEndpoint` on it (§4), and only then is there any point asking the
    // endpoint whether it answers.
    //
    // Nothing writes a file any more. The endpoint used to be a line in
    // `.env`, which the emulator reads once at startup — which is why it had
    // to be written before the build. Living in Firestore, it can be written
    // after, and a tunnel that dies mid-session is re-stamped by re-running
    // this command rather than by rebuilding.
    expect(log.calls.filter((call) => !call.startsWith('read:'))).toEqual([
      'spawn:tunnel',
      'wait:tunnel url',
      'quieten:tunnel',
      'spawn:emulator',
      'wait:emulator',
      'run:seed',
      'run:stamp',
      'probe',
      'spawn:pilot',
      'wait:pilot',
      'hold',
      'stop:pilot',
      'stop:emulator',
      'stop:tunnel',
    ]);
  });

  // Measured on 2026-09-09: cloudflared buries the dashboard under forty
  // startup lines. The emulator and the pilot keep theirs — function logs and
  // rebuilds are the session — so only the tunnel is quietened, and only once
  // the url it was launched for has been read out of them.
  it('quietens the tunnel and nothing else, and only after reading its url', async () => {
    const { ports, log } = fakePorts();
    await runDevSession(ports);
    expect(log.calls).toContain('quieten:tunnel');
    expect(log.calls).not.toContain('quieten:emulator');
    expect(log.calls).not.toContain('quieten:pilot');
    expect(log.calls.indexOf('quieten:tunnel')).toBeGreaterThan(
      log.calls.indexOf('wait:tunnel url'),
    );
  });

  it('stops what it started in reverse, so no tunnel outlives the window', async () => {
    const { ports, log } = fakePorts();
    await runDevSession(ports);
    expect(log.calls.slice(-3)).toEqual([
      'stop:pilot',
      'stop:emulator',
      'stop:tunnel',
    ]);
  });
});

/**
 * A precondition checked after acting is the exact class of fault this command
 * exists to prevent, so its own preconditions are checked before it acts.
 */
describe('what it settles before it starts anything', () => {
  it('refuses without opening a tunnel when the env file cannot be read', async () => {
    const { ports, log } = fakePorts({
      readText: (path) => {
        if (path.endsWith('.env'))
          throw new Error(
            "ENOENT: no such file or directory, open 'apps/functions/.env'",
          );
        return FIREBASE_CONFIG;
      },
    });
    expect(await runDevSession(ports)).toBe('refused');
    expect(log.calls).not.toContain('spawn:tunnel');
    expect(log.said.join('\n')).toContain('nothing has been started yet');
    // The refusal prints what the read threw, so this is the path where a leak
    // would happen if that message ever named a value out of the file.
    expect(log.said.join('\n')).not.toContain(SECRET);
  });
});

describe('what happens when a step gives up', () => {
  it('tears down the two it had started when the seed fails', async () => {
    const { ports, log } = fakePorts({
      run: async (name) => {
        log.calls.push(`run:${name}`);
        return 1;
      },
    });
    expect(await runDevSession(ports)).toBe('refused');
    expect(log.calls).not.toContain('spawn:pilot');
    expect(log.calls.slice(-2)).toEqual(['stop:emulator', 'stop:tunnel']);
  });

  // The failure that must never hand over: anything on the internet could
  // drive a session, and what it would provision is billed.
  it('refuses and tears down when a false token is accepted', async () => {
    const { ports, log } = fakePorts({ probe: async () => ({ status: 200 }) });
    expect(await runDevSession(ports)).toBe('refused');
    expect(log.calls).not.toContain('spawn:pilot');
    expect(log.calls.slice(-2)).toEqual(['stop:emulator', 'stop:tunnel']);
  });

  it('leaves no orphan when cloudflared never prints a url', async () => {
    const { ports, log } = fakePorts({ waitUntil: async () => false });
    expect(await runDevSession(ports)).toBe('refused');
    expect(log.calls).toContain('stop:tunnel');
    expect(log.calls).not.toContain('write:apps/functions/.env');
  });

  // stop() signals, waits, then kills hard. If a process is still alive after
  // all that, saying so is the only thing left that is useful: the next run
  // will fail on a port that is still held, minutes from here.
  it('says loudly when something refused to die', async () => {
    const { ports, log } = fakePorts({
      spawn: (name) => {
        log.calls.push(`spawn:${name}`);
        return {
          name,
          output: () => TUNNEL_STDERR,
          running: () => true,
          quieten: () => undefined,
          stop: async () => undefined,
        };
      },
    });
    await runDevSession(ports);
    expect(log.said.join('\n')).toContain('still alive');
  });
});

describe('the branch, said and never refused', () => {
  it('names the branch and the commit the emulator will serve', async () => {
    const { ports, log } = fakePorts();
    await runDevSession(ports);
    expect(log.said.join('\n')).toContain('main');
    expect(log.said.join('\n')).toContain('292bfab');
  });

  // main is a legitimate tree to test from. The gesture that killed two
  // sessions was not "being on main", it was not knowing — and the build this
  // command performs makes the tree served and the tree checked out the same
  // thing by construction.
  it('holds the window on main just the same', async () => {
    const { ports } = fakePorts();
    expect(await runDevSession(ports)).toBe('held');
  });

  it('says when the tree is dirty, because that is served too', async () => {
    const { ports, log } = fakePorts({
      head: async () => ({
        branch: 'tranche-4-la-securite',
        sha: 'deadbee',
        clean: false,
      }),
    });
    await runDevSession(ports);
    expect(log.said.join('\n')).toContain('uncommitted');
  });
});

/**
 * The end-to-end version of the guarantee agent-endpoint.spec.ts makes about
 * one function: across a whole run, nothing this command says carries a value
 * out of apps/functions/.env.
 */
describe('what the whole run is allowed to print', () => {
  it('never says a secret, on the green path', async () => {
    const { ports, log } = fakePorts();
    await runDevSession(ports);
    expect(log.said.join('\n')).not.toContain(SECRET);
    // It used to rewrite one line of that file, and this test held that the
    // twelve others survived. It writes nothing at all now, which is the
    // stronger property: a file holding five credentials that no command
    // touches cannot be damaged by one.
    expect(log.written.size).toBe(0);
  });

  it('never says a secret when a step fails either', async () => {
    const { ports, log } = fakePorts({
      probe: async () => ({ unreachable: 'fetch failed' }),
    });
    await runDevSession(ports);
    expect(log.said.join('\n')).not.toContain(SECRET);
  });
});
