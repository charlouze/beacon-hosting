import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter, withComponentInputBinding } from '@angular/router';
import type { Viewer } from '@beacon/membership-record/client';
import { DEFAULT_SETTINGS } from '@beacon/session';
import { App } from './app';
import { routes } from './app.routes';
import { Records } from './records';

const MEMBER: Viewer = {
  kind: 'member',
  member: { uid: 'u1', name: 'Charlouze', role: 'player', steamId: null },
};

describe('App', () => {
  const viewer = signal<Viewer>({ kind: 'signed-out' });
  const error = signal<string | null>(null);

  const records = {
    viewer,
    member: () => (viewer().kind === 'member' ? (viewer() as { member: unknown }).member : null),
    visitor: () => (viewer().kind === 'visitor' ? 'Alex Durand' : null),
    error,
    signIn: vi.fn(),
    signOut: vi.fn(),
  };

  const show = async (next: Viewer) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: Records, useValue: records }] });
    viewer.set(next);
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('shows the one door to somebody who is signed out', async () => {
    const dom = await show({ kind: 'signed-out' });
    expect(dom.querySelector('beacon-signed-out')).not.toBeNull();
  });

  it('shows the visitor screen to an account that is not a member', async () => {
    const dom = await show({ kind: 'visitor', identity: { uid: 'u2', name: 'Alex Durand' } });
    expect(dom.querySelector('beacon-visitor')).not.toBeNull();
    expect(dom.textContent).toContain('Alex Durand');
  });

  it('shows neither access screen to a member', async () => {
    const dom = await show(MEMBER);
    expect(dom.querySelector('beacon-signed-out')).toBeNull();
    expect(dom.querySelector('beacon-visitor')).toBeNull();
  });

  it('shows a refused write as a band, never swallowed', async () => {
    error.set('permission-denied');
    const dom = await show(MEMBER);
    expect(dom.querySelector('[role="alert"]')?.textContent).toContain('permission-denied');
  });
});

describe('App routes', () => {
  // `viewer` et `error` sont ceux du describe précédent, partagés par le fichier.
  const viewer = signal<Viewer>({ kind: 'signed-out' });
  const error = signal<string | null>(null);

  const records = {
    viewer,
    member: () => (viewer().kind === 'member' ? (viewer() as { member: unknown }).member : null),
    visitor: () => (viewer().kind === 'visitor' ? 'Alex Durand' : null),
    settings: signal(DEFAULT_SETTINGS),
    error,
    actor: () => ({ uid: 'u1', name: 'Charlouze' }),
    session: () => ({
      watchMyWorlds: () => () => undefined,
      watchWorld: () => () => undefined,
      join: async () => {
        throw new Error('wrong invite code');
      },
    }),
    run: async () => true,
    signIn: vi.fn(),
    signOut: vi.fn(),
    declareSteamId: vi.fn(),
  };

  const open = async (url: string, next: Viewer) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes, withComponentInputBinding()),
        { provide: Records, useValue: records },
      ],
    });
    viewer.set(next);
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl(url);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('routes a member to the list at the root', async () => {
    const dom = await open('/', MEMBER);
    expect(dom.querySelector('beacon-worlds-route')).not.toBeNull();
  });

  it('routes a member to a world by its id', async () => {
    const dom = await open('/worlds/dev-world', MEMBER);
    expect(dom.querySelector('beacon-world-route')).not.toBeNull();
  });

  it('routes a member to the join page by world and code', async () => {
    const dom = await open('/join/dev-world/c0de', MEMBER);
    expect(dom.querySelector('beacon-join-route')).not.toBeNull();
  });

  it('brings an unknown address back to the list', async () => {
    const dom = await open('/nowhere', MEMBER);
    expect(dom.querySelector('beacon-worlds-route')).not.toBeNull();
    expect(TestBed.inject(Router).url).toBe('/');
  });

  it('keeps the address while somebody signed out is at the door', async () => {
    const dom = await open('/join/dev-world/c0de', { kind: 'signed-out' });
    expect(dom.querySelector('beacon-signed-out')).not.toBeNull();
    expect(dom.querySelector('router-outlet')).toBeNull();
    expect(TestBed.inject(Router).url).toBe('/join/dev-world/c0de');
  });
});
