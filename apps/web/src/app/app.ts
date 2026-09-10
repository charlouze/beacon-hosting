import {
  ChangeDetectionStrategy,
  Component,
  InjectionToken,
  computed,
  inject,
  signal,
} from '@angular/core';
import type { FirebaseApp } from 'firebase/app';
import { connectSessionRecord, type ClientSessionRecord } from '@beacon/session-record/client';
import { connectMembershipRecord, type Viewer } from '@beacon/membership-record/client';
import { DEFAULT_SETTINGS, type Session, type SessionSettings } from '@beacon/session';
import { JoinInfoComponent } from './join-info.component';
import { COMPILED_RULES_VERSION } from './rules-version';

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
 * The tranche 2 driver, signed in since tranche 4. It is not the screen: the
 * visual world, the five states on one page, the countdown and the release
 * during boot are tranche 5, with the `impeccable` skill and the five firm
 * constraints of `.impeccable/mocks/decision/README.md`.
 *
 * Deliberately unstyled, so that nothing here survives into that work by
 * accident.
 */
@Component({
  selector: 'beacon-root',
  standalone: true,
  imports: [JoinInfoComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Beacon — driver</h1>

    @if (member(); as member) {
      <p>Signed in as {{ member.name }} ({{ member.role }})</p>
      <button type="button" (click)="signOut()">Sign out</button>

      <p>State: {{ state() }}</p>
      <p>Closing time: {{ closingTime() }}</p>

      <button type="button" [disabled]="state() !== 'IDLE'" (click)="open()">Start a session</button>
      <button type="button" [disabled]="!canExtend()" (click)="extend()">Extend by one hour</button>
      <button type="button" [disabled]="!canStop()" (click)="stop()">Stop</button>

      <beacon-join-info [session]="session()" />

      <p>
        <label>Steam id <input #steam type="text" [value]="member.steamId ?? ''" /></label>
        <button type="button" (click)="declareSteamId(steam.value)">Declare</button>
      </p>
    } @else if (visitor(); as name) {
      <p>{{ name }}: signed in, not a member</p>
      <button type="button" (click)="signOut()">Sign out</button>
    } @else {
      <button type="button" (click)="signIn()">Sign in</button>
    }

    @if (error(); as message) {
      <p role="alert">{{ message }}</p>
    }
  `,
})
export class App {
  private readonly connection = inject(FIREBASE_CONNECTION);
  private readonly membership = connectMembershipRecord(this.connection);

  readonly session = signal<Session | null>(null);
  readonly error = signal<string | null>(null);
  private readonly viewer = signal<Viewer>({ kind: 'signed-out' });
  private readonly settings = signal<SessionSettings>(DEFAULT_SETTINGS);

  private readonly clock = { now: () => new Date() };
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

  readonly state = computed(() => this.session()?.state ?? 'unreadable');

  readonly closingTime = computed(() => {
    const session = this.session();
    if (session === null || session.state === 'IDLE') return '—';
    // Never the raw deadline: the domain bounds on read, so the countdown
    // cannot walk backwards when the watchdog clamps a forged one (§4).
    return session.displayedDeadline(this.clock, this.settings()).at.toISOString();
  });

  readonly canExtend = computed(() =>
    (this.session()?.canExtend(this.clock, this.settings()) ?? false),
  );

  readonly canStop = computed(() => this.session()?.canRequestStop() ?? false);

  constructor() {
    this.membership.watchViewer(
      (viewer) => this.onViewer(viewer),
      (cause) => this.error.set(String(cause)),
    );
  }

  open(): void {
    const member = this.member();
    if (member === null) return;
    this.run(() =>
      this.record().open({
        sessionId: crypto.randomUUID(),
        game: 'enshrouded',
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
   * life of the tab, and the driver would show an empty state rather than the
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
      record.watch((session) => this.session.set(session)),
      record.watchSettings((settings) => this.settings.set(settings)),
      // The humble gesture: a tab running yesterday's rules against today's
      // deployment cannot be reasoned back into agreement, it can only start
      // over.
      record.watchVersionDrift(COMPILED_RULES_VERSION, () => location.reload()),
    ];
  }

  private unfollow(): void {
    for (const stop of this.subscriptions.splice(0)) stop();
    this.session.set(null);
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

  /** Shown rather than swallowed: a refused write is what a driver is for. */
  private run(action: () => Promise<void>): void {
    this.error.set(null);
    action().catch((cause: unknown) => this.error.set(String(cause)));
  }
}
