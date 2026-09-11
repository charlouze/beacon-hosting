import { TestBed } from '@angular/core/testing';
import { DEFAULT_SETTINGS, Session } from '@beacon/session';
import { CLOCK } from '../clock';
import { OutOfServiceComponent } from './out-of-service.component';

describe('OutOfServiceComponent', () => {
  const clock = { now: () => new Date('2026-09-12T20:14:00') };

  const render = async (lastError: string | null = null) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: CLOCK, useValue: clock }] });
    const fixture = TestBed.createComponent(OutOfServiceComponent);
    fixture.componentRef.setInput('view', {
      session: Session.idle(),
      facts: { ip: null, joinInfo: null, lastError },
      stateSince: null,
    });
    fixture.componentRef.setInput('settings', DEFAULT_SETTINGS);
    await fixture.whenStable();
    return fixture;
  };

  it('states plainly that nothing is running', async () => {
    expect((await render()).nativeElement.textContent).toContain('Nothing is running');
  });

  it('quotes the next session from the deployed settings, hour and price', async () => {
    const text = (await render()).nativeElement.textContent;
    expect(text).toContain('Next session');
    expect(text).toContain('00:14');
    expect(text).toContain('Estimated cost');
    expect(text).toContain('€0.22');
  });

  /**
   * The surface brief settles it: a promise made before the click is not the
   * same thing as an hour observed after it. This screen is before.
   */
  it('promises no hour before the click, only that one will be told', async () => {
    const text: string = (await render()).nativeElement.textContent;
    expect(text).not.toContain('Ready between');
    expect(text).toContain('exact time');
  });

  it('records the game without opening anything by itself', async () => {
    const fixture = await render();
    const opened = vi.fn();
    fixture.componentInstance.opened.subscribe(opened);
    const [enshrouded] = [...fixture.nativeElement.querySelectorAll('[data-game]')];
    enshrouded.click();
    await fixture.whenStable();
    expect(opened).not.toHaveBeenCalled();
    expect(enshrouded.getAttribute('aria-pressed')).toBe('true');
  });

  it('opens with the game that was recorded', async () => {
    const fixture = await render();
    const opened = vi.fn();
    fixture.componentInstance.opened.subscribe(opened);
    fixture.nativeElement.querySelector('[data-game="sunkenland"]').click();
    await fixture.whenStable();
    fixture.nativeElement.querySelector('[data-action="open"]').click();
    expect(opened).toHaveBeenCalledWith('sunkenland');
  });

  describe('after a refusal', () => {
    const REFUSAL = 'no capacity left for this machine size in the zone';

    it('names the problem, and quotes what the host said', async () => {
      const text = (await render(REFUSAL)).nativeElement.textContent;
      expect(text).toContain('didn’t start');
      expect(text).toContain(REFUSAL);
    });

    /** §8: nothing was left running, and the button is clickable at once. */
    it('says nothing is being charged, and leaves the button working', async () => {
      const fixture = await render(REFUSAL);
      expect(fixture.nativeElement.textContent).toContain('nothing is costing');
      expect(fixture.nativeElement.querySelector('[data-action="open"]').disabled).toBe(false);
    });

    it('changes the word on the button, and nothing else about the screen', async () => {
      expect(
        (await render(REFUSAL)).nativeElement.querySelector('[data-action="open"]').textContent,
      ).toContain('Try again');
      expect(
        (await render()).nativeElement.querySelector('[data-action="open"]').textContent,
      ).toContain('Open the service');
    });

    it('marks the refusal with the one red, which is reserved for exactly this', async () => {
      const fixture = await render(REFUSAL);
      expect(fixture.nativeElement.querySelector('[data-field="host-said"]')).not.toBeNull();
    });

    it('says nothing about a host that said nothing', async () => {
      expect((await render()).nativeElement.querySelector('[data-field="host-said"]')).toBeNull();
    });
  });
});
