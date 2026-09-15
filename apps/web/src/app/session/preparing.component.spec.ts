import { TestBed } from '@angular/core/testing';
import { DEFAULT_SETTINGS, Deadline, Session } from '@beacon/session';
import { CLOCK } from '../clock';
import { PreparingComponent } from './preparing.component';

describe('PreparingComponent', () => {
  const startedAt = new Date('2026-09-12T20:14:00');
  const clock = { now: () => new Date('2026-09-12T20:15:30') };

  const render = async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: CLOCK, useValue: clock }] });
    const fixture = TestBed.createComponent(PreparingComponent);
    const session = Session.from({
      state: 'PROVISIONING',
      sessionId: 'sess1',
      worldId: 'les-bras-casses',
      game: 'sunkenland',
      startedBy: 'u-9f3c2a',
      startedAt,
      deadline: Deadline.at(new Date('2026-09-13T00:14:00')),
      instanceSize: 'DEV1-L',
      hasJoinInfo: false,
    });
    fixture.componentRef.setInput('view', {
      session,
      facts: { ip: null, joinInfo: null, lastError: null },
      stateSince: startedAt,
    });
    fixture.componentRef.setInput('settings', DEFAULT_SETTINGS);
    await fixture.whenStable();
    return fixture;
  };

  /**
   * probe/RESULTS.md §S: 4 min 49 s then 7 min 58 s on the same size in the
   * same zone. A single hour would be three minutes wrong one time in two, and
   * an hour contradicted releases nobody.
   */
  it('announces a window and never a single hour', async () => {
    const text = (await render()).nativeElement.textContent;
    expect(text).toContain('Ready between');
    expect(text).toContain('20:19');
    expect(text).toContain('20:22');
    expect(text).not.toContain('Ready around');
  });

  it('hands the evening back, in as many words', async () => {
    const text: string = (await render()).nativeElement.textContent;
    expect(text).toContain('Nothing to watch');
    expect(text.toLowerCase()).toMatch(/close the tab|put the phone down/);
  });

  /** The interface never tries to hold or occupy the wait. */
  it('shows no progress of any kind', async () => {
    const fixture = await render();
    expect(fixture.nativeElement.querySelector('progress')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="progressbar"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toMatch(/%|step \d|downloading/i);
  });

  /**
   * Nothing falls on this screen. That nothing moves on it either is held by
   * `world.spec.ts`, over the stylesheets of the whole application: jsdom
   * resolves `animation-name` to `''` on every element that never declared
   * one, so asserting `'none'` node by node here would pin a runner's habit.
   */
  it('runs no countdown, there being nothing to count', async () => {
    expect((await render()).nativeElement.querySelector('[data-field="countdown"]')).toBeNull();
  });

  it('still says when the evening closes, which is the promise of the product', async () => {
    const text = (await render()).nativeElement.textContent;
    expect(text).toContain('Closes at');
    expect(text).toContain('00:14');
  });

  /** §11: the started hour is due whatever happens next, and saying so is honest. */
  it('offers to close now, and says the first hour is charged either way', async () => {
    const fixture = await render();
    expect(fixture.nativeElement.querySelector('[data-action="close"]').disabled).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('first hour is charged');
  });
});
