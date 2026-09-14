/**
 * `--name=value` and `--name`, and nothing more elaborate: both gestures are
 * run by hand from a shell, and a parser with a schema would be a dependency
 * carrying an administration key for no capability gained.
 */
export function argValue(argv: readonly string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

export function hasFlag(argv: readonly string[], name: string): boolean {
  return argv.includes(`--${name}`);
}
