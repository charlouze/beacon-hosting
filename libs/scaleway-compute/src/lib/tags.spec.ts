import { describe, expect, it } from 'vitest';
import { OWNERSHIP_TAG, readSessionTag, sessionTag } from './tags.js';

describe('readSessionTag', () => {
  it('finds the session a resource is tagged for', () => {
    expect(readSessionTag([OWNERSHIP_TAG, sessionTag('sess1')])).toBe('sess1');
  });

  it('reads nothing from a resource that carries only the ownership tag', () => {
    expect(readSessionTag([OWNERSHIP_TAG])).toBeNull();
  });

  it('reads nothing from a resource with no tags at all', () => {
    expect(readSessionTag([])).toBeNull();
  });

  // A bare `session:` names no session. Reading it as the empty string would
  // make it a session id, and close('') would ask the provider a question with
  // no answer; reading it as null hands it to the unclaimed sweep, which is
  // where a resource nobody can name belongs.
  it('reads an empty session tag as no session at all', () => {
    expect(readSessionTag([OWNERSHIP_TAG, 'session:'])).toBeNull();
  });

  it('is not fooled by a tag that merely contains the prefix', () => {
    expect(readSessionTag(['not-a-session:sess1'])).toBeNull();
  });

  it('reads no session from a longer tag set that carries none', () => {
    expect(readSessionTag([OWNERSHIP_TAG, 'someone-else', 'other-tag'])).toBeNull();
  });

  it('reads the one session tag among several unrelated tags', () => {
    expect(readSessionTag(['a', 'b', sessionTag('sess1'), 'c'])).toBe('sess1');
  });

  it('resolves to the well-formed tag when a bare session: prefix accompanies it', () => {
    expect(readSessionTag(['session:', sessionTag('real')])).toBe('real');
  });

  // Two distinct session tags is a malformed set nothing in this tranche can
  // write, but a wrong guess here is a destruction, not a display glitch —
  // see the comment on readSessionTag.
  it('reads no session when two distinct session tags conflict', () => {
    expect(readSessionTag([sessionTag('sess1'), sessionTag('sess2')])).toBeNull();
  });

  it('resolves when the same session tag is repeated', () => {
    expect(readSessionTag([sessionTag('sess1'), sessionTag('sess1')])).toBe('sess1');
  });
});
