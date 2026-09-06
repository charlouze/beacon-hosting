import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    ignores: ['**/out-tsc'],
  },
  {
    // §9 of the spec, as a lint rule and not a test: the decision core must run
    // in a browser, in a Function and in a test with no infrastructure at all.
    // The day a client library reaches in here, §4's claim that swapping the
    // store costs one adapter stops being true, and nothing else would say so.
    //
    // It lives here and not in the root config because this project is linted
    // by the inferred `@nx/eslint/plugin` target, which runs `eslint .` with
    // `cwd` at this directory and lets ESLint auto-discover its config file —
    // so ESLint sets `basePath` to this directory, and a `libs/session/**`
    // glob written at the root would resolve to `libs/session/libs/session/**`
    // and match nothing. A root-authored glob is not inherently dead: `nx`'s
    // other lint integration, the legacy `@nx/eslint:lint` executor, chdirs to
    // the workspace root and hands ESLint an already-resolved config path,
    // which sets `basePath` there instead — a root-authored glob works for
    // whichever project that executor happens to lint. Rely on that and the
    // day a project migrates from one integration to the other, its coverage
    // silently moves with it.
    files: ['**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'firebase',
                'firebase/*',
                'firebase-admin',
                'firebase-admin/*',
                '@firebase/*',
              ],
              message:
                'libs/session ne connait pas Firestore : passer par un module *-record.',
            },
            {
              group: ['@scaleway/*'],
              message:
                'libs/session ne connait pas l hebergeur : passer par le port ServerHost.',
            },
          ],
        },
      ],
    },
  },
];
