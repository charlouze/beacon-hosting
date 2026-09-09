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
              // reaches Firestore just as directly.
              //
              // `firebase/auth` is barred for the same reason as Firestore, and
              // it took a decision to see it: signing in looks like the screen's
              // business, but the `Actor` of every event is built from the
              // profile it returns, so a screen holding the Auth sdk holds the
              // identity too. It lives in `libs/membership-record`, behind
              // `connectMembershipRecord`.
              //
              // `firebase/app` stays allowed: `main.ts` calls `initializeApp`,
              // which names no document and reads nothing.
              group: [
                'firebase/firestore',
                'firebase/auth',
                '@firebase/*',
                'firebase-admin',
                'firebase-admin/*',
              ],
              message:
                'this project reaches Firestore and Auth through a *-record module (§4)',
            },
          ],
        },
      ],
    },
  },
];
