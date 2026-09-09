import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MODULE, renderRulesVersion } from './rules-version.js';

describe('the deployment stamp', () => {
  it('renders a module the bundle can compile', () => {
    expect(renderRulesVersion('9c1f2e3')).toContain(
      "export const COMPILED_RULES_VERSION = '9c1f2e3';",
    );
  });

  // The value ends up in a string literal in a file the build reads. A quote in
  // it would not fail the stamp, it would fail the build, hours later.
  it('refuses anything that is not a commit reference', () => {
    expect(() => renderRulesVersion("' + evil + '")).toThrow();
    expect(() => renderRulesVersion('')).toThrow();
  });

  // The preamble lives twice: here, and in the module this tool overwrites.
  // Nothing else holds the two together, so an edit to one would be erased by
  // the next deployment without a word — and "one line changes" would go back
  // to being something a human checks by hand.
  it('renders the module the repository holds, to the value', () => {
    const inRepository = readFileSync(MODULE, 'utf8');

    expect(inRepository).toContain("export const COMPILED_RULES_VERSION = 'dev';");
    expect(renderRulesVersion('9c1f2e3')).toBe(
      inRepository.replace(
        "COMPILED_RULES_VERSION = 'dev';",
        "COMPILED_RULES_VERSION = '9c1f2e3';",
      ),
    );
  });
});
