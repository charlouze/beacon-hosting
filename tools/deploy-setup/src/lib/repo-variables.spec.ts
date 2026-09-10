import { readFileSync } from 'node:fs';
import {
  DEPLOY_WORKFLOW,
  ENV_EXAMPLE,
  defaultsIn,
  variablesReadBy,
} from './repo-variables.js';

describe('variablesReadBy', () => {
  it('names each variable once, in the order the workflow first reads it', () => {
    const workflow = `
      env:
        FIREBASE_PROJECT_ID: \${{ vars.FIREBASE_PROJECT_ID }}
        SCW_ZONE: \${{ vars.SCW_ZONE }}
      run: |
        echo \${{ vars.SCW_ZONE }}
        echo \${{ secrets.NOT_A_VARIABLE }}
    `;

    expect(variablesReadBy(workflow)).toEqual([
      'FIREBASE_PROJECT_ID',
      'SCW_ZONE',
    ]);
  });

  // Read from the workflow rather than listed here, for the reason
  // `tools/dev-secrets.mjs` exists to illustrate: a list kept beside the thing
  // it mirrors drifts, and the drift shows up as a deployment that goes green
  // on a configuration no session can use.
  it('finds the ten the deployment actually reads', () => {
    const names = variablesReadBy(readFileSync(DEPLOY_WORKFLOW, 'utf8'));

    expect(names).toContain('WIF_PROVIDER');
    expect(names).toHaveLength(10);
  });

  // The eleventh was AGENT_ENDPOINT, and it is gone from the workflow rather
  // than skipped here: the deployment reads its own address back and stamps it
  // on config/settings (§4). Nothing has to be told, so nothing has to be set.
  it('no longer reads an address the deployment discovers itself', () => {
    expect(variablesReadBy(readFileSync(DEPLOY_WORKFLOW, 'utf8'))).not.toContain('AGENT_ENDPOINT');
  });
});

describe('defaultsIn', () => {
  it('takes the value an example file spells out, and ignores the empty ones', () => {
    const example = [
      'SCW_ACCESS_KEY=',
      'SCW_ZONE=fr-par-1',
      '# a comment',
      '',
    ].join('\n');

    expect(defaultsIn(example)).toEqual({ SCW_ZONE: 'fr-par-1' });
  });

  it('reads the four the repository already spells in clear', () => {
    const defaults = defaultsIn(readFileSync(ENV_EXAMPLE, 'utf8'));

    expect(defaults).toEqual({
      SCW_ZONE: 'fr-par-1',
      S3_ENDPOINT: 'https://s3.fr-par.scw.cloud',
      SAVES_BUCKET: 'beacon-saves',
      GAMES_BUCKET: 'beacon-games',
    });
  });
});
