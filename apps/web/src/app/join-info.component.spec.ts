import { TestBed } from '@angular/core/testing';
import { Deadline, Session } from '@beacon/session';
import { JoinInfoComponent } from './join-info.component';

/**
 * The only shape this driver renders that does not need a live emulator: a
 * pure function of `session().state`. `App` itself constructs a real
 * connection in its field initializer and is exercised against the emulator
 * instead — by hand for now (task 9), by task 13's evening for real.
 */
describe('JoinInfoComponent', () => {
  it('says nothing before a join point exists', async () => {
    const fixture = TestBed.createComponent(JoinInfoComponent);
    fixture.componentRef.setInput('session', Session.idle());
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });

  it('reports the join point published once the session is running', async () => {
    const running = Session.from({
      state: 'RUNNING',
      sessionId: 'sess1',
      game: 'enshrouded',
      startedBy: 'alice',
      startedAt: new Date(),
      deadline: Deadline.at(new Date(Date.now() + 3_600_000)),
      instanceSize: null,
      hasJoinInfo: true,
    });
    const fixture = TestBed.createComponent(JoinInfoComponent);
    fixture.componentRef.setInput('session', running);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('How to join: published');
  });
});
