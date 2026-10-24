/**
 * Does steamcmd's output reach the operator's terminal while it runs, when
 * game-depot:update launches it? Run from a real Windows console: its console
 * stdin is what the runs below must inherit.
 *
 *   npm --prefix probe run steam:output
 *
 * Each case logs steamcmd in anonymously (about ten seconds, no download)
 * behind an intermediate process that prints a tick every second while it
 * waits. steamcmd's lines mixed with the ticks arrive as they are written;
 * every one of them after the last tick was held until steamcmd exited.
 *
 * The intermediate process is launched either as `nx run-commands` launches a
 * target on Windows (shell, `windowsHide`, stdin inherited, stdout and stderr
 * piped) or straight from this terminal. It hands steamcmd either its own
 * stdio (`inherit`, what update.ts does) or a console window of its own
 * (`window`).
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

type Launch = 'nx' | 'direct';
type Wiring = 'inherit' | 'window';

function steamcmd(): string {
  for (const folder of (process.env['PATH'] ?? '').split(';')) {
    const candidate = join(folder.replace(/^"(.*)"$/, '$1'), 'steamcmd.exe');
    if (folder !== '' && existsSync(candidate)) return candidate;
  }
  throw new Error('steamcmd.exe is not on the PATH');
}

/** The intermediate process: launches steamcmd the way `wiring` says, and ticks until it exits. */
function runSteamcmd(exe: string, wiring: Wiring): void {
  console.log(`  child: stdin.isTTY=${process.stdin.isTTY} stdout.isTTY=${process.stdout.isTTY}`);
  const startedAt = Date.now();
  const ticking = setInterval(() => console.log(`  tick ${Math.round((Date.now() - startedAt) / 1000)}s`), 1000);
  const child = spawn(exe, ['+login', 'anonymous', '+quit'], {
    stdio: wiring === 'inherit' ? 'inherit' : 'ignore',
    detached: wiring === 'window',
  });
  child.on('exit', (code) => {
    clearInterval(ticking);
    console.log(`  child: steamcmd exited with code ${code} after ${Math.round((Date.now() - startedAt) / 1000)}s`);
  });
}

function runCase(exe: string, launch: Launch, wiring: Wiring): Promise<void> {
  console.log(`\n=== START ${launch} / ${wiring}`);
  const command = `npx tsx "${import.meta.filename}" --child ${wiring} "${exe}"`;
  const child =
    launch === 'nx'
      ? spawn(command, [], { shell: true, windowsHide: true, stdio: ['inherit', 'pipe', 'pipe'] })
      : spawn(command, [], { shell: true, stdio: 'inherit' });
  child.stdout?.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr?.on('data', (chunk) => process.stderr.write(chunk));
  return new Promise((resolve) =>
    child.on('close', () => {
      console.log(`=== END ${launch} / ${wiring}`);
      resolve();
    }),
  );
}

const childAt = process.argv.indexOf('--child');
if (childAt !== -1) {
  runSteamcmd(process.argv[childAt + 2] as string, process.argv[childAt + 1] as Wiring);
} else {
  const exe = steamcmd();
  console.log(`steamcmd: ${exe}`);
  console.log(`this terminal: stdin.isTTY=${process.stdin.isTTY} stdout.isTTY=${process.stdout.isTTY}`);
  for (const [launch, wiring] of [
    ['nx', 'inherit'],
    ['direct', 'inherit'],
    ['nx', 'window'],
  ] as const) {
    await runCase(exe, launch, wiring);
  }
}
