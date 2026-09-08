import { type ChildProcess, execFileSync, spawn as spawnProcess } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { type DevSessionPorts, type Spawned, runDevSession } from './lib/dev-session.js';

const STOP_GRACE_MS = 10_000;
const POLL_MS = 1_000;
/** How long a wait may stay silent before it says it is still a wait. */
const SILENCE_MS = 15_000;

/**
 * A shell where `mise activate` has run already carries the pinned tools; one
 * that has not still reaches the same versions through `mise exec`. Same
 * resolution as the sibling in tools/game-depot.
 *
 * `mise` itself is exempt: falling back to `mise exec -- mise` would be
 * nonsense, and every step here is a mise task. If it is not on the path,
 * nothing below can work and saying so once is the useful answer.
 */
function resolveBinary(command: string): { file: string; prefix: readonly string[] } {
  if (command === 'mise') return { file: 'mise', prefix: [] };
  try {
    execFileSync(command, ['--version'], { stdio: 'ignore' });
    return { file: command, prefix: [] };
  } catch {
    return { file: 'mise', prefix: ['exec', '--', command] };
  }
}

/**
 * Killing a child is not killing what it started. `mise run emulators` becomes
 * npx, then firebase, then a java for firestore and a node for functions —
 * and on Windows `child.kill()` reaches only the first of them, leaving the
 * ports held. `taskkill /T` is what walks the tree.
 */
async function stopTree(child: ChildProcess): Promise<void> {
  const pid = child.pid;
  if (pid === undefined || child.exitCode !== null) return;

  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill', ['/pid', String(pid), '/T'], { stdio: 'ignore' });
    } catch {
      // Already gone, or refusing politeness. The hard kill below answers both.
    }
  } else {
    try {
      process.kill(-pid, 'SIGINT');
    } catch {
      // Same.
    }
  }

  const deadline = Date.now() + STOP_GRACE_MS;
  while (child.exitCode === null && Date.now() < deadline) await delay(POLL_MS);
  if (child.exitCode !== null) return;

  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(-pid, 'SIGKILL');
  } catch {
    // Nothing left to try; runDevSession says so out loud.
  }
  await delay(POLL_MS);
}

function spawnChild(name: string, command: string, args: readonly string[]): Spawned {
  const { file, prefix } = resolveBinary(command);
  const child = spawnProcess(file, [...prefix, ...args], {
    // The children write straight to this console, so their logs interleave
    // with the steps above — that is the price of one window, and it is the
    // price the window was chosen for.
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: false,
    detached: process.platform !== 'win32',
  });

  let seen = '';
  const keep = (chunk: Buffer): void => {
    const text = chunk.toString('utf8');
    seen += text;
    process.stdout.write(text);
  };
  child.stdout?.on('data', keep);
  child.stderr?.on('data', keep);

  return {
    name,
    output: () => seen,
    running: () => child.exitCode === null && child.signalCode === null,
    stop: () => stopTree(child),
  };
}

const ports: DevSessionPorts = {
  head: async () => ({
    branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
    sha: execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(),
    clean: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim() === '',
  }),

  readText: (path) => readFileSync(path, 'utf8'),

  writeText: (path, text) => writeFileSync(path, text),

  spawn: spawnChild,

  run: async (_name, command, args) => {
    const { file, prefix } = resolveBinary(command);
    const child = spawnProcess(file, [...prefix, ...args], { stdio: 'inherit', shell: false });
    return await new Promise((resolve) => child.on('close', (code) => resolve(code ?? 1)));
  },

  probe: async (url, token, body) => {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      return { status: response.status };
    } catch (error) {
      return { unreachable: error instanceof Error ? error.message : 'no answer' };
    }
  },

  reachable: async (url) => {
    try {
      await fetch(url, { signal: AbortSignal.timeout(2_000) });
      // Any answer at all is the whole question: something is listening. A 404
      // from the hub would still mean the emulator is up.
      return true;
    } catch {
      return false;
    }
  },

  // `what` is not decoration. Waiting for the emulator means waiting for the
  // functions build first, which runs for minutes — and a terminal that says
  // nothing for minutes is indistinguable from one that has hung.
  waitUntil: async (what, check, timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    let waited = 0;
    while (Date.now() < deadline) {
      if (await check()) return true;
      await delay(POLL_MS);
      waited += POLL_MS;
      if (waited % SILENCE_MS === 0) console.log(`  ..    still waiting for ${what}, ${waited / 1000}s in`);
    }
    return false;
  },

  say: (line) => console.log(line),

  // On Windows ctrl-c reaches every process on the console, so the children
  // may already be dying when the stack unwinds. stopTree is written to be
  // right either way: it asks, waits, kills, and confirms.
  hold: () => new Promise((resolve) => process.once('SIGINT', () => resolve())),
};

try {
  if ((await runDevSession(ports)) === 'refused') process.exitCode = 1;
} catch (error) {
  // Never the error object: a stack from the rewrite would carry a line of
  // apps/functions/.env into the terminal.
  console.error(`beacon: ${error instanceof Error ? error.message : 'the session could not be brought up'}`);
  process.exitCode = 1;
}
