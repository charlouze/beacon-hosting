import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Member } from '@beacon/membership-record/client';
import type { ServerView } from '@beacon/session-record/client';
import type { SessionSettings, World } from '@beacon/session';
import { stateLabel } from '../format';
import { ClosingComponent } from './closing.component';
import { InServiceComponent } from './in-service.component';
import { NotClearedComponent } from './not-cleared.component';
import { OutOfServiceComponent } from './out-of-service.component';
import { PreparingComponent } from './preparing.component';
import { SteamDeclarationComponent } from './steam-declaration.component';
import { WorldBandComponent } from './world-band.component';

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
    RouterLink,
    SteamDeclarationComponent,
    WorldBandComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './session.page.html',
  styleUrl: './session.page.css',
})
export class SessionPage {
  readonly view = input.required<ServerView | null>();
  readonly world = input.required<World>();
  readonly settings = input.required<SessionSettings>();
  readonly member = input.required<Member>();

  readonly opened = output<void>();
  readonly extended = output<void>();
  readonly closed = output<void>();
  readonly declared = output<string>();
  readonly signedOut = output<void>();

  /** Relayed from the band of the world, which alone renders them. */
  readonly renamed = output<string>();
  readonly reinvited = output<void>();
  readonly left = output<void>();

  readonly state = computed(() => this.view()?.session.state ?? 'unreadable');
  readonly announced = computed(() => stateLabel(this.state()));
}
