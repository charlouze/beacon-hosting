import { describe, expect, it } from 'vitest';
import { parseReport } from './report.js';

describe('parseReport', () => {
  it('reads the heartbeat, which carries nothing but a session', () => {
    expect(parseReport({ sessionId: 's1', phase: 'alive' })).toEqual({
      sessionId: 's1',
      phase: 'alive',
    });
  });

  // §6 étape 7: the ip corroborates and is never followed. It travels because
  // a mismatch is an incident worth filing, not because anything acts on it.
  it('reads the readiness, and the address it merely corroborates', () => {
    expect(parseReport({ sessionId: 's1', phase: 'ready', ip: '51.15.42.7' })).toEqual({
      sessionId: 's1',
      phase: 'ready',
      ip: '51.15.42.7',
    });
  });

  it('reads a deposit, with the key, the size and the origin it claims', () => {
    const save = {
      objectKey: 'saves/enshrouded/pre-shutdown/s1/x.tar.gz',
      sizeBytes: 50_000,
      origin: 'pre-shutdown',
    };
    expect(parseReport({ sessionId: 's1', phase: 'saved', save })).toEqual({
      sessionId: 's1',
      phase: 'saved',
      save,
    });
  });

  // The origin travels rather than being derived on the other side, because the
  // machine already wrote it into the object key — the adapter that deposits
  // builds the key (§5). Deriving it twice is how the record and the key end up
  // disagreeing about the same archive. What a lying machine gains is a
  // pruning window, which is bounded and visible.
  it('refuses an origin the vocabulary does not have', () => {
    expect(
      parseReport({
        sessionId: 's1',
        phase: 'saved',
        save: { objectKey: 'k', sizeBytes: 50_000, origin: 'forever' },
      }),
    ).toBeNull();
  });

  // This is an anti-corruption layer (§4) and the machine on the other side is
  // the least trusted element of the system (§7). Everything it does not
  // recognise, it refuses — it never repairs, and it never passes through.
  it('refuses a phase it does not know', () => {
    expect(parseReport({ sessionId: 's1', phase: 'RUNNING' })).toBeNull();
  });

  it('refuses a report with no session', () => {
    expect(parseReport({ phase: 'alive' })).toBeNull();
    expect(parseReport({ sessionId: 42, phase: 'alive' })).toBeNull();
  });

  it('refuses what is not an object at all', () => {
    expect(parseReport(null)).toBeNull();
    expect(parseReport('alive')).toBeNull();
  });

  // A deposit whose size is not a number would reach `Save.of` as NaN, and NaN
  // passes no comparison — including the floor. Refused at the frontier.
  it('refuses a deposit whose size is not a number', () => {
    expect(
      parseReport({
        sessionId: 's1',
        phase: 'saved',
        save: { objectKey: 'k', sizeBytes: 'big', origin: 'auto' },
      }),
    ).toBeNull();
  });

  // Bounded, like every string a client writes (§5). An unbounded detail on a
  // public endpoint is a way to make somebody else's bill grow.
  it('refuses a detail longer than the bound', () => {
    expect(parseReport({ sessionId: 's1', phase: 'failed', detail: 'x'.repeat(1025) })).toBeNull();
  });
});
