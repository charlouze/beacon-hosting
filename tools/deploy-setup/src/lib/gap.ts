import {
  DEPLOYING_REF,
  faultsInProvider,
  principalSetFor,
} from './federation.js';
import { rolesMissingFrom } from './project-iam.js';
import { servicesMissingFrom } from './services.js';
import {
  accountEmail,
  accountMember,
  roleNames,
  serviceNames,
  WANTED,
} from './wanted.js';

/** Everything read off the project, before a single thing is decided about it. */
export interface Readings {
  readonly accountExists: boolean;
  readonly projectPolicy: string;
  readonly enabledServices: string;
  readonly poolExists: boolean;
  /** The provider as json, or `null` when there is none. */
  readonly provider: string | null;
  /** The account's own policy as json, or `null` when there is no account. */
  readonly accountPolicy: string | null;
}

export interface Gesture {
  /** What was read that makes this gesture necessary. */
  readonly why: string;
  /**
   * What running it changes, in the operator's words. Separate from `why`
   * because a statement of what is missing is not an explanation of what the
   * command does — and the assent is given on the explanation.
   */
  readonly does: string;
  readonly args: string[];
}

type Wanted = typeof WANTED;

function conditionFor(wanted: Wanted): string {
  return `assertion.repository=='${wanted.repository}' && assertion.ref=='${DEPLOYING_REF}'`;
}

function providerFlags(wanted: Wanted): string[] {
  return [
    '--location=global',
    `--workload-identity-pool=${wanted.pool}`,
    `--project=${wanted.project}`,
    `--issuer-uri=${wanted.issuerUri}`,
    '--attribute-mapping=google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref',
    `--attribute-condition=${conditionFor(wanted)}`,
  ];
}

/**
 * The gestures that turn what was read into what is wanted, in an order that
 * can be run straight through: nothing here grants a right to an account that
 * a later gesture creates.
 *
 * Returning them rather than performing them is what lets the whole decision
 * be tested against a production account no test may touch — and what lets the
 * operator read the list before anything happens.
 */
export function gesturesClosing(readings: Readings, wanted: Wanted): Gesture[] {
  const gestures: Gesture[] = [];
  const member = accountMember(wanted);
  const email = accountEmail(wanted);

  // One gesture per api rather than a single `services enable` for all of
  // them: the operator confirms each command on what it says it unblocks, and
  // a batch would ask for nine assents at once under one sentence.
  const missingServices = servicesMissingFrom(
    readings.enabledServices,
    serviceNames(wanted),
  );
  for (const service of wanted.services.filter((one) =>
    missingServices.includes(one.name),
  )) {
    gestures.push({
      why: `${service.name} n’est pas activée`,
      does: `active l’API sur le projet, ce qui débloque ${service.unlocks}`,
      args: ['services', 'enable', service.name, `--project=${wanted.project}`],
    });
  }

  if (!readings.accountExists) {
    gestures.push({
      why: `aucun compte nommé ${email}`,
      does:
        `crée le compte avec lequel une fusion déploiera. Il ne porte aucune clé et aucune ` +
        `n’est téléchargée : c’est la fédération posée plus bas qui permet à GitHub de ` +
        `l’emprunter, et seulement depuis ${wanted.repository}`,
      args: [
        'iam',
        'service-accounts',
        'create',
        wanted.account,
        `--display-name=${wanted.accountDescription}`,
        `--project=${wanted.project}`,
      ],
    });
  }

  const missingRoles = rolesMissingFrom(
    readings.projectPolicy,
    member,
    roleNames(wanted),
  );
  for (const role of wanted.roles.filter((one) =>
    missingRoles.includes(one.name),
  )) {
    gestures.push({
      why: `le compte ne porte pas ${role.name}`,
      does: `lui accorde ce rôle sur tout le projet, sans condition, ce qui débloque ${role.unlocks}`,
      args: [
        'projects',
        'add-iam-policy-binding',
        wanted.project,
        `--member=${member}`,
        `--role=${role.name}`,
        '--condition=None',
      ],
    });
  }

  if (!readings.poolExists) {
    gestures.push({
      why: `aucun pool d’identité de charge de travail nommé ${wanted.pool}`,
      does:
        `crée le pool qui portera la confiance en GitHub. Seul, il ne laisse entrer ` +
        `personne : c’est le fournisseur créé juste après qui admet les jetons, et sous ` +
        `quelle condition`,
      args: [
        'iam',
        'workload-identity-pools',
        'create',
        wanted.pool,
        '--location=global',
        '--display-name=GitHub Actions',
        `--project=${wanted.project}`,
      ],
    });
  }

  if (readings.provider === null) {
    gestures.push({
      why: `aucun fournisseur OIDC nommé ${wanted.provider}`,
      does:
        `apprend au pool à faire confiance aux jetons GitHub, et refuse à la porte tous ` +
        `ceux qui ne viennent pas de ${wanted.repository} sur ${DEPLOYING_REF}. Cette ` +
        `condition est toute la sécurité du dispositif`,
      args: [
        'iam',
        'workload-identity-pools',
        'providers',
        'create-oidc',
        wanted.provider,
        ...providerFlags(wanted),
      ],
    });
  } else {
    const faults = faultsInProvider(readings.provider, wanted.repository);
    if (faults.length > 0) {
      gestures.push({
        // `update-oidc` and not `create-oidc`: the provider is there, so a
        // create would be refused for ever and the fault would outlive every
        // run of this tool.
        why: `le fournisseur OIDC est là, mais ${faults.join(' ; ')}`,
        does:
          `réécrit sa condition pour que seul ${wanted.repository} sur ${DEPLOYING_REF} soit ` +
          `admis. Laissée telle quelle, elle admet un jeton auquel ce projet n’a jamais ` +
          `voulu faire confiance`,
        args: [
          'iam',
          'workload-identity-pools',
          'providers',
          'update-oidc',
          wanted.provider,
          ...providerFlags(wanted),
        ],
      });
    }
  }

  const principal = principalSetFor(
    wanted.projectNumber,
    wanted.pool,
    wanted.repository,
  );
  const impersonation =
    readings.accountPolicy ?? JSON.stringify({ bindings: [] });
  if (
    rolesMissingFrom(impersonation, principal, [
      'roles/iam.workloadIdentityUser',
    ]).length > 0
  ) {
    gestures.push({
      why: `${wanted.repository} n’a pas le droit d’usurper le compte`,
      does:
        `autorise les workflows de ce dépôt, et aucune autre identité que le pool pourrait ` +
        `admettre plus tard, à emprunter le compte. Sans elle la fédération s’authentifie ` +
        `puis se voit refuser le compte`,
      args: [
        'iam',
        'service-accounts',
        'add-iam-policy-binding',
        email,
        '--role=roles/iam.workloadIdentityUser',
        `--member=${principal}`,
        `--project=${wanted.project}`,
      ],
    });
  }

  return gestures;
}
