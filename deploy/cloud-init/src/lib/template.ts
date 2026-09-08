/**
 * How a catalogue entry turns its templates into a document. Shared by every
 * entry rather than copied into each: `fill` below carries a subtlety that
 * corrupted a password once, and a second copy of it is a copy that gets fixed
 * on one side only.
 */

/** The marker sits six spaces in, so only the following lines get indented. */
export function indent(text: string): string {
  return text
    .trimEnd()
    .split('\n')
    .map((line, index) => (index === 0 || line === '' ? line : `      ${line}`))
    .join('\n');
}

/**
 * A function replacement, and every occurrence: `$&`, `` $` `` and `$'` inside
 * a password are capture-group syntax to String.replace, and would be
 * substituted silently. The server then boots with a password nobody has.
 */
export function fill(template: string, marker: string, value: string): string {
  return template.replaceAll(marker, () => value);
}
