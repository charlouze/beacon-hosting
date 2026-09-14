import { personas } from './personas.js';

// Kept out of personas.ts so that module never runs itself just from being
// imported — as the test does.
personas().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
