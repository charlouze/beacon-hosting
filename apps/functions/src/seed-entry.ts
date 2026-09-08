import { seed } from './seed.js';

// Kept out of seed.ts so that module never runs itself just from being
// imported — as the test does.
seed().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
