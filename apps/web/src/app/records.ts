import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { connectSessionRecord, type ClientSessionRecord } from '@beacon/session-record/client';
import { connectMembershipRecord, type Viewer } from '@beacon/membership-record/client';
import { DEFAULT_SETTINGS, type Actor, type SessionSettings } from '@beacon/session';
import { FIREBASE_CONNECTION, RELOAD } from './app';
import { COMPILED_RULES_VERSION } from './rules-version';

/**
 * The page's own address, as a token and not a call to `location`, for the
 * reason `RELOAD` and `CLOCK` are ones: the browser's own globals are the one
 * thing a test cannot replace.
 */
export const ORIGIN = new InjectionToken<string>('beacon.origin', {
  factory: () => location.origin,
});

/**
 * Tokens rather than direct calls to `connectMembershipRecord`/
 * `connectSessionRecord`: a test replaces a provider, not a module — `vi.mock`
 * on a workspace package is what the esbuild-based test runner does not
 * reliably hoist, a gap that only shows on Linux CI, never on this file's own
 * platform.
 */
export const CONNECT_MEMBERSHIP = new InjectionToken<typeof connectMembershipRecord>(
  'beacon.connect-membership',
  { factory: () => connectMembershipRecord },
);
export const CONNECT_SESSION = new InjectionToken<typeof connectSessionRecord>(
  'beacon.connect-session',
  { factory: () => connectSessionRecord },
);

/**
 * The browser's composition root: the two connections, the viewer and its
 * subscriptions, and the passing of actions down to the records. A screen
 * asks it for the session record and for an actor, and never for
 * `FIREBASE_CONNECTION` itself — that stays here, and nowhere else in
 * `apps/web`.
 */
@Injectable({ providedIn: 'root' })
export class Records {
  private readonly connection = inject(FIREBASE_CONNECTION);
  private readonly connectMembership = inject(CONNECT_MEMBERSHIP);
  private readonly connectSession = inject(CONNECT_SESSION);
  private readonly membership = this.connectMembership(this.connection);
  private readonly reload = inject(RELOAD);

  readonly error = signal<string | null>(null);
  readonly viewer = signal<Viewer>({ kind: 'signed-out' });
  readonly settings = signal<SessionSettings>(DEFAULT_SETTINGS);

  private subscriptions: (() => void)[] = [];
  private connected: ClientSessionRecord | null = null;

  readonly member = computed(() => {
    const viewer = this.viewer();
    return viewer.kind === 'member' ? viewer.member : null;
  });

  readonly visitor = computed(() => {
    const viewer = this.viewer();
    return viewer.kind === 'visitor' ? viewer.identity.name : null;
  });

  constructor() {
    this.membership.watchViewer(
      (viewer) => this.onViewer(viewer),
      (cause) => this.error.set(String(cause)),
    );
  }

  /** Opened on the first membership: its own listener reads a member's document. */
  session(): ClientSessionRecord {
    this.connected ??= this.connectSession(this.connection);
    return this.connected;
  }

  actor(): Actor {
    const member = this.member();
    if (member === null) throw new Error('nobody is a member');
    return { uid: member.uid, name: member.name };
  }

  /** Shown rather than swallowed: a refused write is what the screen owes back. */
  async run(action: () => Promise<void>): Promise<boolean> {
    this.error.set(null);
    try {
      await action();
      return true;
    } catch (cause) {
      this.error.set(String(cause));
      return false;
    }
  }

  signIn(): void {
    this.run(() => this.membership.signIn());
  }

  signOut(): void {
    this.run(() => this.membership.signOut());
  }

  declareSteamId(steamId: string): void {
    this.run(() => this.membership.declareSteamId(steamId));
  }

  /**
   * Every document the session record reads is a member's (§5), so the
   * subscriptions live exactly as long as the membership does. A visitor left
   * subscribed to `server/current` would be refused by the rules for the whole
   * life of the tab, and the screen would show an empty board rather than the
   * one thing that is true: it is not a member.
   */
  private onViewer(viewer: Viewer): void {
    this.viewer.set(viewer);
    if (viewer.kind === 'member') this.follow();
    else this.unfollow();
  }

  private follow(): void {
    // `watchViewer` republishes on every snapshot of `members/{uid}` — a
    // declared steam id is one — and each would open a second set.
    if (this.subscriptions.length > 0) return;
    const record = this.session();
    this.subscriptions = [
      record.watchSettings((settings) => this.settings.set(settings)),
      // The humble gesture: a tab running yesterday's rules against today's
      // deployment cannot be reasoned back into agreement, it can only start
      // over.
      record.watchVersionDrift(COMPILED_RULES_VERSION, () => this.reload()),
    ];
  }

  private unfollow(): void {
    for (const stop of this.subscriptions.splice(0)) stop();
    // Dropped, not kept: the record holds one listener on `config/settings` it
    // opens in its own constructor and offers no way to close. Signing out
    // gets that read refused, which ends the listener for good — and a record
    // reused after a second sign-in would carry frozen settings and a version
    // drift that can no longer fire. Sign out, sign in, and the reload of §4
    // is off without a word.
    this.connected = null;
  }
}
