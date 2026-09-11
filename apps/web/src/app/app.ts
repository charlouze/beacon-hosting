import {
  ChangeDetectionStrategy,
  Component,
  InjectionToken,
  computed,
  inject,
  signal,
} from '@angular/core';
import type { FirebaseApp } from 'firebase/app';
import {
  connectSessionRecord,
  type ClientSessionRecord,
  type ServerView,
} from '@beacon/session-record/client';
import { connectMembershipRecord, type Viewer } from '@beacon/membership-record/client';
import { DEFAULT_SETTINGS, type Game, type SessionSettings } from '@beacon/session';
import { SignedOutComponent } from './access/signed-out.component';
import { VisitorComponent } from './access/visitor.component';
import { COMPILED_RULES_VERSION } from './rules-version';
import { SessionPage } from './session/session.page';

export interface FirebaseConnection {
  readonly app: FirebaseApp;
  /** Set when nothing hosts us. The emulator is this project's preproduction (§10). */
  readonly emulator?: { readonly host: string; readonly port: number };
}

/**
 * Resolved in `main.ts`, before the application boots: whether Hosting serves
 * a configuration is answered over the network, and a component cannot wait
 * for that answer.
 */
export const FIREBASE_CONNECTION = new InjectionToken<FirebaseConnection>('beacon.connection');

/**
 * Starting the tab over. A token and not a call to `location`, for the reason
 * `CLOCK` is one: the browser's own globals are the one thing a test cannot
 * replace, and the drift reload is exactly the behaviour that has to be
 * proven.
 */
export const RELOAD = new InjectionToken<() => void>('beacon.reload', {
  factory: () => () => location.reload(),
});

/**
 * The shell, and nothing else: the two connections, the routing between signed
 * out, visitor and member, the life of the subscriptions, the reload on
 * version drift, and the passing of actions down to the records.
 *
 * Everything visible lives in a component. What the driver did in bare `<h1>`
 * and `<button>` had no reason to survive — its own comment asked for that.
 */
@Component({
  selector: 'beacon-root',
  standalone: true,
  imports: [SessionPage, SignedOutComponent, VisitorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (member(); as member) {
      <beacon-session-page
        [view]="view()"
        [settings]="settings()"
        [member]="member"
        (opened)="open($event)"
        (extended)="extend()"
        (closed)="stop()"
        (declared)="declareSteamId($event)"
        (signedOut)="signOut()"
      />
    } @else if (visitor(); as name) {
      <beacon-visitor [name]="name" (signOut)="signOut()" />
    } @else {
      <beacon-signed-out (signIn)="signIn()" />
    }

    @if (error(); as message) {
      <p class="alert" role="alert">{{ message }}</p>
    }
  `,
  styles: `
    /* A refused write is shown, never swallowed. A band across the bottom, in
       the one red, because it is a warning and warnings are what that red is
       for. */
    .alert {
      position: fixed;
      inset: auto 0 0 0;
      background: var(--red);
      color: var(--paper);
      padding: 14px 24px;
      font-size: 14px;
      text-align: center;
    }
  `,
})
export class App {
  private readonly connection = inject(FIREBASE_CONNECTION);
  private readonly membership = connectMembershipRecord(this.connection);
  private readonly reload = inject(RELOAD);

  readonly view = signal<ServerView | null>(null);
  readonly error = signal<string | null>(null);
  private readonly viewer = signal<Viewer>({ kind: 'signed-out' });
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

  open(game: Game): void {
    const member = this.member();
    if (member === null) return;
    this.run(() =>
      this.record().open({
        sessionId: crypto.randomUUID(),
        game,
        actor: { uid: member.uid, name: member.name },
      }),
    );
  }

  extend(): void {
    const member = this.member();
    if (member === null) return;
    this.run(() => this.record().extend({ uid: member.uid, name: member.name }));
  }

  stop(): void {
    const member = this.member();
    if (member === null) return;
    this.run(() => this.record().requestStop({ uid: member.uid, name: member.name }));
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
    const record = this.record();
    this.subscriptions = [
      record.watch((view) => this.view.set(view)),
      record.watchSettings((settings) => this.settings.set(settings)),
      // The humble gesture: a tab running yesterday's rules against today's
      // deployment cannot be reasoned back into agreement, it can only start
      // over.
      record.watchVersionDrift(COMPILED_RULES_VERSION, () => this.reload()),
    ];
  }

  private unfollow(): void {
    for (const stop of this.subscriptions.splice(0)) stop();
    this.view.set(null);
    // Dropped, not kept: the record holds one listener on `config/settings` it
    // opens in its own constructor and offers no way to close. Signing out
    // gets that read refused, which ends the listener for good — and a record
    // reused after a second sign-in would carry frozen settings and a version
    // drift that can no longer fire. Sign out, sign in, and the reload of §4
    // is off without a word.
    this.connected = null;
  }

  /** Opened on the first membership: its own listener reads a member's document. */
  private record(): ClientSessionRecord {
    this.connected ??= connectSessionRecord(this.connection);
    return this.connected;
  }

  /** Shown rather than swallowed: a refused write is what the screen owes back. */
  private run(action: () => Promise<void>): void {
    this.error.set(null);
    action().catch((cause: unknown) => this.error.set(String(cause)));
  }
}
