import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DEFAULT_SETTINGS, Deadline, Session, World } from '@beacon/session';
import type { WorldSummary } from '@beacon/session-record/client';
import { CLOCK } from '../clock';
import { WorldsPage } from './worlds.page';

const NO_FACTS = { ip: null, joinInfo: null, lastError: null };
const STARTED = '2026-09-12T21:27:00';
/**
 * Injected and movable: fake timers do not reach `new Date(<string>)`, so a
 * clock frozen on a literal would make the falling second unobservable — the
 * one thing the last test is for. It is reset by every render.
 */
let now = new Date(STARTED);
const FIXED_CLOCK = { now: () => now };
const STARTED_AT = new Date('2026-09-12T20:14:00');

const world = (worldId: string, name: string, players = ['u1', 'u2', 'u3']) =>
  World.from({ worldId, game: 'enshrouded', name, inviteCode: 'c0de', players });

const running = (worldId: string, name: string): WorldSummary => ({
  world: world(worldId, name),
  server: {
    session: Session.from({
      state: 'RUNNING',
      worldId,
      sessionId: `s-${worldId}`,
      game: 'enshrouded',
      startedBy: 'u1',
      startedAt: STARTED_AT,
      deadline: Deadline.at(new Date('2026-09-13T00:14:00')),
      instanceSize: 'DEV1-L',
      hasJoinInfo: true,
    }),
    facts: NO_FACTS,
    stateSince: STARTED_AT,
  },
});

const idle = (worldId: string, name: string): WorldSummary => ({
  world: world(worldId, name),
  server: { session: Session.idle(), facts: NO_FACTS, stateSince: null },
});

const unreadable = (worldId: string, name: string): WorldSummary => ({
  world: world(worldId, name),
  server: null,
});

describe('WorldsPage', () => {
  const render = async (worlds: readonly WorldSummary[]) => {
    now = new Date(STARTED);
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: CLOCK, useValue: FIXED_CLOCK }],
    });
    const fixture = TestBed.createComponent(WorldsPage);
    fixture.componentRef.setInput('worlds', worlds);
    fixture.componentRef.setInput('settings', DEFAULT_SETTINGS);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('names the page, and says what the lot is doing before any world is read', async () => {
    const dom = await render([running('a', 'Les bras cassés'), idle('b', 'Vallée basse')]);
    expect(dom.querySelector('[data-field="wordmark"]')?.textContent).toContain('Your worlds');
    const overview = dom.querySelector('[data-field="overview"]');
    expect(overview?.textContent).toContain('1 in service');
    expect(overview?.getAttribute('data-tone')).toBe('live');
  });

  it('shows one band per world, the running one first, each a link to its board', async () => {
    const dom = await render([idle('b', 'Vallée basse'), running('a', 'Les bras cassés')]);
    const bands = [...dom.querySelectorAll('[data-field="world"]')];
    expect(bands.map((b) => b.getAttribute('data-world-id'))).toEqual(['a', 'b']);
    expect(bands[0].getAttribute('href')).toBe('/worlds/a');
    expect(bands[0].querySelector('[data-field="world-name"]')?.textContent).toContain(
      'Les bras cassés',
    );
    expect(bands[0].textContent).toContain('Enshrouded');
    expect(bands[0].textContent).toContain('3 players');
  });

  it('reads the time left and the closing hour on a world in service', async () => {
    const dom = await render([running('a', 'Les bras cassés')]);
    expect(dom.querySelector('[data-field="world-state"]')?.textContent).toContain('In service');
    expect(dom.querySelector('[data-field="time-left"]')?.textContent).toBe('2:47:00');
    expect(dom.querySelector('[data-field="closes-at"]')?.textContent).toContain('00:14');
  });

  it('reads what opening will give on a world that sleeps, from the settings', async () => {
    const dom = await render([idle('b', 'Vallée basse')]);
    expect(dom.querySelector('[data-field="world-state"]')?.textContent).toContain('Out of service');
    expect(dom.querySelector('[data-field="next-session"]')?.textContent).toContain('4 h once opened');
    expect(dom.querySelector('[data-field="time-left"]')).toBeNull();
  });

  it('says the state is unknown when the server cannot be read, and reads nothing else', async () => {
    const dom = await render([unreadable('u', 'Le camp du lac')]);
    const state = dom.querySelector('[data-field="world-state"]');
    expect(state?.textContent).toContain('Unknown');
    expect(dom.querySelector('[data-field="time-left"]')).toBeNull();
    expect(dom.querySelector('[data-field="next-session"]')).toBeNull();
  });

  it('shows the empty board, and the one thing to do about it, to a member with no world', async () => {
    const dom = await render([]);
    expect(dom.querySelector('[data-field="overview"]')?.textContent).toContain('No world yet');
    expect(dom.querySelector('[data-field="empty"]')?.textContent).toContain('invite link');
    expect(dom.querySelector('[data-field="world"]')).toBeNull();
  });

  it('lets the second fall on a world in service, and nowhere else', async () => {
    // The beat's interval and nothing else: faking the rest freezes the
    // scheduler that `whenStable` waits on, and the render never returns.
    vi.useFakeTimers({ toFake: ['setInterval'] });
    try {
      const dom = await render([running('a', 'Les bras cassés')]);
      const before = dom.querySelector('[data-field="time-left"]')?.textContent;
      now = new Date(now.getTime() + 1000);
      await vi.advanceTimersByTimeAsync(1000);
      // The beat set its signal; rendering it is the scheduler's next turn,
      // which is what `whenStable` awaits everywhere else in this file.
      TestBed.inject(ApplicationRef).tick();
      expect(dom.querySelector('[data-field="time-left"]')?.textContent).not.toBe(before);
    } finally {
      vi.useRealTimers();
    }
  });
});
