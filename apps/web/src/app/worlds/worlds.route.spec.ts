import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DEFAULT_SETTINGS, World } from '@beacon/session';
import type { WorldSummary } from '@beacon/session-record/client';
import { CLOCK } from '../clock';
import { Records } from '../records';
import { WorldsRoute } from './worlds.route';

const FIXED_CLOCK = { now: () => new Date('2026-09-12T21:27:00') };

describe('WorldsRoute', () => {
  let publish: (worlds: readonly WorldSummary[]) => void;
  const stop = vi.fn();
  const watchMyWorlds = vi.fn((_uid: string, on: (w: readonly WorldSummary[]) => void) => {
    publish = on;
    return stop;
  });
  const records = {
    member: signal({ uid: 'u1', name: 'Charlouze', role: 'player', steamId: null }),
    settings: signal(DEFAULT_SETTINGS),
    session: () => ({ watchMyWorlds }),
    signOut: vi.fn(),
  };

  const mount = async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: CLOCK, useValue: FIXED_CLOCK },
        { provide: Records, useValue: records },
      ],
    });
    const fixture = TestBed.createComponent(WorldsRoute);
    await fixture.whenStable();
    return fixture;
  };

  beforeEach(() => {
    stop.mockClear();
    watchMyWorlds.mockClear();
    records.signOut.mockClear();
  });

  it('watches the worlds of the member, and hands them to the page', async () => {
    const fixture = await mount();
    expect(watchMyWorlds).toHaveBeenCalledWith('u1', expect.any(Function));
    publish([
      {
        world: World.from({
          worldId: 'a',
          game: 'enshrouded',
          name: 'Les bras cassés',
          inviteCode: 'c0de',
          players: ['u1'],
        }),
        server: null,
      },
    ]);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Les bras cassés');
  });

  it('closes the subscription when it leaves the screen', async () => {
    const fixture = await mount();
    fixture.destroy();
    expect(stop).toHaveBeenCalledOnce();
  });

  it('signs out through the records', async () => {
    const fixture = await mount();
    (fixture.nativeElement.querySelector('[data-action="sign-out"]') as HTMLButtonElement).click();
    expect(records.signOut).toHaveBeenCalledOnce();
  });

  it('closes the previous subscription when member republishes', async () => {
    const fixture = await mount();
    expect(watchMyWorlds).toHaveBeenCalledTimes(1);
    const firstStop = stop;

    records.member.set({ uid: 'u1', name: 'Charlouze', role: 'player', steamId: null });
    await fixture.whenStable();

    expect(firstStop).toHaveBeenCalledOnce();
    expect(watchMyWorlds).toHaveBeenCalledTimes(2);
  });
});
