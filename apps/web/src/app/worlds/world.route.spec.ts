import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { DEFAULT_SETTINGS, Session, World } from '@beacon/session';
import type { WorldSummary } from '@beacon/session-record/client';
import { CLOCK } from '../clock';
import { ORIGIN, Records } from '../records';
import { WorldRoute } from './world.route';

const NO_FACTS = { ip: null, joinInfo: null, lastError: null };
const FIXED_CLOCK = { now: () => new Date('2026-09-12T21:27:00') };
const ACTOR = { uid: 'u1', name: 'Charlouze' };

const summary = (worldId = 'les-bras-casses'): WorldSummary => ({
  world: World.from({
    worldId,
    game: 'enshrouded',
    name: 'Les bras cassés',
    inviteCode: '7f3a9c2e',
    players: ['u1'],
  }),
  server: { session: Session.idle(), facts: NO_FACTS, stateSince: null },
});

describe('WorldRoute', () => {
  let publish: (view: WorldSummary | null) => void;
  const stop = vi.fn();
  const session = {
    watchWorld: vi.fn((_id: string, on: (v: WorldSummary | null) => void) => {
      publish = on;
      return stop;
    }),
    open: vi.fn(async () => undefined),
    extend: vi.fn(async () => undefined),
    requestStop: vi.fn(async () => undefined),
    rename: vi.fn(async () => undefined),
    regenerateInvite: vi.fn(async () => undefined),
    leave: vi.fn(async () => undefined),
  };
  const records = {
    member: signal({ ...ACTOR, role: 'player', steamId: null }),
    settings: signal(DEFAULT_SETTINGS),
    session: () => session,
    actor: () => ACTOR,
    run: vi.fn(async (action: () => Promise<void>) => {
      await action();
      return true;
    }),
    signOut: vi.fn(),
    declareSteamId: vi.fn(),
  };

  beforeEach(() => {
    stop.mockClear();
    for (const fn of Object.values(session)) fn.mockClear();
    records.run.mockClear();
    records.signOut.mockClear();
    records.declareSteamId.mockClear();
  });

  const mount = async (worldId = 'les-bras-casses') => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CLOCK, useValue: FIXED_CLOCK },
        { provide: ORIGIN, useValue: 'https://beacon.charlouze.com' },
        { provide: Records, useValue: records },
      ],
    });
    const fixture = TestBed.createComponent(WorldRoute);
    fixture.componentRef.setInput('worldId', worldId);
    await fixture.whenStable();
    const dom = fixture.nativeElement as HTMLElement;
    const show = async (view: WorldSummary | null) => {
      publish(view);
      await fixture.whenStable();
    };
    return { fixture, dom, show };
  };

  it('watches the world it was routed to, and renders nothing before the first answer', async () => {
    const { dom } = await mount();
    expect(session.watchWorld).toHaveBeenCalledWith('les-bras-casses', expect.any(Function));
    expect(dom.querySelector('beacon-session-page')).toBeNull();
    expect(dom.querySelector('[data-field="not-yours"]')).toBeNull();
  });

  it('renders the board with the world, and the invite link built on the origin', async () => {
    const { dom, show } = await mount();
    await show(summary());
    expect(dom.querySelector('beacon-session-page')).not.toBeNull();
    expect(dom.querySelector('[data-field="invite-link"]')?.textContent).toContain(
      'beacon.charlouze.com/join/les-bras-casses/7f3a9c2e',
    );
  });

  it('says the world is not theirs when nothing can be read', async () => {
    const { dom, show } = await mount();
    await show(null);
    expect(dom.querySelector('[data-field="not-yours"]')?.textContent).toContain('not on your list');
    expect(dom.querySelector('beacon-session-page')).toBeNull();
  });

  it('turns each action of the board into a call on the record, for this world and this actor', async () => {
    const { dom, show, fixture } = await mount();
    await show(summary());
    (dom.querySelector('[data-action="open"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(session.open).toHaveBeenCalledWith(
      expect.objectContaining({ worldId: 'les-bras-casses', actor: ACTOR }),
    );
    (dom.querySelector('[data-action="new-link"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    (dom.querySelector('[data-action="confirm-new-link"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(session.regenerateInvite).toHaveBeenCalledWith('les-bras-casses', ACTOR);
  });

  it('leaves the world and goes back to the list, only once the record said yes', async () => {
    const { dom, show, fixture } = await mount();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    await show(summary());
    (dom.querySelector('[data-action="leave"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    (dom.querySelector('[data-action="confirm-leave"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(session.leave).toHaveBeenCalledWith('les-bras-casses', ACTOR);
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('stays where it is when leaving is refused', async () => {
    records.run.mockResolvedValueOnce(false);
    const { dom, show, fixture } = await mount();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    await show(summary());
    (dom.querySelector('[data-action="leave"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    (dom.querySelector('[data-action="confirm-leave"]') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('closes the subscription when it leaves the screen, and reopens it when the world changes', async () => {
    const { fixture } = await mount();
    fixture.componentRef.setInput('worldId', 'vallee-basse');
    await fixture.whenStable();
    expect(stop).toHaveBeenCalledOnce();
    expect(session.watchWorld).toHaveBeenLastCalledWith('vallee-basse', expect.any(Function));
    fixture.destroy();
    expect(stop).toHaveBeenCalledTimes(2);
  });

  it('drops the previous world off the screen the moment it navigates, before the new one answers', async () => {
    const { dom, show, fixture } = await mount('les-bras-casses');
    await show(summary('les-bras-casses'));
    expect(dom.querySelector('beacon-session-page')).not.toBeNull();

    fixture.componentRef.setInput('worldId', 'vallee-basse');
    await fixture.whenStable();

    expect(dom.querySelector('beacon-session-page')).toBeNull();
    expect(dom.querySelector('[data-field="world-name"]')).toBeNull();
  });
});
