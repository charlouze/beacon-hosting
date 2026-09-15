import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MAX_WORLD_NAME, type World } from '@beacon/session';
import { gameLabel, inviteLink } from '../format';
import { CopyButtonComponent } from '../join/copy-button.component';
import { ORIGIN } from '../records';

/**
 * What the world owns apart from any session: its name, the link that makes a
 * player, and how many are on it. Under everything the evening needs, because
 * at half past eleven in alt-tab nobody renames a world.
 *
 * It computes the link itself rather than being handed one. The page above has
 * no other use for it, and passing it through would be a step that carries
 * without deciding.
 *
 * The players are counted and never named: §5 refuses a player the document of
 * another member, so a list of names is a screen this application cannot fill.
 *
 * Nothing is written from here — the three gestures leave as events, which is
 * what lets the band be tested without an emulator.
 */
@Component({
  selector: 'beacon-world-band',
  standalone: true,
  imports: [CopyButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="rule-thin"></div>
    <div class="wband">
      <div class="join-cols">
        <div>
          @if (editing()) {
            <div class="head"><span class="k">Name</span></div>
            <input
              type="text"
              aria-label="Name"
              aria-describedby="world-name-hint"
              data-field="world-name"
              [attr.aria-invalid]="valid() ? null : 'true'"
              [value]="draft()"
              (input)="draft.set($any($event.target).value)"
              (keydown.enter)="saveName()"
              (keydown.escape)="close()"
            />
            <div class="row">
              <button
                class="small fill"
                type="button"
                data-action="save-name"
                [disabled]="!valid()"
                (click)="saveName()"
              >
                Save
              </button>
              <button class="small" type="button" data-action="cancel-name" (click)="close()">
                Cancel
              </button>
            </div>
            <div
              class="sub"
              id="world-name-hint"
              data-field="name-hint"
              [attr.data-warn]="valid() ? null : ''"
            >
              {{ nameHint() }}
            </div>
          } @else {
            <div class="head">
              <span class="k">Name</span>
              <button class="small" type="button" data-action="rename" (click)="rename()">
                Rename
              </button>
            </div>
            <div class="v" data-field="world-name">{{ world().name }}</div>
            <div class="sub" data-field="world-game">{{ gameLine() }}</div>
          }
        </div>

        <div>
          <div class="head">
            <span class="k">Invite link</span>
            <span class="grow"></span>
            @if (!askingLink()) {
              <beacon-copy-button [value]="link()" />
              <button class="small" type="button" data-action="new-link" (click)="askLink()">
                New link
              </button>
            }
          </div>
          <div class="v link" data-field="invite-link">{{ printed()
            }}<span class="code">{{ world().inviteCode }}</span></div>
          <div class="sub" data-field="link-hint">{{ linkHint() }}</div>
          @if (askingLink()) {
            <div class="row">
              <button
                class="small fill"
                type="button"
                data-action="confirm-new-link"
                (click)="confirmLink()"
              >
                New link
              </button>
              <button class="small" type="button" data-action="keep-link" (click)="close()">
                Keep this one
              </button>
            </div>
          }
        </div>

        <div>
          <div class="head">
            <span class="k">Players</span>
            @if (!askingLeave()) {
              <button class="small" type="button" data-action="leave" (click)="askLeave()">
                Leave this world
              </button>
            }
          </div>
          <div class="count" data-field="players-count">{{ world().players.length }}
            <span>including you</span></div>
          @if (askingLeave()) {
            <div class="sub" data-field="leave-hint">
              You’ll need someone’s link to come back. The world stays, and so do its saves.
            </div>
            <div class="row">
              <button
                class="small danger"
                type="button"
                data-action="confirm-leave"
                (click)="confirmLeave()"
              >
                Leave
              </button>
              <button class="small" type="button" data-action="stay" (click)="close()">Stay</button>
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styleUrl: './world-band.component.css',
})
export class WorldBandComponent {
  private readonly origin = inject(ORIGIN);

  readonly world = input.required<World>();

  readonly renamed = output<string>();
  readonly reinvited = output<void>();
  readonly left = output<void>();

  /**
   * One slot for the three, and not three booleans: opening a question closes
   * whichever was open, and two independent flags would let a confirmation sit
   * under an edit nobody meant to leave open.
   */
  private readonly asked = signal<'none' | 'name' | 'link' | 'leave'>('none');
  readonly draft = signal('');

  readonly editing = computed(() => this.asked() === 'name');
  readonly askingLink = computed(() => this.asked() === 'link');
  readonly askingLeave = computed(() => this.asked() === 'leave');

  readonly link = computed(() => inviteLink(this.origin, this.world()));

  /**
   * The scheme is noise in print and essential in the paste, so the printed
   * form is cut out of the one link rather than assembled a second time. What
   * is left off here is the code, which the span beside it sets in the mute.
   */
  readonly printed = computed(() => {
    const bare = this.link().replace(/^https?:\/\//, '');
    return bare.slice(0, bare.lastIndexOf(this.world().inviteCode));
  });

  /** The game, which is read and no longer chosen — frozen at adoption (§4). */
  readonly gameLine = computed(() => {
    const label = gameLabel(this.world().game);
    // Only one of the two games publishes the world's name to whoever browses
    // for a server; for the other, §4 is explicit that this name is ours and
    // not the one the game shows.
    return this.world().game === 'enshrouded'
      ? `${label}. The server announces itself under this name.`
      : `${label}.`;
  });

  private readonly trimmed = computed(() => this.draft().trim());

  readonly valid = computed(() => {
    const length = this.trimmed().length;
    return length > 0 && length <= MAX_WORLD_NAME;
  });

  /** The bound in clear, and the reason when it is broken — never a `title`. */
  readonly nameHint = computed(() => {
    const length = this.trimmed().length;
    const bound = `1 to ${MAX_WORLD_NAME} characters`;
    if (length === 0) return `A world needs a name: ${bound}.`;
    if (length > MAX_WORLD_NAME) return `That is ${length} characters, and a name is ${bound}.`;
    return this.world().game === 'enshrouded'
      ? `${bound}. Enshrouded shows it as the server name from the next start.`
      : `${bound}.`;
  });

  readonly linkHint = computed(() =>
    this.askingLink()
      ? 'This link stops working the moment a new one exists — including the copy on Discord. Make a new one?'
      : 'Whoever opens it while signed in becomes a player. A new link puts this one out of use.',
  );

  rename(): void {
    this.draft.set(this.world().name);
    this.asked.set('name');
  }

  askLink(): void {
    this.asked.set('link');
  }

  askLeave(): void {
    this.asked.set('leave');
  }

  close(): void {
    this.asked.set('none');
  }

  saveName(): void {
    // Guarded rather than only disabled: the Return key reaches this too.
    if (!this.valid()) return;
    this.asked.set('none');
    this.renamed.emit(this.trimmed());
  }

  confirmLink(): void {
    this.asked.set('none');
    this.reinvited.emit();
  }

  confirmLeave(): void {
    this.asked.set('none');
    this.left.emit();
  }
}
