/**
 * The account a merge into `main` deploys with, and everything that has to be
 * true about it. Task 12 of the tranche 4 plan is the prose version of this
 * file; this one is the version that can be checked.
 *
 * Every value here is a name, never a credential. The whole point of federated
 * identity is that there is no key to keep — which is also why this file is
 * readable by anyone who can read the repository, and why nothing secret may
 * ever be added to it.
 */
export const WANTED = {
  project: 'beacon-hosting-charlouze',
  /** Only the number works in a `principalSet`; the id is refused there. */
  projectNumber: '904867606206',
  repository: 'charlouze/beacon-hosting',

  account: 'beacon-deploy',
  accountDescription: 'Deploiement depuis GitHub Actions',

  pool: 'github',
  provider: 'github',
  issuerUri: 'https://token.actions.githubusercontent.com',

  /**
   * The deployment is gen 2 throughout, and that is what makes this list long:
   * `firebase deploy` does not place a function, it builds an image, stores
   * it, publishes a Cloud Run service, and wires one trigger per shape of call
   * `main.ts` exports — `onSchedule`, `onDocumentWritten`, `onRequest`.
   */
  roles: [
    {
      name: 'roles/firebasehosting.admin',
      unlocks: 'la publication de dist/apps/web/browser',
    },
    { name: 'roles/firebaserules.admin', unlocks: 'firestore:rules' },
    {
      name: 'roles/datastore.owner',
      unlocks: 'firestore:indexes, et les écritures du semis et du tampon',
    },
    {
      name: 'roles/cloudfunctions.admin',
      unlocks: 'les Functions telles que la CLI les nomme',
    },
    {
      name: 'roles/run.admin',
      unlocks: 'gen 2 : chaque Function est un service Cloud Run',
    },
    {
      name: 'roles/cloudbuild.builds.editor',
      unlocks: 'la construction de l’image, à chaque déploiement',
    },
    {
      name: 'roles/artifactregistry.admin',
      unlocks: 'le dépôt gcf-artifacts où cette image atterrit',
    },
    {
      name: 'roles/eventarc.admin',
      unlocks: 'le déclencheur Firestore d’onServerStateChange',
    },
    {
      name: 'roles/cloudscheduler.admin',
      unlocks: 'le job Scheduler d’onSchedule',
    },
    {
      name: 'roles/pubsub.admin',
      unlocks: 'le sujet Pub/Sub sur lequel ce job publie',
    },
    {
      name: 'roles/secretmanager.admin',
      unlocks: 'le rattachement des cinq secrets aux Functions',
    },
    {
      name: 'roles/iam.serviceAccountUser',
      unlocks: 'le droit d’agir au nom du compte d’exécution des Functions',
    },
    {
      name: 'roles/serviceusage.serviceUsageConsumer',
      unlocks: 'le projet de quota des appels d’API',
    },
    // Trouvé par le premier déploiement, le 2026-09-10 : `firebase deploy`
    // demande à l'API des extensions quelles Functions déployées appartiennent
    // à une extension, pour ne pas les supprimer — et il le fait avant de rien
    // publier, donc un refus arrête tout au départ. La seule permission qui
    // existe est `firebaseextensions.configs.list`, et ce rôle est le plus
    // étroit des rôles prédéfinis qui la porte. Il est en lecture seule.
    {
      name: 'roles/firebase.developViewer',
      unlocks: 'la lecture des extensions, que firebase deploy interroge avant de publier',
    },
  ],

  /**
   * `iamcredentials` is in this list and in no table of roles, because it
   * belongs to no step of the deployment: it is what lets the workflow
   * impersonate the account at all. Missing, nothing fails late — everything
   * fails at the first step that authenticates.
   */
  services: [
    {
      name: 'iamcredentials.googleapis.com',
      unlocks:
        'l’usurpation du compte par le workflow — sans elle rien ne s’authentifie',
    },
    {
      name: 'cloudfunctions.googleapis.com',
      unlocks: 'le déploiement des Functions',
    },
    {
      name: 'run.googleapis.com',
      unlocks: 'le service Cloud Run que chaque Function gen 2 est',
    },
    {
      name: 'cloudbuild.googleapis.com',
      unlocks: 'la construction de leur image',
    },
    {
      name: 'artifactregistry.googleapis.com',
      unlocks: 'le stockage de cette image',
    },
    { name: 'eventarc.googleapis.com', unlocks: 'le déclencheur Firestore' },
    { name: 'cloudscheduler.googleapis.com', unlocks: 'le job d’onSchedule' },
    {
      name: 'pubsub.googleapis.com',
      unlocks: 'le sujet sur lequel ce job publie',
    },
    { name: 'secretmanager.googleapis.com', unlocks: 'les cinq secrets' },
  ],
} as const;

export function roleNames(wanted: typeof WANTED = WANTED): string[] {
  return wanted.roles.map((role) => role.name);
}

export function serviceNames(wanted: typeof WANTED = WANTED): string[] {
  return wanted.services.map((service) => service.name);
}

export function accountEmail(wanted: typeof WANTED = WANTED): string {
  return `${wanted.account}@${wanted.project}.iam.gserviceaccount.com`;
}

export function accountMember(wanted: typeof WANTED = WANTED): string {
  return `serviceAccount:${accountEmail(wanted)}`;
}
