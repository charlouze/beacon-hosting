import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/functions',
  test: {
    name: '@beacon/functions',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    passWithNoTests: true,
    // Spec files share one Firestore emulator and overlapping top-level
    // collections (provisioning, events); run them one at a time so a
    // beforeEach in one file cannot clear data a concurrent file just wrote.
    fileParallelism: false,
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
