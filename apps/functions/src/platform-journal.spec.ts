import { describe, expect, it } from 'vitest';
import { expunged, type JournalledFailure, type PlatformJournal } from './platform-journal.js';

const SECRET = 'a'.repeat(64);

const recording = () => {
  const entries: JournalledFailure[] = [];
  const journal: PlatformJournal = { failure: (entry) => entries.push(entry) };
  return { entries, journal };
};

describe('expunged', () => {
  it('hands back the failure without its secret', () => {
    const { journal } = recording();
    const readable = expunged(journal, 'provisioning.setup', 's1', new Error(`user data rejected: BEACON_TOKEN=${SECRET}`));
    expect(readable).not.toContain(SECRET);
    expect(readable).toContain('[redacted]');
  });

  it('writes the whole failure to the platform journal, with where it came from', () => {
    const { entries, journal } = recording();
    expunged(journal, 'watchdog.close', 's1', new Error(`refused: SCW_SECRET_KEY=${SECRET}`));
    expect(entries).toEqual([
      { source: 'watchdog.close', sessionId: 's1', error: `Error: refused: SCW_SECRET_KEY=${SECRET}` },
    ]);
  });

  it('journals a failure no session explains', () => {
    const { entries, journal } = recording();
    expunged(journal, 'watchdog.sweep', null, new Error('the listing was refused'));
    expect(entries[0].sessionId).toBeNull();
  });

  it('takes a thrown value that is not an Error', () => {
    const { entries, journal } = recording();
    expect(expunged(journal, 'agentReport.dns', 's1', `nochg ${SECRET}`)).toBe('nochg [redacted]');
    expect(expunged(journal, 'agentReport.dns', 's1', { code: 503 })).toBe('[object Object]');
    expect(entries).toHaveLength(2);
  });

  it('masks a secret on any line of a multi-line failure', () => {
    const { journal } = recording();
    const readable = expunged(journal, 'provisioning.setup', 's1', new Error(`invalid user data\n  BEACON_TOKEN=${SECRET}\n  at line 12`));
    expect(readable).not.toContain(SECRET);
    expect(readable).toContain('at line 12');
  });

  it('bounds what it hands back and keeps the whole text in the journal', () => {
    const { entries, journal } = recording();
    const long = 'refused '.repeat(200);
    expect(expunged(journal, 'provisioning.cleanup', 's1', long).length).toBeLessThan(600);
    expect(entries[0].error).toBe(long);
  });
});
