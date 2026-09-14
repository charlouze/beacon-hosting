import { screen } from './screen.js';

// The only place that reads the command line and the clock; kept out of
// screen.ts so that module never runs itself just from being imported — and so
// `screenFixture` stays assertable.
screen(process.argv[2] ?? '', new Date()).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
