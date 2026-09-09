import { getFirestore } from 'firebase-admin/firestore';
import { defaultApp } from './firebase-app.js';

/**
 * §10 étape 5: the deployed commit, written on `config/settings` so a tab left
 * open since yesterday reloads instead of running yesterday's rules against
 * today's database.
 *
 * A targeted field write, and that is the whole point: the seed by
 * construction never touches an existing document, so it could not carry this,
 * and a whole-document write here would erase the settings an admin edited
 * between two merges. `update` also refuses a `config/settings` that does not
 * exist — the seed runs first, and a missing document means the deployment
 * went wrong upstream.
 */
export async function stamp(rulesVersion: string): Promise<void> {
  if (rulesVersion === '') {
    throw new Error('no commit reference to stamp — every open tab would reload forever');
  }
  await getFirestore(defaultApp()).doc('config/settings').update({ rulesVersion });
}
