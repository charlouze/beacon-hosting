import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.contract.spec.ts'],
    root: import.meta.dirname,
    // One billed hour on three lines is at stake; nothing here runs twice at
    // once against the same account.
    fileParallelism: false,
  },
});
