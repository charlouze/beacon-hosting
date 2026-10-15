import { TestBed, type ComponentFixture } from '@angular/core/testing';
import {
  DEFAULT_SETTINGS,
  Deadline,
  Session,
  type ReadyWindow,
  type ShownSetup,
  type ShownStep,
} from '@beacon/session';
import { CLOCK } from '../clock';
import { PreparingComponent } from './preparing.component';

describe('PreparingComponent', () => {
  const startedAt = new Date('2026-09-12T20:14:00');
  const stepSince = new Date('2026-09-12T20:16:00');
  const clock = { now: () => new Date('2026-09-12T20:17:30') };

  /** The game is brought back from the depot before its world is. */
  const DEPOT_FIRST = ['waking', 'fetching-game', 'restoring-world', 'starting-game'] as const;
  /** The world is brought back before the game's own container fetches the game. */
  const WORLD_FIRST = ['waking', 'restoring-world', 'fetching-game', 'starting-game'] as const;

  const PREFLIGHT: ShownSetup = { stage: 'preflight', since: startedAt, abandonedAt: null, failure: null };

  const WINDOW: ReadyWindow = {
    from: new Date('2026-09-12T20:19:10'),
    to: new Date('2026-09-12T20:22:05'),
  };

  const fetching = (parts: Partial<ShownStep['step']> = {}): ShownStep => ({
    stage: 'step',
    step: { step: 'fetching-game', since: stepSince, activity: null, progress: null, ...parts },
    order: DEPOT_FIRST,
    abandonedAt: null,
  });

  const render = async (
    setup: ShownSetup | null = PREFLIGHT,
    readyWindow: ReadyWindow | null = WINDOW,
  ) => {
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
      setup,
      readyWindow,
      awaitsCopyReplacement: false,
    });
    fixture.componentRef.setInput('settings', DEFAULT_SETTINGS);
    await fixture.whenStable();
    return fixture;
  };

  const field = (fixture: ComponentFixture<PreparingComponent>, name: string): string | null =>
    fixture.nativeElement.querySelector(`[data-field="${name}"]`)?.textContent.trim() ?? null;

  const lengths = (fixture: ComponentFixture<PreparingComponent>): HTMLElement[] => [
    ...fixture.nativeElement.querySelectorAll('.track > div'),
  ];

  const text = (element: HTMLElement, selector: string): string | undefined =>
    element.querySelector(selector)?.textContent?.trim();

  const states = (fixture: ComponentFixture<PreparingComponent>): (string | null)[] =>
    lengths(fixture).map((length) => length.getAttribute('data-length'));

  describe('the step under way', () => {
    it('names the step, its rank out of four and the hour it began', async () => {
      const fixture = await render(fetching());

      expect(field(fixture, 'step-name')).toBe('Getting the game');
      expect(field(fixture, 'step-rank')).toBe('2/4');
      expect(field(fixture, 'step-said')).toBe('since 20:16');
    });

    it('ranks the same step where the order of the game puts it', async () => {
      const fixture = await render({ ...fetching(), order: WORLD_FIRST });

      expect(field(fixture, 'step-rank')).toBe('3/4');
      expect(states(fixture)).toEqual(['done', 'done', 'cur', 'todo']);
    });

    it('shows the progress and the activity the game server declares', async () => {
      const fixture = await render(fetching({ activity: 'downloading', progress: 37 }));

      expect(field(fixture, 'step-progress')).toBe('37 %');
      expect(field(fixture, 'step-said')).toBe('Downloading · since 20:16');
    });

    it('shows an activity that comes with no progress', async () => {
      const fixture = await render(fetching({ activity: 'unpacking' }));

      expect(field(fixture, 'step-progress')).toBeNull();
      expect(field(fixture, 'step-said')).toBe('Unpacking · since 20:16');
    });

    /** Never a progress no measure carries: no figure, no percentage, no zero. */
    it('shows no progress when the game server declares none', async () => {
      const fixture = await render(fetching());

      expect(field(fixture, 'step-progress')).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain('%');
    });

    // Zero is a measure: the download began and nothing has arrived yet.
    it('shows a progress of zero as a figure, not as no progress', async () => {
      const fixture = await render(fetching({ activity: 'downloading', progress: 0 }));

      expect(field(fixture, 'step-progress')).toBe('0 %');
      const current = lengths(fixture)[1];
      expect(current.classList.contains('wait')).toBe(false);
      expect(current.querySelector('i')?.style.getPropertyValue('--at')).toBe('0%');
    });

    // Nothing checks what a game server declares: the screen follows it back.
    it('follows a step declared backwards', async () => {
      const fixture = await render({
        stage: 'step',
        step: { step: 'waking', since: stepSince, activity: null, progress: null },
        order: DEPOT_FIRST,
        abandonedAt: null,
      });

      expect(field(fixture, 'step-rank')).toBe('1/4');
      expect(states(fixture)).toEqual(['cur', 'todo', 'todo', 'todo']);
    });
  });

  describe('the preflight check', () => {
    it('shows the preflight check in place of a step, since the opening', async () => {
      const element: HTMLElement = (await render(PREFLIGHT)).nativeElement;

      expect(element.querySelector('[data-field="step-rank"]')).toBeNull();
      expect(text(element, '[data-field="preflight"]')).toBe('Preflight check');
      expect(text(element, '[data-field="step-said"]')).toBe('since 20:14');
      expect(element.querySelector('.stephero .k')?.textContent?.trim()).toBe('Before the first step');
    });

    it('keeps the four lengths of the rule, all to come and still', async () => {
      const element: HTMLElement = (await render(PREFLIGHT)).nativeElement;
      const lengths = [...element.querySelectorAll('.track [data-length]')];

      expect(lengths.map((l) => l.getAttribute('data-length'))).toEqual(['todo', 'todo', 'todo', 'todo']);
      expect(element.querySelector('.track .wait')).toBeNull();
      expect(element.querySelector('.track .k')).toBeNull();
      expect(element.querySelector('.track')?.getAttribute('aria-label')).toBe('Preflight check, before the first step');
    });

    it('announces the ready window during the preflight check', async () => {
      expect((await render(PREFLIGHT)).nativeElement.querySelector('[data-field="ready-window"]')).not.toBeNull();
    });

    it('does not say the first hour is charged while no server exists', async () => {
      expect((await render(PREFLIGHT)).nativeElement.querySelector('.hint')).toBeNull();
    });

    it('still says it once a step is under way', async () => {
      expect(text((await render(fetching())).nativeElement, '.hint')).toBe('The first hour is charged either way.');
    });
  });

  describe('the rule in four lengths', () => {
    it('marks the lengths travelled, the one under way and those to come', async () => {
      const fixture = await render({
        stage: 'step',
        step: { step: 'restoring-world', since: stepSince, activity: null, progress: null },
        order: DEPOT_FIRST,
        abandonedAt: null,
      });

      expect(states(fixture)).toEqual(['done', 'done', 'cur', 'todo']);
    });

    it('names the four lengths in the order of the game', async () => {
      const fixture = await render({ ...fetching(), order: WORLD_FIRST });

      expect(lengths(fixture).map((length) => length.textContent?.trim())).toEqual([
        'Waking the server',
        'Bringing your world back',
        'Getting the game',
        'Starting the game',
      ]);
    });

    it('fills the length under way as far as the declared progress', async () => {
      const current = lengths(await render(fetching({ progress: 37 })))[1];

      expect(current.querySelector('i')?.style.getPropertyValue('--at')).toBe('37%');
      expect(current.classList.contains('wait')).toBe(false);
    });

    it('lets a length pass over a step that has no progress, and over that one only', async () => {
      const fixture = await render(fetching());

      expect(lengths(fixture).map((length) => length.classList.contains('wait'))).toEqual([
        false,
        true,
        false,
        false,
      ]);
    });

    it('says the step, its rank and its progress to whoever cannot see the rule', async () => {
      const track = (await render(fetching({ progress: 37 }))).nativeElement.querySelector('.track');

      expect(track.getAttribute('role')).toBe('img');
      expect(track.getAttribute('aria-label')).toBe('Step 2 of 4, Getting the game, 37 percent');
    });

    it('says no progress to them either when there is none', async () => {
      const track = (await render(fetching())).nativeElement.querySelector('.track');

      expect(track.getAttribute('aria-label')).toBe('Step 2 of 4, Getting the game');
    });
  });

  /** Two setups of the same game end minutes apart: an hour contradicted releases nobody. */
  it('announces the window it is given, and never a single hour', async () => {
    const fixture = await render();

    expect(fixture.nativeElement.textContent).toContain('Ready between');
    expect(field(fixture, 'ready-window')).toBe('20:19 – 20:22');
    expect(fixture.nativeElement.textContent).not.toContain('Ready around');
  });

  // The game counts too few completed setups to draw a window from: the line
  // goes, and nothing stands in for it.
  it('announces no window when it is given none, and nothing in its place', async () => {
    const fixture = await render(PREFLIGHT, null);

    expect(fixture.nativeElement.textContent).not.toContain('Ready between');
    expect(field(fixture, 'ready-window')).toBeNull();
    expect(field(fixture, 'preflight')).toBe('Preflight check');
    expect(field(fixture, 'closes-at')).toBe('00:14');
  });

  // The session opened at 20:14: the window shown is the one it is given, not
  // one worked out from that hour.
  it('computes no hour of the window itself', async () => {
    const fixture = await render(PREFLIGHT, {
      from: new Date('2026-09-12T20:31:00'),
      to: new Date('2026-09-12T20:47:00'),
    });

    expect(field(fixture, 'ready-window')).toBe('20:31 – 20:47');
  });

  it('hands the evening back, in as many words', async () => {
    const text: string = (await render()).nativeElement.textContent;
    expect(text).toContain('No need to stay.');
    expect(text.toLowerCase()).toMatch(/close the tab|put the phone down/);
  });

  it('runs no countdown, there being nothing to count', async () => {
    expect((await render()).nativeElement.querySelector('[data-field="countdown"]')).toBeNull();
  });

  it('still says when the evening closes, which is the promise of the product', async () => {
    const fixture = await render();
    expect(fixture.nativeElement.textContent).toContain('Closes at');
    expect(field(fixture, 'closes-at')).toBe('00:14');
    expect(field(fixture, 'opened-at')).toBe('20:14');
  });

  it('still says when the evening closes when it is given no setup to show', async () => {
    const fixture = await render(null);

    expect(field(fixture, 'closes-at')).toBe('00:14');
    expect(fixture.nativeElement.querySelector('.track')).toBeNull();
  });

  /** §11: the started hour is due whatever happens next, and saying so is honest. */
  it('offers to close now, and says the first hour is charged either way', async () => {
    const fixture = await render(fetching());
    expect(fixture.nativeElement.querySelector('[data-action="close"]').disabled).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('first hour is charged');
  });
});
