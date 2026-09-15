import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Viewer } from '@beacon/membership-record/client';
import { App } from './app';
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
