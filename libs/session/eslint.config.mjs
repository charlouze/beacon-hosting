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
    // It lives here and not in the root config because flat-config `files`
    // globs resolve against the base path of the config file that ESLint
    // loaded, and `nx lint` runs `eslint .` from this directory: a
    // `libs/session/**` glob written at the root never matches anything.
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
