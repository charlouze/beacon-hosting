import { createInterface } from 'node:readline/promises';
import { commandLine } from './lib/command-line.js';
import { gcloud, type Gcloud } from './lib/gcloud.js';
import { gesturesClosing, type Readings } from './lib/gap.js';
import { accountEmail, WANTED } from './lib/wanted.js';

const CHECK_ONLY = process.argv.includes('--check');

function read(cli: Gcloud, wanted: typeof WANTED): Readings {
  const project = `--project=${wanted.project}`;
  const email = accountEmail(wanted);
  const pool = ['--location=global', `--workload-identity-pool=${wanted.pool}`];

  const account = cli.read([
    'iam',
    'service-accounts',
    'describe',
    email,
    project,
    '--format=json',
  ]);

  return {
    accountExists: account !== null,
    projectPolicy:
      cli.read([
        'projects',
        'get-iam-policy',
        wanted.project,
        '--format=json',
      ]) ?? '{}',
    enabledServices:
      cli.read(['services', 'list', '--enabled', project, '--format=json']) ??
      '[]',
    poolExists:
      cli.read([
        'iam',
        'workload-identity-pools',
        'describe',
        wanted.pool,
        '--location=global',
        project,
        '--format=json',
      ]) !== null,
    provider: cli.read([
      'iam',
      'workload-identity-pools',
      'providers',
      'describe',
      wanted.provider,
      ...pool,
      project,
      '--format=json',
    ]),
    accountPolicy:
      account === null
        ? null
        : cli.read([
            'iam',
            'service-accounts',
            'get-iam-policy',
            email,
            project,
            '--format=json',
          ]),
  };
}

/**
 * A `principalSet` naming the wrong project number is refused by nothing: it
 * is a well-formed principal that no token ever matches, so the binding lands,
 * the audit turns green, and the first deployment is denied with a message
 * about permissions rather than about identity.
 */
function refuseAWrongProjectNumber(cli: Gcloud, wanted: typeof WANTED): void {
  const described = cli.read([
    'projects',
    'describe',
    wanted.project,
    '--format=json',
  ]);
  if (described === null) {
    throw new Error(
      `aucun projet nommé ${wanted.project}, ou cet identifiant ne peut pas le voir`,
    );
  }
  const actual = String(
    (JSON.parse(described) as { projectNumber?: unknown }).projectNumber,
  );
  if (actual !== wanted.projectNumber) {
    throw new Error(
      `${wanted.project} porte le numéro de projet ${actual}, cet outil porte ` +
        `${wanted.projectNumber} — corriger WANTED.projectNumber avant de lancer quoi que ce soit`,
    );
  }
}

async function main(): Promise<void> {
  console.log(`Lecture de ${WANTED.project} — cette passe n’écrit rien.\n`);
  refuseAWrongProjectNumber(gcloud, WANTED);

  const gestures = gesturesClosing(read(gcloud, WANTED), WANTED);

  if (gestures.length === 0) {
    console.log(
      'Le compte de déploiement est tel que la tâche 12 le demande. Rien à faire.',
    );
    return;
  }

  console.log(`${gestures.length} chose(s) à combler :\n`);
  for (const gesture of gestures) {
    console.log(`  ${gesture.why}`);
  }

  if (CHECK_ONLY) {
    console.log('--check : rien n’a été lancé.');
    process.exitCode = 1;
    return;
  }

  // Asked once per command, on what that command says it unblocks, and never
  // once for the list. Thirteen administrator roles behind a single "yes" is
  // thirteen decisions nobody made — and refusing one of them has to remain
  // possible, since this tool is the only thing in the repository that writes
  // to the production project.
  const prompt = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  let ran = 0;
  let skipped = 0;

  for (const [index, gesture] of gestures.entries()) {
    console.log(`\n[${index + 1}/${gestures.length}] ${gesture.why}`);
    console.log(`  Elle ${gesture.does}.`);
    console.log(`\n  ${commandLine('gcloud', gesture.args)}\n`);
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

    gcloud.run(gesture.args);
    console.log('  ok');
    ran += 1;
  }

  prompt.close();

  console.log(`\n${ran} lancée(s), ${skipped} laissée(s) de côté.`);
  if (skipped > 0) {
    // Said rather than left to be inferred: a partial pass looks exactly like
    // a complete one on the next line, and the deployment it half-prepares
    // fails on whichever permission was declined.
    console.log('Relancer pour qu’on redemande celles laissées de côté.');
    process.exitCode = 1;
    return;
  }

  console.log('Relancer pour voir le compte relu comme établi.');
  console.log(
    `Then: WIF_PROVIDER = projects/${WANTED.projectNumber}/locations/global`.concat(
      `/workloadIdentityPools/${WANTED.pool}/providers/${WANTED.provider}`,
    ),
  );
  console.log(`      DEPLOY_SERVICE_ACCOUNT = ${accountEmail(WANTED)}`);
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
