import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/membership-record',
  test: {
    name: '@beacon/membership-record',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // Spec files share one Firestore emulator and one collection, `members`,
    // and the client face's suite clears the whole database between tests; run
    // them one at a time so a beforeEach in one file cannot clear data a
    // concurrent file just seeded.
    fileParallelism: false,
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
