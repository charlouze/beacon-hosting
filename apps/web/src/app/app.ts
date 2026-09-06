import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { connectSessionRecord } from '@beacon/session-record/client';
import { DEFAULT_SETTINGS, type Session, type SessionSettings } from '@beacon/session';
import { JoinInfoComponent } from './join-info.component';

/**
 * The tranche 2 driver. It is not the screen: the visual world, the five
 * states on one page, the countdown and the release during boot are tranche 5,
 * with the `impeccable` skill and the five firm constraints of
 * `.impeccable/mocks/decision/README.md`.
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
    <p>State: {{ state() }}</p>
    <p>Closing time: {{ closingTime() }}</p>

    <button type="button" [disabled]="state() !== 'IDLE'" (click)="open()">
      Start a session
    </button>
    <button type="button" [disabled]="!canExtend()" (click)="extend()">
      Extend by one hour
    </button>
    <button type="button" [disabled]="!canStop()" (click)="stop()">Stop</button>

    <beacon-join-info [session]="session()" />

    @if (error(); as message) {
      <p role="alert">{{ message }}</p>
    }
  `,
})
export class App {
  private readonly record = connectSessionRecord({
    // A demo project id and a placeholder key: the driver only ever talks to
    // the emulator, and no real credential belongs in this repository (§7).
    app: initializeApp({ projectId: 'demo-beacon', apiKey: 'demo' }),
    emulator: { host: '127.0.0.1', port: 8080 },
  });

  readonly session = signal<Session | null>(null);
  readonly error = signal<string | null>(null);
  private readonly settings = signal<SessionSettings>(DEFAULT_SETTINGS);

  private readonly clock = { now: () => new Date() };
  private readonly actor = { uid: 'driver', name: 'Driver' };

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
    this.record.watch((session) => this.session.set(session));
    this.record.watchSettings((settings) => this.settings.set(settings));
  }

  open(): void {
    this.run(() =>
      this.record.open({
        sessionId: crypto.randomUUID(),
        game: 'enshrouded',
        actor: this.actor,
      }),
    );
  }

  extend(): void {
    this.run(() => this.record.extend(this.actor));
  }

  stop(): void {
    this.run(() => this.record.requestStop(this.actor));
  }

  /** Shown rather than swallowed: a refused write is what a driver is for. */
  private run(action: () => Promise<void>): void {
    this.error.set(null);
    action().catch((cause: unknown) => this.error.set(String(cause)));
  }
}
