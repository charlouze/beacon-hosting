import { describe, expect, it } from 'vitest';
import { awaitsCopyReplacement, type PublisherReading } from './copy-replacement.js';
import { gameVersionFrom, type GameVersion } from './game-version.js';
import type { GameCopy } from './preflight.js';
import type { AbandonedSetup } from './setup.js';

const version = (digits: string): GameVersion => {
  const built = gameVersionFrom(digits);
  if (built === null) throw new Error(`not a version: ${digits}`);
  return built;
};

const at = (hhmm: string) => new Date(`2026-10-15T${hhmm}:00Z`);
const copy = (digits: string, depositedAt: string): GameCopy => ({ version: version(digits), depositedAt: at(depositedAt) });
const reading = (digits: string, readAt: string): PublisherReading => ({ version: version(digits), readAt: at(readAt) });
const abandoned = (when: string, cause: AbandonedSetup['cause']): AbandonedSetup => ({ sessionId: 's1', at: at(when), cause });

describe('awaitsCopyReplacement', () => {
  describe('from the last reading of the publisher', () => {
    it('waits when the reading follows the deposit and finds another version', () => {
      expect(
        awaitsCopyReplacement({ copy: copy('100', '18:00'), lastReading: reading('200', '19:00'), abandoned: null }),
      ).toBe(true);
    });

    it('does not wait when the reading finds the version deposited', () => {
      expect(
        awaitsCopyReplacement({ copy: copy('200', '18:00'), lastReading: reading('200', '19:00'), abandoned: null }),
      ).toBe(false);
    });

    // Any deposit gives the button back; the next reading decides again.
    it('does not wait once a deposit follows the reading, whatever it deposited', () => {
      expect(
        awaitsCopyReplacement({ copy: copy('100', '20:00'), lastReading: reading('200', '19:00'), abandoned: null }),
      ).toBe(false);
    });

    it('does not wait when the deposit and the reading fall on the same instant', () => {
      expect(
        awaitsCopyReplacement({ copy: copy('100', '19:00'), lastReading: reading('200', '19:00'), abandoned: null }),
      ).toBe(false);
    });

    it('waits when no deposit is recorded at all', () => {
      expect(awaitsCopyReplacement({ copy: null, lastReading: reading('200', '19:00'), abandoned: null })).toBe(true);
    });

    it('does not wait while nothing was ever read', () => {
      expect(awaitsCopyReplacement({ copy: copy('100', '18:00'), lastReading: null, abandoned: null })).toBe(false);
      expect(awaitsCopyReplacement({ copy: null, lastReading: null, abandoned: null })).toBe(false);
    });
  });

  describe('after a setup abandoned for a behind copy', () => {
    // The preflight check read the publisher; recording what it read may have failed.
    it('waits when nothing follows the abandon, even with no reading recorded', () => {
      expect(
        awaitsCopyReplacement({ copy: copy('100', '18:00'), lastReading: null, abandoned: abandoned('20:14', 'copy-behind') }),
      ).toBe(true);
    });

    it('waits when the only recorded reading precedes the abandon and found the copy current', () => {
      expect(
        awaitsCopyReplacement({
          copy: copy('100', '18:00'),
          lastReading: reading('100', '19:00'),
          abandoned: abandoned('20:14', 'copy-behind'),
        }),
      ).toBe(true);
    });

    it('does not wait once a deposit follows the abandon', () => {
      expect(
        awaitsCopyReplacement({
          copy: copy('200', '20:30'),
          lastReading: reading('200', '20:14'),
          abandoned: abandoned('20:14', 'copy-behind'),
        }),
      ).toBe(false);
    });

    it('leaves it to a reading that follows the abandon', () => {
      const facts = { copy: copy('100', '18:00'), abandoned: abandoned('20:14', 'copy-behind') };
      expect(awaitsCopyReplacement({ ...facts, lastReading: reading('100', '21:00') })).toBe(false);
      expect(awaitsCopyReplacement({ ...facts, lastReading: reading('200', '21:00') })).toBe(true);
    });

    it('waits when no deposit was ever recorded', () => {
      expect(
        awaitsCopyReplacement({ copy: null, lastReading: null, abandoned: abandoned('20:14', 'copy-behind') }),
      ).toBe(true);
    });

    it('does not let a deposit or a reading at the very instant of the abandon follow it', () => {
      expect(
        awaitsCopyReplacement({ copy: copy('200', '20:14'), lastReading: null, abandoned: abandoned('20:14', 'copy-behind') }),
      ).toBe(true);
      expect(
        awaitsCopyReplacement({
          copy: copy('100', '18:00'),
          lastReading: reading('100', '20:14'),
          abandoned: abandoned('20:14', 'copy-behind'),
        }),
      ).toBe(true);
    });

    it('reads nothing into an abandon for another cause, or for none', () => {
      const facts = { copy: copy('100', '18:00'), lastReading: reading('100', '19:00') };
      expect(awaitsCopyReplacement({ ...facts, abandoned: abandoned('20:14', 'version-unreadable') })).toBe(false);
      expect(awaitsCopyReplacement({ ...facts, abandoned: abandoned('20:14', null) })).toBe(false);
    });
  });
});
