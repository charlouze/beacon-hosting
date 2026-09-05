import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc', '**/vitest.config.*.timestamp*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            // The decision core depends on nothing of ours: it declares the
            // ports, it never reaches for an implementation.
            {
              sourceTag: 'scope:domain',
              onlyDependOnLibsWithTags: ['scope:domain'],
            },
            {
              sourceTag: 'scope:record',
              onlyDependOnLibsWithTags: ['scope:domain'],
            },
            {
              sourceTag: 'scope:adapter',
              onlyDependOnLibsWithTags: ['scope:domain'],
            },
            { sourceTag: 'scope:rules', onlyDependOnLibsWithTags: [] },
            {
              sourceTag: 'scope:app',
              onlyDependOnLibsWithTags: [
                'scope:domain',
                'scope:record',
                'scope:adapter',
              ],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
