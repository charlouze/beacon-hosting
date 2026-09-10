import { defineConfig } from 'vitest/config';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/libs/rules',
  test: {
    name: '@beacon/rules',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    // Every rules suite clears the same emulator and re-seeds the same
    // `members`, so two of them at once make each other fail — and they fail as
    // a refusal, which is what a rules suite expects to see. Run one file at a
    // time, as `libs/session-record` already does for the same emulator.
    fileParallelism: false,
    reporters: ['default'],
    coverage: {
      reportsDirectory: './test-output/vitest/coverage',
      provider: 'v8' as const,
    },
  },
}));
