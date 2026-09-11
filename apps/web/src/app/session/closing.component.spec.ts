import { TestBed } from '@angular/core/testing';
import { DEFAULT_SETTINGS, Deadline, Session } from '@beacon/session';
import { CLOCK } from '../clock';
import { ClosingComponent } from './closing.component';

const clock = { now: () => new Date('2026-09-13T00:31:00') };

describe('ClosingComponent', () => {
  const render = async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: CLOCK, useValue: clock }] });
    const fixture = TestBed.createComponent(ClosingComponent);
    fixture.componentRef.setInput('view', {
      session: Session.from({
        state: 'STOPPING',
        sessionId: 'sess1',
        game: 'sunkenland',
        startedBy: 'u-9f3c2a',
        startedAt: new Date('2026-09-12T20:14:00'),
        deadline: Deadline.at(new Date('2026-09-13T00:14:00')),
        instanceSize: 'DEV1-L',
        hasJoinInfo: false,
      }),
      facts: { ip: null, joinInfo: null, lastError: null },
      stateSince: new Date('2026-09-13T00:30:00'),
    });
    fixture.componentRef.setInput('settings', DEFAULT_SETTINGS);
    await fixture.whenStable();
    return fixture;
  };

  it('says the machine is going, and that there is no paused server to return to', async () => {
    const text = (await render()).nativeElement.textContent;
    expect(text).toContain('Closing down');
    expect(text.toLowerCase()).toContain('no paused server');
  });

  /**
   * PRODUCT.md, and it is the one sentence this product may never say: that
   * everything is saved right now. The cadence is stated, the guarantee is not.
   */
  it('states the save cadence, and never claims the world is saved', async () => {
    const text: string = (await render()).nativeElement.textContent;
    expect(text.toLowerCase()).toContain('own schedule');
    expect(text.toLowerCase()).not.toMatch(/everything is saved|saved successfully|all saved/);
  });

  it('offers nothing to press, there being nothing useful to do', async () => {
    expect((await render()).nativeElement.querySelectorAll('button')).toHaveLength(0);
  });
});
