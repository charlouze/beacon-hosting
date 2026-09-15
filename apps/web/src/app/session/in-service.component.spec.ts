import { TestBed } from '@angular/core/testing';
import { DEFAULT_SETTINGS, Deadline, Session } from '@beacon/session';
import { CLOCK } from '../clock';
import { hourLabel } from '../format';
import { InServiceComponent } from './in-service.component';

describe('InServiceComponent', () => {
  const at = (iso: string) => new Date(iso);
  const OPENED_AT = at('2026-09-12T20:14:00');
  const clock = { now: () => at('2026-09-12T21:27:00') };

  const running = (closesAt: string) =>
    Session.from({
      state: 'RUNNING',
      sessionId: 'sess1',
      worldId: 'les-bras-casses',
      game: 'sunkenland',
      startedBy: 'u-9f3c2a',
      startedAt: OPENED_AT,
      deadline: Deadline.at(at(closesAt)),
      instanceSize: 'DEV1-L',
      hasJoinInfo: true,
    });

  const render = async (session: Session) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: CLOCK, useValue: clock }] });
    const fixture = TestBed.createComponent(InServiceComponent);
    fixture.componentRef.setInput('view', {
      session,
      facts: { ip: null, joinInfo: null, lastError: null },
      stateSince: OPENED_AT,
    });
    fixture.componentRef.setInput('settings', DEFAULT_SETTINGS);
    await fixture.whenStable();
    return fixture;
  };

  it('leads with the time left, seconds apart so only they are red', async () => {
    const fixture = await render(running('2026-09-13T00:14:00'));
    const countdown = fixture.nativeElement.querySelector('[data-field="countdown"]');
    expect(countdown.textContent.replace(/\s/g, '')).toBe('2:47:00');
    expect(countdown.querySelector('[data-field="seconds"]').textContent).toBe(':00');
  });

  it('announces the closing hour with the word the glossary fixes', async () => {
    const text = (await render(running('2026-09-13T00:14:00'))).nativeElement.textContent;
    expect(text).toContain('Closes at');
    expect(text).toContain('00:14');
  });

  /**
   * Decided on 2026-09-12: the hour, and not who opened it. `startedBy` holds
   * the uid the rules require (§7), and §5 forbids a player from reading
   * another member's document — so the name is readable nowhere, and printing
   * the uid would be twenty-eight random characters where the comp shows a
   * first name. The name comes back with the lot that opens members for
   * reading.
   */
  it('names the hour the evening was opened, and never the uid behind it', async () => {
    const text: string = (await render(running('2026-09-13T00:14:00'))).nativeElement.textContent;
    expect(text).toContain('Opened at');
    expect(text).toContain('20:14');
    expect(text).not.toContain('u-9f3c2a');
  });

  it('shows what the session has cost, as a fact and never a comparison', async () => {
    const text: string = (await render(running('2026-09-13T00:14:00'))).nativeElement.textContent;
    expect(text).toContain('This session');
    expect(text).toContain('€0.11');
    expect(text).not.toContain('7,90');
    expect(text.toLowerCase()).not.toContain('instead of');
    expect(text.toLowerCase()).not.toContain('saved');
  });

  /**
   * The Call Board's find, adopted without its dressing: the window reads as an
   * announced programme line rather than as a greyed button's excuse.
   */
  it('announces when the extension opens, above the button, while it is shut', async () => {
    const fixture = await render(running('2026-09-13T00:14:00'));
    const call = fixture.nativeElement.querySelector('[data-field="extension-call"]');
    expect(call.textContent).toContain('Extension call');
    expect(call.textContent).toContain('23:44');
    const extend = fixture.nativeElement.querySelector('[data-action="extend"]');
    expect(extend.disabled).toBe(true);
    // The reason is in plain sight, not in a title attribute.
    expect(extend.getAttribute('title')).toBeNull();
  });

  it('opens the button inside the window, and says the window is now', async () => {
    const fixture = await render(running('2026-09-12T21:40:00'));
    expect(fixture.nativeElement.querySelector('[data-action="extend"]').disabled).toBe(false);
    expect(
      fixture.nativeElement.querySelector('[data-field="extension-call"]').textContent,
    ).toContain('now');
  });

  it('emits rather than writing, so the board needs no emulator to be tested', async () => {
    const fixture = await render(running('2026-09-12T21:40:00'));
    const extended = vi.fn();
    fixture.componentInstance.extended.subscribe(extended);
    fixture.nativeElement.querySelector('[data-action="extend"]').click();
    expect(extended).toHaveBeenCalledOnce();
  });

  it('offers to close, which every state that holds a machine allows', async () => {
    const fixture = await render(running('2026-09-13T00:14:00'));
    expect(fixture.nativeElement.querySelector('[data-action="close"]').disabled).toBe(false);
  });

  /**
   * The discriminant is `game`, which the session already carries (§4). This
   * two-branch switch is why no third component exists to do the forwarding.
   */
  describe('the join point', () => {
    const withJoinInfo = async (joinInfo: unknown) => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({ providers: [{ provide: CLOCK, useValue: clock }] });
      const fixture = TestBed.createComponent(InServiceComponent);
      fixture.componentRef.setInput('view', {
        session: running('2026-09-13T00:14:00'),
        facts: { ip: null, joinInfo, lastError: null },
        stateSince: OPENED_AT,
      });
      fixture.componentRef.setInput('settings', DEFAULT_SETTINGS);
      await fixture.whenStable();
      return fixture.nativeElement as HTMLElement;
    };

    it('picks the addressed shape for the game that has an address', async () => {
      const dom = await withJoinInfo({
        game: 'enshrouded',
        hostname: 'h',
        address: '1.2.3.4',
        port: 1,
      });
      expect(dom.querySelector('beacon-enshrouded-join')).not.toBeNull();
      expect(dom.querySelector('beacon-sunkenland-join')).toBeNull();
    });

    it('picks the identifier shape for the game that has none', async () => {
      const dom = await withJoinInfo({
        game: 'sunkenland',
        serverId: 'a~b',
        region: 'Europe',
        worldName: 'W',
      });
      expect(dom.querySelector('beacon-sunkenland-join')).not.toBeNull();
      expect(dom.querySelector('beacon-enshrouded-join')).toBeNull();
    });

    /**
     * RUNNING means the join point is published (§4), so this is the seam
     * between the state arriving and the fact arriving — a snapshot apart at
     * worst, and it must not render an empty "How to join".
     */
    it('shows no join block at all while the fact has not arrived', async () => {
      const dom = await withJoinInfo(null);
      expect(dom.querySelector('[data-field="join-point"]')).toBeNull();
      expect(dom.textContent).not.toContain('How to join');
    });
  });

  /**
   * §4: the deadline is bounded on read, so a forged one — clamped by the
   * watchdog five minutes later — cannot make the countdown walk backwards in
   * the meantime. A year out must read as four hours, the clamp bound, and the
   * closing hour must agree with the countdown.
   */
  it('counts to the displayed deadline, never to the raw one', async () => {
    const forged = running('2027-01-01T00:00:00');
    const fixture = await render(forged);
    const shownHoursMinutes: string = fixture.nativeElement.querySelector(
      '[data-field="hours-minutes"]',
    ).textContent;
    const hours = Number(shownHoursMinutes.split(':')[0]);
    expect(hours).toBeLessThanOrEqual(4);

    const shown = forged.displayedDeadline(clock, DEFAULT_SETTINGS).at;
    expect(fixture.nativeElement.querySelector('[data-field="closes-at"]').textContent).toContain(
      hourLabel(shown),
    );
  });
});
