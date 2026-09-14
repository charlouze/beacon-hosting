import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { Member } from '@beacon/membership-record/client';
import type { ServerView } from '@beacon/session-record/client';
import type { Game, SessionSettings } from '@beacon/session';
import { gameLabel } from '../format';
import { ClosingComponent } from './closing.component';
import { InServiceComponent } from './in-service.component';
import { NotClearedComponent } from './not-cleared.component';
import { OutOfServiceComponent } from './out-of-service.component';
import { PreparingComponent } from './preparing.component';
import { SteamDeclarationComponent } from './steam-declaration.component';

/**
 * What the state is called on the board, and the tone it is announced in.
 *
 * A table declared once, not a run of `@if`. The null row — a document this
 * vocabulary cannot read — is a sixth case of the same table rather than a
 * special path, and it says what happened instead of falling silent: an empty
 * board is the one thing worse than bad news.
 */
const STATES = {
  IDLE: { label: 'Out of service', tone: 'off' },
  PROVISIONING: { label: 'Preparing', tone: 'off' },
  RUNNING: { label: 'In service', tone: 'live' },
  STOPPING: { label: 'Closing', tone: 'off' },
  FAILED: { label: 'Not cleared', tone: 'warn' },
  unreadable: { label: 'Unknown', tone: 'warn' },
} as const;

/**
 * The board every state is announced on: the name, the state and its pip, the
 * 4 px rule, then the body of whichever state is current, then the quiet
 * controls that belong to the person rather than to the session.
 *
 * One `view` input and not three. `ServerView` is already the packet the
 * record hands over, and the day it gains a field, five signatures and five
 * test helpers would have to change just to let it through.
 *
 * The actions leave as events and write nothing: the board knows no
 * `*-record`, which is what makes it testable without an emulator.
 */
@Component({
  selector: 'beacon-session-page',
  standalone: true,
  imports: [
    ClosingComponent,
    InServiceComponent,
    NotClearedComponent,
    OutOfServiceComponent,
    PreparingComponent,
    SteamDeclarationComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './session.page.html',
  styleUrl: './session.page.css',
})
export class SessionPage {
  readonly view = input.required<ServerView | null>();
  readonly settings = input.required<SessionSettings>();
  readonly member = input.required<Member>();

  readonly opened = output<Game>();
  readonly extended = output<void>();
  readonly closed = output<void>();
  readonly declared = output<string>();
  readonly signedOut = output<void>();

  readonly state = computed(() => this.view()?.session.state ?? 'unreadable');
  readonly announced = computed(() => STATES[this.state()]);

  /** The game only once it is frozen — which is to say, once a session exists (§4). */
  readonly game = computed(() => {
    const game = this.view()?.session.game ?? null;
    return game === null ? null : gameLabel(game);
  });
}
