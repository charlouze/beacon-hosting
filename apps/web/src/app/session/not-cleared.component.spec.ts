import { TestBed } from '@angular/core/testing';
import { DEFAULT_SETTINGS, Deadline, Session } from '@beacon/session';
import { CLOCK } from '../clock';
import { NotClearedComponent } from './not-cleared.component';

const clock = { now: () => new Date('2026-09-13T00:31:00') };

describe('NotClearedComponent', () => {
  const render = async (lastError: string | null = 'the machine will not delete') => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: CLOCK, useValue: clock }] });
    const fixture = TestBed.createComponent(NotClearedComponent);
    fixture.componentRef.setInput('view', {
      session: Session.from({
        state: 'FAILED',
        sessionId: 'sess1',
        game: 'sunkenland',
        startedBy: 'u-9f3c2a',
        startedAt: new Date('2026-09-12T20:14:00'),
        deadline: Deadline.at(new Date('2026-09-13T00:14:00')),
        instanceSize: 'DEV1-L',
        hasJoinInfo: false,
      }),
      facts: { ip: null, joinInfo: null, lastError },
      stateSince: new Date('2026-09-13T00:31:00'),
    });
    fixture.componentRef.setInput('settings', DEFAULT_SETTINGS);
    await fixture.whenStable();
    return fixture;
  };

  it('says something was left behind, and that it is still being charged', async () => {
    const text = (await render()).nativeElement.textContent;
    expect(text).toContain('left behind');
    expect(text).toContain('Still being charged');
  });

  /** §8: retried every five minutes until IDLE. No state of this system is a dead end. */
  it('says who repairs it, and that it does not give up', async () => {
    const text: string = (await render()).nativeElement.textContent;
    expect(text).toContain('five minutes');
    expect(text.toLowerCase()).toContain('nothing for you to do');
  });

  it('offers nothing to press, because no gesture would help', async () => {
    expect((await render()).nativeElement.querySelectorAll('button')).toHaveLength(0);
  });

  it('quotes what the host said, expurgated and bounded (§5)', async () => {
    expect((await render()).nativeElement.textContent).toContain('the machine will not delete');
  });

  it('holds its tongue when the record says nothing about the cause', async () => {
    const text: string = (await render(null)).nativeElement.textContent;
    expect(text).toContain('left behind');
    expect(text.toLowerCase()).not.toContain('what the host said');
  });

  /**
   * The only red figure of the product, because it is the only one still
   * climbing. The test asserts the state, not the colour: what paints
   * `data-climbing` red is the stylesheet, and `world.spec.ts` is what pins
   * that red to the value the contract fixes.
   */
  it('marks the cost as still climbing, which is what earns it the one red', async () => {
    const fixture = await render();
    expect(fixture.nativeElement.querySelector('[data-field="cost"]').dataset.climbing).toBe(
      'true',
    );
  });
});
