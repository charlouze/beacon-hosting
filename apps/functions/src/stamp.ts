import { getFirestore } from 'firebase-admin/firestore';
import { defaultApp } from './firebase-app.js';

/**
 * §10 étape 5: the two fields of `config/settings` the deployment owns.
 *
 * `rulesVersion` is the deployed commit, so a tab left open since yesterday
 * reloads instead of running yesterday's rules against today's database.
 *
 * `agentEndpoint` is where the game machine reports, and it is written here
 * rather than configured because of a loop: it is the url of a function this
 * very deployment creates, so nothing before it can know it. Carried as a
 * function parameter it would need a second deployment to reach the deployed
 * function — the first one cannot be told what it is about to create.
 *
 * A targeted field write, and that is the whole point: the seed by
 * construction never touches an existing document, so it could not carry this,
 * and a whole-document write here would erase the settings an admin edited
 * between two merges. `update` also refuses a `config/settings` that does not
 * exist — the seed runs first, and a missing document means the deployment
 * went wrong upstream.
 */
export async function stamp(
  rulesVersion: string,
  agentEndpoint: string,
): Promise<void> {
  if (rulesVersion === '') {
    throw new Error(
      'no commit reference to stamp — every open tab would reload forever',
    );
  }
  if (agentEndpoint === '') {
    throw new Error(
      'no agent endpoint to stamp — every provisioned machine would report nowhere',
    );
  }
  await getFirestore(defaultApp())
    .doc('config/settings')
    .update({ rulesVersion, agentEndpoint });
}
