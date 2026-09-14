import { TestBed } from '@angular/core/testing';
import type { Viewer } from '@beacon/membership-record/client';
import { App, FIREBASE_CONNECTION, RELOAD } from './app';

/**
 * `App` builds a real connection in its field initializers, so the two records
 * are doubled at module level — the only place `vi.mock` can reach them. Each
 * double publishes the callbacks it is handed, which lets these tests play the
 * life of a tab with no emulator at all.
 *
 * What this file holds is the routing and the subscriptions, never the
 * rendering: that is held component by component, where it belongs.
 */
vi.mock('@beacon/session-record/client', () => ({
  connectSessionRecord: () => sessionRecord,
}));
vi.mock('@beacon/membership-record/client', () => ({
  connectMembershipRecord: () => membershipRecord,
}));

type SessionRecordDouble = {
  watch: ReturnType<typeof vi.fn>;
  watchSettings: ReturnType<typeof vi.fn>;
  watchVersionDrift: ReturnType<typeof vi.fn>;
  open: ReturnType<typeof vi.fn>;
  extend: ReturnType<typeof vi.fn>;
  requestStop: ReturnType<typeof vi.fn>;
};

let sessionRecord: SessionRecordDouble;
let membershipRecord: Record<string, ReturnType<typeof vi.fn>>;
let stopWatch: ReturnType<typeof vi.fn>;
let stopSettings: ReturnType<typeof vi.fn>;
let stopDrift: ReturnType<typeof vi.fn>;
let publishViewer: (viewer: Viewer) => void;
let publishDrift: () => void;

const MEMBER: Viewer = {
  kind: 'member',
  member: { uid: 'u1', name: 'Charlouze', role: 'player', steamId: null },
};

describe('App', () => {
  /**
   * A fresh set every test, and not `clearAllMocks` on a shared one. A module
   * `let` that survives from one test to the next makes a test pass because of
   * the one before it — the most expensive failure a suite can have, since it
   * only shows up when the order changes.
   */
  beforeEach(() => {
    TestBed.resetTestingModule();
    stopWatch = vi.fn();
    stopSettings = vi.fn();
    stopDrift = vi.fn();
    sessionRecord = {
      watch: vi.fn((on: (view: unknown) => void) => {
        on(null);
        return stopWatch;
      }),
      watchSettings: vi.fn(() => stopSettings),
      watchVersionDrift: vi.fn((_compiled: string, onDrift: () => void) => {
        publishDrift = onDrift;
        return stopDrift;
      }),
      open: vi.fn(async () => undefined),
      extend: vi.fn(async () => undefined),
      requestStop: vi.fn(async () => undefined),
    };
    membershipRecord = {
      watchViewer: vi.fn((on: (viewer: Viewer) => void) => {
        publishViewer = on;
        return () => undefined;
      }),
      signIn: vi.fn(async () => undefined),
      signOut: vi.fn(async () => undefined),
      declareSteamId: vi.fn(async () => undefined),
    };
  });

  const boot = async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: FIREBASE_CONNECTION, useValue: { app: {} as never } }],
    });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    return fixture;
  };

  const show = async (fixture: Awaited<ReturnType<typeof boot>>, viewer: Viewer) => {
    publishViewer(viewer);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  it('shows the one door to somebody who is signed out', async () => {
    const dom = await show(await boot(), { kind: 'signed-out' });
    expect(dom.querySelector('beacon-signed-out')).not.toBeNull();
    expect(dom.querySelector('beacon-session-page')).toBeNull();
  });

  it('shows the visitor screen to an account that is not a member', async () => {
    const dom = await show(await boot(), {
      kind: 'visitor',
      identity: { uid: 'u2', name: 'Alex Durand' },
    });
    expect(dom.querySelector('beacon-visitor')).not.toBeNull();
    expect(dom.textContent).toContain('Alex Durand');
    expect(dom.querySelector('beacon-session-page')).toBeNull();
  });

  it('shows the board to a member, and no access screen', async () => {
    const dom = await show(await boot(), MEMBER);
    expect(dom.querySelector('beacon-session-page')).not.toBeNull();
    expect(dom.querySelector('beacon-signed-out')).toBeNull();
    expect(dom.querySelector('beacon-visitor')).toBeNull();
  });

  /**
   * Every document the session record reads is a member's (§5), so the
   * subscriptions live exactly as long as the membership does. A visitor left
   * subscribed to `server/current` is refused for the whole life of the tab,
   * and the screen would show an empty board rather than the one thing that is
   * true: it is not a member. The driver earned this behaviour in tranche 4.
   */
  it('drops every subscription the moment a membership ends', async () => {
    const fixture = await boot();
    await show(fixture, MEMBER);
    await show(fixture, { kind: 'visitor', identity: { uid: 'u2', name: 'Alex' } });
    expect(stopWatch).toHaveBeenCalledOnce();
    expect(stopSettings).toHaveBeenCalledOnce();
    expect(stopDrift).toHaveBeenCalledOnce();
  });

  /**
   * `watchViewer` republishes on every snapshot of `members/{uid}` — a declared
   * steam id is one — and each would open a second set.
   */
  it('opens no second set when the member document changes', async () => {
    const fixture = await boot();
    await show(fixture, MEMBER);
    await show(fixture, MEMBER);
    expect(sessionRecord.watch).toHaveBeenCalledOnce();
    expect(sessionRecord.watchSettings).toHaveBeenCalledOnce();
  });

  /**
   * The humble gesture: a tab running yesterday's rules against today's
   * deployment cannot be reasoned back into agreement, it can only start over.
   */
  it('reloads the tab when the deployed rules version drifts', async () => {
    const reload = vi.fn();
    TestBed.configureTestingModule({ providers: [{ provide: RELOAD, useValue: reload }] });
    const fixture = await boot();
    await show(fixture, MEMBER);
    publishDrift();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('carries a refused write to the screen rather than swallowing it', async () => {
    sessionRecord.extend.mockRejectedValueOnce(new Error('permission-denied'));
    const fixture = await boot();
    const dom = await show(fixture, MEMBER);
    fixture.componentInstance.extend();
    // Twice: the rejection lands in a microtask of its own, and the first
    // settle is the one that lets it through.
    await fixture.whenStable();
    await fixture.whenStable();
    expect(dom.querySelector('[role="alert"]')?.textContent).toContain('permission-denied');
  });

  it('opens the game the screen recorded, and not one compiled in here', async () => {
    const fixture = await boot();
    await show(fixture, MEMBER);
    fixture.componentInstance.open('sunkenland');
    await fixture.whenStable();
    expect(sessionRecord.open).toHaveBeenCalledWith(
      expect.objectContaining({ game: 'sunkenland', actor: { uid: 'u1', name: 'Charlouze' } }),
    );
  });
});
