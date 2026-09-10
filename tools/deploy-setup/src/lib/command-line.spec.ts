import { commandLine } from './command-line.js';

describe('commandLine', () => {
  it('quotes every argument, so that an operator can paste what it printed', () => {
    expect(commandLine('gcloud', ['services', 'list', '--enabled'])).toBe(
      'gcloud "services" "list" "--enabled"',
    );
  });

  // The condition holds `&&`, which cmd.exe reads as a command separator and
  // sh reads as one too. Unquoted, gcloud is handed a condition that stops at
  // the repository and the shell tries to run the rest — and a provider that
  // pins the repository but not the branch is the exact hole this tool exists
  // to close, wearing the face of a successful command.
  it('keeps an && inside an argument out of the shell', () => {
    const condition =
      "assertion.repository=='a/b' && assertion.ref=='refs/heads/main'";

    expect(commandLine('gcloud', [`--attribute-condition=${condition}`])).toBe(
      `gcloud "--attribute-condition=${condition}"`,
    );
  });

  // Double quotes are what the quoting above relies on, `$` and backticks are
  // what sh expands inside them. None can appear in any argument this tool
  // builds, so the honest move is to refuse rather than to invent an escaping
  // dialect that differs between the two shells it runs on.
  it('refuses an argument it cannot quote for both shells', () => {
    expect(() => commandLine('gcloud', ['--title=say "hi"'])).toThrow(
      /ne peut pas être protégé/,
    );
    expect(() => commandLine('gcloud', ['--title=$HOME'])).toThrow(
      /ne peut pas être protégé/,
    );
  });
});
