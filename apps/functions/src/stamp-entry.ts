import { stamp } from './stamp.js';

// The only place that reads the command line; kept out of stamp.ts so that
// module never runs itself just from being imported — as the test does.
stamp(process.argv[2] ?? '', process.argv[3] ?? '').catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
