import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...nx.configs['flat/angular'],
  ...nx.configs['flat/angular-template'],
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'beacon',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'beacon',
          style: 'kebab-case',
        },
      ],
    },
  },
  {
    files: ['**/*.html'],
    // Override or add rules here
    rules: {},
  },
  {
    // §4, and R29: this rule must live beside the project it guards. A
    // root-authored `apps/web/**` glob only matches here because this
    // project currently happens to be linted by the legacy
    // `@nx/eslint:lint` executor, which sets ESLint's `basePath` to the
    // workspace root — `nx` is moving projects to the inferred
    // `@nx/eslint/plugin` target instead, which sets `basePath` to this
    // directory and would make that glob match nothing, silently. Written
    // here as `**/*.ts`, it holds under either integration.
    files: ['**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // `@firebase/*` is the same sdk under its unscoped packages, and
              // reaches Firestore just as directly. Neither `firebase` nor
              // `firebase/app` is barred: the driver calls `initializeApp`
              // from it, and `firebase/auth` becomes legitimate in tranche 4.
              group: [
                'firebase/firestore',
                '@firebase/*',
                'firebase-admin',
                'firebase-admin/*',
              ],
              message:
                'the session context reaches Firestore through a *-record module (§4)',
            },
          ],
        },
      ],
    },
  },
];
