import { ChangeDetectionStrategy, Component, InjectionToken, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import type { FirebaseApp } from 'firebase/app';
import { SignedOutComponent } from './access/signed-out.component';
import { VisitorComponent } from './access/visitor.component';
import { Records } from './records';

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
 * The shell, and nothing else: three branches — signed out, visitor, member —
 * and the error band. `Records` holds every connection and every
 * subscription; the shell only reads its signals and forwards a gesture.
 *
 * The router outlet exists only in the member branch: neither a door nor a
 * guard, so a signed-out visitor opening a `/join/…` link sees the door, and
 * after signing in the address hasn't moved.
 */
@Component({
  selector: 'beacon-root',
  standalone: true,
  imports: [RouterOutlet, SignedOutComponent, VisitorComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (records.member(); as member) {
      <router-outlet />
    } @else if (records.visitor(); as name) {
      <beacon-visitor [name]="name" (signOut)="records.signOut()" />
    } @else {
      <beacon-signed-out (signIn)="records.signIn()" />
    }

    @if (records.error(); as message) {
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
  protected readonly records = inject(Records);
}
