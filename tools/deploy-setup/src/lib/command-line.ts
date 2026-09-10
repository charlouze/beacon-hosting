/**
 * What sh expands inside double quotes, plus the quote character itself. An
 * argument carrying any of them cannot be quoted the same way for cmd.exe and
 * for sh, and this tool never needs one.
 */
const UNQUOTABLE = /["$`]/;

/**
 * One command line, every argument double-quoted, for a shell on either
 * platform.
 *
 * It goes through a shell at all because of Windows: `gcloud` is a `.cmd`
 * there, and node refuses to spawn a `.cmd` without one. That constraint makes
 * quoting this tool's problem rather than node's, and the argument that makes
 * it matter is the OIDC condition — it holds `&&`, which both shells read as a
 * separator.
 *
 * The same string is what gets printed before the gesture runs, which is the
 * second reason it exists: what the operator reads is what was executed, not a
 * rendering of it.
 */
export function commandLine(program: string, args: readonly string[]): string {
  for (const arg of args) {
    if (UNQUOTABLE.test(arg)) {
      throw new Error(
        `cet argument ne peut pas être protégé pour les deux shells : ${arg}`,
      );
    }
  }
  return [program, ...args.map((arg) => `"${arg}"`)].join(' ');
}
