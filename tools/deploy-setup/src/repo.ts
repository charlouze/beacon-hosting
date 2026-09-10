import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { gh } from './lib/cli.js';
import { commandLine } from './lib/command-line.js';
import {
  faultsInProtection,
  REQUIRED_CHECK,
  rulesetBody,
} from './lib/protection.js';
import { knownValuesFor, variableGap, WHERE_TO_READ } from './lib/repo-gap.js';
import {
  DEPLOY_WORKFLOW,
  defaultsIn,
  ENV_EXAMPLE,
  variablesReadBy,
} from './lib/repo-variables.js';
import { WANTED } from './lib/wanted.js';

const CHECK_ONLY = process.argv.includes('--check');

interface Gesture {
  readonly why: string;
  readonly does: string;
  readonly args: string[];
}

/**
 * The rules that actually apply to `main`, whichever ruleset they come from.
 * `null` — a 404 — is a repository with no rules at all, which reads the same
 * as an empty list here.
 */
function rulesOn(repository: string): string {
  return gh.read(['api', `repos/${repository}/rules/branches/main`]) ?? '[]';
}

/**
 * The body goes through a file rather than the command line, and not out of
 * taste: it is json, `commandLine` refuses a double quote on purpose, and a
 * body mangled by a shell would be refused by the api with a 422 naming
 * nothing. What the operator reads is the body itself, printed above.
 */
function rulesetInputFile(): string {
  const path = join(tmpdir(), 'beacon-main-ruleset.json');
  writeFileSync(path, rulesetBody());
  return path;
}

async function main(): Promise<void> {
  console.log(`Lecture de ${WANTED.repository} — cette passe n’écrit rien.\n`);

  const names = variablesReadBy(readFileSync(DEPLOY_WORKFLOW, 'utf8'));
  const known = knownValuesFor(
    WANTED,
    defaultsIn(readFileSync(ENV_EXAMPLE, 'utf8')),
  );
  const listed = gh.read(['variable', 'list', '--json', 'name,value']) ?? '[]';
  const gap = variableGap(names, listed, known);

  console.log(`${names.length} variables lues par deploy.yml.`);
  console.log(
    `  ${names.length - gap.toSet.length - gap.toAsk.length} déjà posées`,
  );
  console.log(`  ${gap.toSet.length} que cet outil connaît déjà`);
  console.log(
    `  ${gap.toAsk.length} à te demander : ${gap.toAsk.join(', ') || '—'}`,
  );
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answered: { name: string; value: string }[] = [];

  if (!CHECK_ONLY && gap.toAsk.length > 0) {
    // Shown as it is typed, unlike a secret: these are public identifiers, and
    // seeing the value is how a paste that lost a character gets caught here
    // rather than in a deployment.
    console.log(
      '\nCes valeurs ne sont dans aucun fichier du dépôt — console Scaleway.',
    );
    for (const name of gap.toAsk) {
      console.log(`
  ${name} — ${WHERE_TO_READ[name] ?? 'valeur inconnue de ce dépôt'}`);
      const value = (await prompt.question('  valeur : ')).trim();
      if (value === '') {
        console.log('    passée');
        continue;
      }
      answered.push({ name, value });
    }
  }

  const gestures: Gesture[] = [...gap.toSet, ...answered].map((variable) => ({
    why: `la variable ${variable.name} n’est pas posée`,
    does: `la pose sur le dépôt avec la valeur ${variable.value}`,
    args: ['variable', 'set', variable.name, '--body', variable.value],
  }));

  const faults = faultsInProtection(rulesOn(WANTED.repository));
  if (faults.length > 0) {
    gestures.push({
      why: `la protection de main : ${faults.join(' ; ')}`,
      does:
        `crée un ruleset sur la branche par défaut : ni suppression, ni poussée forcée, ` +
        `et la vérification ${REQUIRED_CHECK} exigée. Sans cette dernière une pull request ` +
        `se fusionne alors que ses tests sont rouges, et une fusion est la mise en ` +
        `production — c'est aussi elle qui interdit la poussée directe, puisque verify ne ` +
        `tourne que sur une pull request`,
      args: [
        'api',
        `repos/${WANTED.repository}/rulesets`,
        '--method',
        'POST',
        '--input',
        rulesetInputFile(),
      ],
    });
  }

  if (gestures.length === 0) {
    prompt.close();
    console.log('\nLe dépôt est tel que la tâche 12 le demande. Rien à faire.');
    return;
  }

  if (CHECK_ONLY) {
    prompt.close();
    console.log(
      `\n--check : ${gestures.length} chose(s) à combler, rien n’a été lancé.`,
    );
    for (const gesture of gestures) console.log(`  ${gesture.why}`);
    process.exitCode = 1;
    return;
  }

  let ran = 0;
  let skipped = 0;

  for (const [index, gesture] of gestures.entries()) {
    console.log(`\n[${index + 1}/${gestures.length}] ${gesture.why}`);
    console.log(`  Elle ${gesture.does}.`);
    if (gesture.args.includes('--input')) console.log(`\n${rulesetBody()}`);
    console.log(`\n  ${commandLine('gh', gesture.args)}\n`);
    const answer = (await prompt.question('  La lancer ? [o/N/q] ')).trim();

    if (answer === 'q' || answer === 'Q') {
      console.log('  arrêt ici');
      skipped += gestures.length - index;
      break;
    }
    if (!['o', 'O', 'y', 'Y'].includes(answer)) {
      console.log('  passée');
      skipped += 1;
      continue;
    }

    gh.run(gesture.args);
    console.log('  ok');
    ran += 1;
  }

  prompt.close();

  console.log(`\n${ran} lancée(s), ${skipped} laissée(s) de côté.`);
  if (skipped > 0) {
    console.log('Relancer pour qu’on redemande celles laissées de côté.');
    process.exitCode = 1;
  }
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
