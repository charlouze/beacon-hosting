import { describe, expect, it } from 'vitest';
import { isPlausibleSaveSize, Save, SAVE_FLOOR_BYTES } from './save.js';

const FIELDS = {
  createdAt: new Date('2026-09-07T20:00:00Z'),
  game: 'enshrouded' as const,
  objectKey: 'saves/enshrouded/pre-shutdown/s1/2026-09-07T20-00-00Z.tar.gz',
  sizeBytes: 31_374,
  origin: 'pre-shutdown' as const,
};

describe('Save', () => {
  // 31 374 octets is the smallest real world tranche 0 ever measured. The floor
  // has to sit well under it, or an honest save gets refused on a slow evening.
  it('accepts the smallest world ever measured', () => {
    expect(Save.of(FIELDS).sizeBytes).toBe(31_374);
  });

  // §8: the one invariant whose violation destroys something irreplaceable.
  // An empty zip is 22 bytes, so a floor of one kibibyte sits an order of
  // magnitude above nothing and an order below the smallest real save.
  it('refuses an archive under the floor, and says which floor', () => {
    expect(() => Save.of({ ...FIELDS, sizeBytes: SAVE_FLOOR_BYTES - 1 })).toThrow(
      /1024/,
    );
  });

  it('refuses an archive of nothing at all', () => {
    expect(() => Save.of({ ...FIELDS, sizeBytes: 0 })).toThrow(/1024/);
  });

  // The predicate exists because the companion has to ask *before* pushing:
  // acting and catching would mean the suspect archive already left the
  // machine. Same rule, same constant, two callers (§8, defenses 1 and 3).
  it('answers the same question without throwing', () => {
    expect(isPlausibleSaveSize(SAVE_FLOOR_BYTES)).toBe(true);
    expect(isPlausibleSaveSize(SAVE_FLOOR_BYTES - 1)).toBe(false);
  });

  it('is a value: the instant it carries cannot be moved by its caller', () => {
    const createdAt = new Date('2026-09-07T20:00:00Z');
    const save = Save.of({ ...FIELDS, createdAt });
    createdAt.setFullYear(1999);
    expect(save.createdAt).toEqual(new Date('2026-09-07T20:00:00Z'));
  });
});
