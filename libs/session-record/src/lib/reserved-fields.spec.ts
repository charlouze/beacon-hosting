import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, Session } from '@beacon/session';
import { openingFields, RESERVED_FACTS } from './fields.js';

// An ordinary member's opening, which is the one that must go through every
// evening. No `instanceSize`: §5 leaves the template to an admin, and the
// function applies the default from `config/settings`.
const SESSION_OPENED_BY_ALICE = Session.opening(
  {
    sessionId: 's1',
    game: 'enshrouded',
    actor: { uid: 'alice', name: 'Alice' },
  },
  { now: () => new Date('2026-09-06T20:00:00Z') },
  DEFAULT_SETTINGS,
).session;

// The single named list the rules declare, read as text because there is no
// other way across: rules are not TypeScript, and this is the only file in the
// repository that can see both ends of the chain.
function demandedByRules(): string[] {
  const rules = readFileSync(new URL('../../../../firestore.rules', import.meta.url), 'utf8');
  const declaration = /function demandedFields\(\)\s*\{\s*return\s*\[([^\]]*)\]/.exec(rules);
  if (declaration === null) throw new Error('firestore.rules declares no demandedFields()');
  return [...declaration[1].matchAll(/'([^']+)'/g)].map(([, name]) => name);
}

describe('the rules and the record agree on who owns what', () => {
  // A field the record writes and the rules do not demand is an opening
  // refused for every player, every evening. The test costs a line; the defect
  // costs the product.
  it('demands every field an opening writes', () => {
    const written = Object.keys(
      openingFields(SESSION_OPENED_BY_ALICE, 'server-time-sentinel'),
    );
    expect(demandedByRules()).toEqual(expect.arrayContaining(written));
  });

  // The other direction, and the one that leaks rather than breaks. `lastError`
  // is reserved by §5 but deliberately absent from RESERVED_FACTS — the record
  // does not carry it — so it is named here, or nothing would guard it.
  it('demands no field the functions reserve', () => {
    for (const field of [...RESERVED_FACTS, 'lastError']) {
      expect(demandedByRules()).not.toContain(field);
    }
  });

  // `instanceSize` is demanded, but only for an admin. It is neither a
  // reserved fact nor a field every opening writes, so neither test above
  // sees it — and its absence from the rules would silently take the template
  // away from the only person allowed to choose it.
  it('demands the instance size', () => {
    expect(demandedByRules()).toContain('instanceSize');
  });
});
