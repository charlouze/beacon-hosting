import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DEFAULT_SETTINGS, Deadline, Session, World } from '@beacon/session';
import { CLOCK } from '../clock';
import { ORIGIN } from '../records';
import { SessionPage } from './session.page';

const WORLD = World.from({
  worldId: 'les-bras-casses',
  game: 'sunkenland',
  name: 'Les bras cassés',
  inviteCode: '7f3a9c2e',
  players: ['u1', 'u2', 'u3'],
});

const NO_FACTS = { ip: null, joinInfo: null, lastError: null };

/**
 * The board renders its state bodies for real, so one of them reads the clock.
 * Left to the token's own factory that would be the wall clock, and every
 * assertion here would drift with the time of day.
 */
const FIXED_CLOCK = { now: () => new Date('2026-09-12T21:27:00') };

const STARTED_AT = new Date('2026-09-12T20:14:00');

const sessionIn = (state: 'PROVISIONING' | 'RUNNING' | 'STOPPING' | 'FAILED') =>
  Session.from({
    state,
    sessionId: 'sess1',
    worldId: 'les-bras-casses',
    game: 'sunkenland',
    startedBy: 'Charlouze',
    startedAt: STARTED_AT,
    deadline: Deadline.at(new Date('2026-09-13T00:14:00')),
    instanceSize: 'DEV1-L',
    hasJoinInfo: state === 'RUNNING',
  });

const MEMBER = { uid: 'u1', name: 'Charlouze', role: 'player', steamId: null } as const;

describe('SessionPage', () => {
  // Reset first: several of these tests render more than once, and a TestBed
  // already instantiated refuses to be configured again.
  const render = async (session: Session, facts = NO_FACTS) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CLOCK, useValue: FIXED_CLOCK },
        { provide: ORIGIN, useValue: 'https://beacon.charlouze.com' },
      ],
    });
    const fixture = TestBed.createComponent(SessionPage);
    fixture.componentRef.setInput('view', { session, facts, stateSince: STARTED_AT });
    fixture.componentRef.setInput('world', WORLD);
    fixture.componentRef.setInput('settings', DEFAULT_SETTINGS);
    fixture.componentRef.setInput('member', MEMBER);
    await fixture.whenStable();
    return fixture;
  };

  /** The glossary of §4 is the authority on every one of these five words. */
  it.each([
    [Session.idle(), 'Out of service'],
    [sessionIn('PROVISIONING'), 'Preparing'],
    [sessionIn('RUNNING'), 'In service'],
    [sessionIn('STOPPING'), 'Closing'],
    [sessionIn('FAILED'), 'Not cleared'],
  ])('names the state with the label the glossary fixes', async (session, label) => {
    const fixture = await render(session);
    expect(fixture.nativeElement.querySelector('[data-field="state"]').textContent).toContain(
      label,
    );
  });

  it('carries the product name as the way back to the list, and the name of the world', async () => {
    const fixture = await render(Session.idle());
    const home = fixture.nativeElement.querySelector('[data-action="home"]') as HTMLAnchorElement;
    expect(home.textContent).toContain('Beacon');
    expect(home.getAttribute('href')).toBe('/');
    expect(fixture.nativeElement.querySelector('[data-field="world-name"]').textContent).toContain(
      'Les bras cassés',
    );
  });

  it('puts the way back to the list in the quiet foot, before sign out', async () => {
    const fixture = await render(Session.idle());
    const foot = fixture.nativeElement.querySelector('.quiet') as HTMLElement;
    const worlds = foot.querySelector('[data-action="worlds"]') as HTMLAnchorElement;
    expect(worlds.textContent).toContain('Your worlds');
    expect(worlds.getAttribute('href')).toBe('/');
    const order = [...foot.querySelectorAll('[data-action]')].map((el) =>
      el.getAttribute('data-action'),
    );
    expect(order.indexOf('worlds')).toBeLessThan(order.indexOf('sign-out'));
  });

  /**
   * The foot has two ends. A declared Steam account adds a third child, and
   * `space-between` would set the one thing here that is a value — a 17-digit
   * number in ink — at the exact centre between two greys. The rule that sends
   * it right lives in the sheet; what is testable here is that it has a rule to
   * match, which a renamed element would silently take away.
   */
  it('keeps the declared Steam account on the sign-out side of the foot', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CLOCK, useValue: FIXED_CLOCK },
        { provide: ORIGIN, useValue: 'https://beacon.charlouze.com' },
      ],
    });
    const fixture = TestBed.createComponent(SessionPage);
    fixture.componentRef.setInput('view', { session: Session.idle(), facts: NO_FACTS, stateSince: STARTED_AT });
    fixture.componentRef.setInput('world', WORLD);
    fixture.componentRef.setInput('settings', DEFAULT_SETTINGS);
    fixture.componentRef.setInput('member', { ...MEMBER, steamId: '76561197960287930' });
    await fixture.whenStable();
    const foot = fixture.nativeElement.querySelector('.quiet') as HTMLElement;
    const children = [...foot.children].map((el) => el.tagName.toLowerCase());
    expect(children).toEqual(['a', 'beacon-steam-declaration', 'button']);
  });

  it('offers no game to choose: the world already has one', async () => {
    const fixture = await render(Session.idle());
    expect(fixture.nativeElement.querySelector('[data-game]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="group"]')).toBeNull();
  });

  /**
   * The pip stays, decided on 2026-09-11 — the approved comp carries one and
   * wins over the text of constraint no. 2. Its beat does not: that the pip
   * animates nothing is held by `world.spec.ts`, which reads the stylesheets
   * of the whole application rather than one element of one of them. jsdom
   * resolves `animation-name` to `''` on anything that never declared it, so
   * asserting `'none'` here would have pinned a runner's habit, not a
   * decision.
   */
  it('carries the status pip, which the approved comp kept', async () => {
    const fixture = await render(sessionIn('RUNNING'));
    expect(fixture.nativeElement.querySelector('[data-field="state-pip"]')).not.toBeNull();
  });

  it('renders one state body at a time, never two', async () => {
    const fixture = await render(sessionIn('RUNNING'));
    expect(fixture.nativeElement.querySelectorAll('[data-state-body]')).toHaveLength(1);
  });

  it('says so plainly when the record cannot be read, rather than showing an empty board', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CLOCK, useValue: FIXED_CLOCK },
        { provide: ORIGIN, useValue: 'https://beacon.charlouze.com' },
      ],
    });
    const fixture = TestBed.createComponent(SessionPage);
    fixture.componentRef.setInput('view', null);
    fixture.componentRef.setInput('world', WORLD);
    fixture.componentRef.setInput('settings', DEFAULT_SETTINGS);
    fixture.componentRef.setInput('member', MEMBER);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('cannot be read');
  });

  it('carries the band of the world under the actions, in every state', async () => {
    for (const session of [Session.idle(), sessionIn('RUNNING'), sessionIn('FAILED')]) {
      const fixture = await render(session);
      expect(fixture.nativeElement.querySelector('beacon-world-band')).not.toBeNull();
    }
  });

  /** Constraint no. 2: never a cloud console. These words are barred from the surface. */
  it.each(['instance', 'container', 'provisioning', 'DEV1-L', 'Scaleway', 'Firestore'])(
    'never shows the infrastructure word "%s"',
    async (word) => {
      for (const session of [Session.idle(), sessionIn('RUNNING'), sessionIn('FAILED')]) {
        const text: string = (await render(session)).nativeElement.textContent.toLowerCase();
        expect(text).not.toContain(word.toLowerCase());
      }
    },
  );
});
