import { describe, expect, it } from 'vitest';
import { fill } from './template.js';

describe('filling a template', () => {
  /**
   * `$&`, `` $` ``, `$'` and `$$` inside a *value* are capture-group syntax to
   * String.replace: it would substitute what surrounds the match, silently,
   * into a document that stays valid yaml. It corrupted a password once.
   *
   * The frontier now refuses a `$` in everything a request carries, which
   * leaves exactly one class of values still holding that syntax, and it is
   * not hypothetical: an entry fills its own scripts into its cloud-init, and
   * `serverid-filter.sh` carries `${id%$'\r'}` while sunkenland's compose and
   * start script carry `` `$` `` in a comment. Nothing refuses those — they
   * are the document, not a request — so this is what covers them.
   */
  it('substitutes nothing of the value it is handed', () => {
    expect(fill('before __M__ after', '__M__', "$& $` $' $$")).toBe("before $& $` $' $$ after");
  });
});
