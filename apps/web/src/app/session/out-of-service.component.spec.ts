import { TestBed } from '@angular/core/testing';
import { DEFAULT_SETTINGS, Session, type ShownSetup } from '@beacon/session';
import { CLOCK } from '../clock';
import { OutOfServiceComponent } from './out-of-service.component';

describe('OutOfServiceComponent', () => {
  const clock = { now: () => new Date('2026-09-12T20:14:00') };

  const render = async (lastError: string | null = null, setup: ShownSetup | null = null) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: CLOCK, useValue: clock }] });
    const fixture = TestBed.createComponent(OutOfServiceComponent);
    fixture.componentRef.setInput('view', {
      session: Session.idle(),
      facts: { ip: null, joinInfo: null, lastError },
      stateSince: null,
      setup,
      readyWindow: null,
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
    expect(text).toContain('€0.21');
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

  it('offers no game, and opens with nothing but the intent', async () => {
    const fixture = await render();
    const opened = vi.fn();
    fixture.componentInstance.opened.subscribe(opened);
    expect(fixture.nativeElement.querySelector('[data-game]')).toBeNull();
    fixture.nativeElement.querySelector('[data-action="open"]').click();
    await fixture.whenStable();
    expect(opened).toHaveBeenCalledOnce();
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

  describe('after an abandoned setup', () => {
    const STOPPED: ShownSetup = {
      step: {
        step: 'fetching-game',
        since: new Date('2026-09-12T20:16:00'),
        activity: 'downloading',
        progress: 37,
      },
      order: ['waking', 'restoring-world', 'fetching-game', 'starting-game'],
      abandonedAt: new Date('2026-09-12T20:19:00'),
    };

    const stopped = (fixture: Awaited<ReturnType<typeof render>>): HTMLElement | null =>
      fixture.nativeElement.querySelector('[data-field="stopped-at"]');

    it('says where the setup stopped, and at what hour', async () => {
      const text = stopped(await render(null, STOPPED))?.textContent ?? '';
      expect(text).toContain('Where it stopped, at 20:19');
      expect(text).toContain('Step 3 of 4');
      expect(text).toContain('Getting the game');
    });

    // What the step was doing when it stopped is not where it stopped.
    it('says neither the activity nor the progress the step had reached', async () => {
      const text: string = (await render(null, STOPPED)).nativeElement.textContent;
      expect(text).not.toContain('Downloading');
      expect(text).not.toContain('37');
    });

    it('takes the title and the button of a start that failed, with no host to quote', async () => {
      const fixture = await render(null, STOPPED);
      expect(fixture.nativeElement.textContent).toContain('didn’t start');
      expect(fixture.nativeElement.textContent).toContain('nothing is costing');
      expect(fixture.nativeElement.querySelector('[data-action="open"]').textContent).toContain(
        'Try again',
      );
      expect(fixture.nativeElement.querySelector('[data-field="host-said"]')).toBeNull();
    });

    it('still quotes the host when there is something to quote', async () => {
      const fixture = await render('provisioning did not finish in time', STOPPED);
      expect(stopped(fixture)).not.toBeNull();
      expect(
        fixture.nativeElement.querySelector('[data-field="host-said"]').textContent,
      ).toContain('provisioning did not finish in time');
    });

    it('shows the first step, ranked first, when no order of the game is known', async () => {
      const text =
        stopped(
          await render(null, {
            step: {
              step: 'waking',
              since: new Date('2026-09-12T20:14:00'),
              activity: null,
              progress: null,
            },
            order: null,
            abandonedAt: new Date('2026-09-12T20:19:00'),
          }),
        )?.textContent ?? '';
      expect(text).toContain('Step 1 of 4');
      expect(text).toContain('Waking the server');
    });

    it('says nothing of it on a world that abandoned no setup', async () => {
      expect(stopped(await render())).toBeNull();
      expect(stopped(await render('no capacity left'))).toBeNull();
    });
  });
});
