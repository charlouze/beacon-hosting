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
            // The catalogue knows images, ports and command-line options. It
            // needs the domain for `Game` and `JoinInfo`, and nothing else —
            // an adapter it could reach would let a provider's word back in
            // through the one place §4 keeps free of it.
            {
              sourceTag: 'scope:catalog',
              onlyDependOnLibsWithTags: ['scope:domain'],
            },
            // The wire format between the machine and the control plane. It
            // needs the domain to name a session and a state, and nothing else
            // — an adapter it could reach would let a provider's word travel on
            // a wire the least trusted element of the system writes.
            {
              sourceTag: 'scope:protocol',
              onlyDependOnLibsWithTags: ['scope:domain'],
            },
            { sourceTag: 'scope:rules', onlyDependOnLibsWithTags: [] },
            {
              sourceTag: 'scope:app',
              onlyDependOnLibsWithTags: [
                'scope:domain',
                'scope:record',
                'scope:adapter',
                'scope:catalog',
                'scope:protocol',
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
