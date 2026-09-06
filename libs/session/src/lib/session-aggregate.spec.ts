import { describe, expect, it } from 'vitest';
import { Deadline } from './deadline.js';
import { Session } from './session-aggregate.js';
import { DEFAULT_SETTINGS } from './settings.js';

const at = (iso: string) => ({ now: () => new Date(iso) });
const S = DEFAULT_SETTINGS;
const ACTOR = { uid: 'u1', name: 'Alice' };

const running = (deadlineIso: string) =>
  Session.from({
    state: 'RUNNING',
    sessionId: 's1',
    game: 'enshrouded',
    startedBy: 'u1',
    startedAt: new Date('2026-09-06T20:00:00Z'),
    deadline: Deadline.at(new Date(deadlineIso)),
    instanceSize: 'DEV1-L',
    hasJoinInfo: true,
  });

describe('Session', () => {
  it('opens from nothing with a deadline one session duration ahead', () => {
    const opened = Session.opening(
      { sessionId: 's1', game: 'enshrouded', actor: ACTOR },
      at('2026-09-06T20:00:00Z'),
      S,
    );
    expect(opened.session.state).toBe('PROVISIONING');
    expect(opened.session.deadline.at).toEqual(new Date('2026-09-07T00:00:00Z'));
    expect(opened.events).toEqual([
      { type: 'SessionStarted', sessionId: 's1', detail: 'Alice opened enshrouded' },
    ]);
  });

  // §5: `instanceSize` is an admin's field. A member's opening must record
  // none at all — the function applies the deployed default, and tranche 4's
  // rules would refuse the write outright.
  it('records no size when nobody chose one', () => {
    const opened = Session.opening(
      { sessionId: 's1', game: 'enshrouded', actor: ACTOR },
      at('2026-09-06T20:00:00Z'),
      S,
    );
    expect(opened.session.instanceSize).toBeNull();
    expect(opened.session.estimatedCost(at('2026-09-06T21:00:00Z'), S)).toBe(0);
  });

  it('refuses to extend outside the window', () => {
    const session = running('2026-09-07T00:00:00Z');
    expect(session.canExtend(at('2026-09-06T22:00:00Z'), S)).toBe(false);
    expect(() => session.extend(ACTOR, at('2026-09-06T22:00:00Z'), S)).toThrow(
      /extension window/,
    );
  });

  // Extending is a collective act on a shared resource, not a counter each
  // person increments (§6): two clicks in the same second write the same
  // value, and the session gains one hour rather than two.
  it('extends by one step inside the window, and audits it', () => {
    const session = running('2026-09-07T00:00:00Z');
    const extended = session.extend(ACTOR, at('2026-09-06T23:45:00Z'), S);
    expect(extended.session.deadline.at).toEqual(new Date('2026-09-07T01:00:00Z'));
    expect(extended.events).toEqual([
      { type: 'SessionExtended', sessionId: 's1', detail: 'Alice extended to 01:00 UTC' },
    ]);
  });

  it('refuses a transition the state machine does not draw', () => {
    const idle = Session.idle();
    expect(idle.canRequestStop()).toBe(false);
    expect(() => idle.requestStop(ACTOR, at('2026-09-06T20:00:00Z'))).toThrow(/IDLE/);
  });

  it('requests a stop from RUNNING, and keeps who asked', () => {
    const stopped = running('2026-09-07T00:00:00Z').requestStop(
      ACTOR,
      at('2026-09-06T22:00:00Z'),
    );
    expect(stopped.session.state).toBe('STOPPING');
    expect(stopped.events).toEqual([
      { type: 'SessionStopRequested', sessionId: 's1', detail: 'Alice asked to stop' },
    ]);
  });

  // §4: the shown value is already the one the watchdog converges to, so the
  // countdown never walks backwards.
  it('shows a forged deadline already brought back to the bound', () => {
    const session = running('2026-09-07T08:00:00Z');
    expect(session.displayedDeadline(at('2026-09-06T20:00:00Z'), S).at).toEqual(
      new Date('2026-09-07T00:00:00Z'),
    );
  });

  // §11: the started hour is due, on each resource separately, and the rate
  // of a size already adds the three lines up.
  it('charges the started hour, never the fraction', () => {
    const session = running('2026-09-07T00:00:00Z');
    expect(session.estimatedCost(at('2026-09-06T20:01:00Z'), S)).toBeCloseTo(0.05, 2);
    expect(session.estimatedCost(at('2026-09-06T23:30:00Z'), S)).toBeCloseTo(0.22, 2);
  });

  it('charges nothing for a size no tariff names', () => {
    const session = Session.from({
      state: 'RUNNING',
      sessionId: 's1',
      game: 'enshrouded',
      startedBy: 'u1',
      startedAt: new Date('2026-09-06T20:00:00Z'),
      deadline: Deadline.at(new Date('2026-09-07T00:00:00Z')),
      instanceSize: 'GP1-XS',
      hasJoinInfo: true,
    });
    expect(session.estimatedCost(at('2026-09-06T21:00:00Z'), S)).toBe(0);
  });
});
