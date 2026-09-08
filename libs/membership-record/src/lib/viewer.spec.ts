import { describe, expect, it } from 'vitest';
import { viewerFrom } from './viewer.js';

const ALICE = { uid: 'alice', name: 'Alice' };

describe('who is at the keyboard', () => {
  it('is signed out when there is no identity', () => {
    expect(viewerFrom(null, null)).toEqual({ kind: 'signed-out' });
  });

  // PRODUCT.md: "un visiteur non autorisé existe et doit être traité". The
  // identity travels with it because the screen greets a person, not a uid.
  it('is a visitor when the identity has no member document', () => {
    expect(viewerFrom(ALICE, null)).toEqual({ kind: 'visitor', identity: ALICE });
  });

  it('is a member when the document names a role', () => {
    expect(viewerFrom(ALICE, { role: 'player', email: 'alice@example.com' })).toEqual({
      kind: 'member',
      member: { uid: 'alice', name: 'Alice', role: 'player', steamId: null },
    });
  });

  it('reads the admin role as itself', () => {
    expect(viewerFrom(ALICE, { role: 'admin' })).toEqual({
      kind: 'member',
      member: { uid: 'alice', name: 'Alice', role: 'admin', steamId: null },
    });
  });

  // The name is the Google profile's, never the document's: `members` carries
  // an email, which is not a name, and §5 protects it rather than displaying
  // it.
  it('takes the name from the identity and never from the document', () => {
    const viewer = viewerFrom(ALICE, { role: 'player', name: 'Someone Else' });
    expect(viewer).toEqual({
      kind: 'member',
      member: { uid: 'alice', name: 'Alice', role: 'player', steamId: null },
    });
  });

  it('carries the declared steam id, and nothing else about it', () => {
    expect(viewerFrom(ALICE, { role: 'player', steamId: '76561197965918116' })).toEqual({
      kind: 'member',
      member: { uid: 'alice', name: 'Alice', role: 'player', steamId: '76561197965918116' },
    });
  });

  // Never repaired, never invented. A role this vocabulary does not know says
  // nothing about what its holder may do, so the answer is the honest one.
  it('refuses to guess at a role it does not know', () => {
    expect(viewerFrom(ALICE, { role: 'moderator' })).toEqual({ kind: 'visitor', identity: ALICE });
    expect(viewerFrom(ALICE, { email: 'alice@example.com' })).toEqual({
      kind: 'visitor',
      identity: ALICE,
    });
  });
});
