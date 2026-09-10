import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { commandLine } from './lib/command-line.js';
import { CONTAINER, secretsDeclaredIn } from './lib/declared-secrets.js';
import { gcloud } from './lib/gcloud.js';
import { secretsToAsk, type SecretVersions } from './lib/secrets-gap.js';
import { WANTED } from './lib/wanted.js';

const ROTATE_ALL = process.argv.includes('--all');

/**
 * Raw mode delivers the keys a cooked terminal would have handled itself, so
 * they are named here rather than left as escapes. Ctrl-C above all: without
 * it, the one gesture every operator reaches for when they mistype a secret
 * does nothing at all.
 */
const END_OF_TRANSMISSION = '\u0004';
const INTERRUPT = '\u0003';
const DELETE = '\u007f';

/**
 * Typed without an echo, and never written anywhere else: not to a file, not
 * to `argv` where any process listing would read it, not to a shell history.
 * The only place each value goes is the stdin of the command that stores it.
 *
 * Raw mode rather than readline, because readline echoes by construction and
 * silencing it means reaching into its private writer.
 */
function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    process.stdout.write(question);
    const input = process.stdin;
    input.setRawMode?.(true);
    input.resume();
    input.setEncoding('utf8');

    let typed = '';
    const onData = (chunk: string): void => {
      for (const character of chunk) {
        if (
          character === '\r' ||
          character === '\n' ||
          character === END_OF_TRANSMISSION
        ) {
          input.setRawMode?.(false);
          input.pause();
          input.off('data', onData);
          process.stdout.write('\n');
          resolve(typed);
          return;
        }
        if (character === INTERRUPT) {
          process.stdout.write('\n');
          process.exit(130);
        }
        if (character === DELETE || character === '\b') {
          typed = typed.slice(0, -1);
          continue;
        }
        typed += character;
      }
    };
    input.on('data', onData);
  });
}

function versionsOf(names: readonly string[]): SecretVersions {
  const versions: SecretVersions = {};
  for (const name of names) {
    versions[name] = gcloud.read([
      'secrets',
      'versions',
      'list',
      name,
      `--project=${WANTED.project}`,
      '--format=json',
    ]);
  }
  return versions;
}

/**
 * `--data-file -` is what keeps the value off the command line: the line below
 * names the secret and nothing else, and the value travels through the pipe.
 *
 * No trailing newline is added. `--data-file` stores the bytes it is handed,
 * and a secret with a `\n` at the end authenticates against nothing while
 * looking, in every console, exactly like the right one.
 */
function storeLine(name: string): string {
  return commandLine('npx', [
    'firebase',
    'functions:secrets:set',
    name,
    `--project=${WANTED.project}`,
    '--data-file',
    '-',
  ]);
}

function store(name: string, value: string): void {
  execSync(storeLine(name), {
    input: value,
    stdio: ['pipe', 'inherit', 'inherit'],
  });
}

async function main(): Promise<void> {
  const declared = secretsDeclaredIn(readFileSync(CONTAINER, 'utf8'));
  console.log(
    `${declared.length} secrets déclarés dans container.ts : ${declared.join(', ')}\n`,
  );

  const wanted = secretsToAsk(declared, versionsOf(declared), ROTATE_ALL);
  if (wanted.length === 0) {
    console.log('Chacun porte déjà une version active. Rien à faire.');
    console.log(
      'Utiliser --all pour en publier une nouvelle version quand même.',
    );
    return;
  }

  console.log(
    `${wanted.length} à poser. Rien ne s’affiche, et une saisie vide en saute un.`,
  );

  for (const [index, name] of wanted.entries()) {
    // The command is shown before the value is asked for, not after it is
    // stored: what the operator is about to hand a credential to is the thing
    // they need to read, and reading it afterwards is reading a receipt.
    console.log(
      `\n[${index + 1}/${wanted.length}] ${name} — en publie une nouvelle version`,
    );
    console.log(`  ${storeLine(name)}`);
    const value = await askHidden(`  valeur (vide pour passer) : `);
    if (value === '') {
      console.log('  passé');
      continue;
    }
    store(name, value);
  }

  console.log('\nTerminé. Relancer pour les voir relus comme posés.');
}

try {
  await main();
} catch (error) {
  // What an operator needs is what the tool it drives refused, not this
  // process's stack: the failure is always out there — a permission, a
  // credential, an argument google would not take — and a node trace buries
  // the one line that says which.
  console.error(`\n  STOP  ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
