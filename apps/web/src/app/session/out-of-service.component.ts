import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { forecastCost, GAMES, type Game, type SessionSettings } from '@beacon/session';
import type { ServerView } from '@beacon/session-record/client';
import { CLOCK } from '../clock';
import { euroLabel, gameLabel, hourLabel } from '../format';

/**
 * The screen most often seen, and the one a refused start comes back to. §8:
 * a creation the provider refuses is cleaned up and returns to `IDLE` with
 * `lastError`, the button clickable at once. That is not a sixth state — it is
 * this screen with a warning, and one word different on the button.
 *
 * The game is recorded, not browsed: the evening was decided on Discord, and
 * the screen takes no part in that choice. Picking one opens nothing.
 */
@Component({
  selector: 'beacon-out-of-service',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mid">
      <div class="empty">
        <div>
          @if (refusal(); as refusal) {
            <div class="big sm">It didn’t start.</div>
            <div class="sub">
              Nothing was left running, and nothing is costing anything. Press again — a refusal
              one minute is usually gone the next.
            </div>
          } @else {
            <div class="big">Nothing is running.</div>
            <div class="sub">It closed itself, which is the whole idea.</div>
          }
        </div>
        <div class="plate">
          <div class="line">
            <span class="k">Next session</span>
            <span class="v">{{ duration() }} · until {{ until() }}</span>
          </div>
          <div class="line">
            <span class="k">Estimated cost</span>
            <span class="v">{{ cost() }}</span>
          </div>
        </div>
      </div>

      @if (refusal(); as refusal) {
        <div class="warn">
          <span class="k" data-warn>What the host said{{ said() }}</span>
          <div class="said" data-field="host-said">{{ refusal }}</div>
        </div>
      }
    </div>

    <div class="foot">
      <div class="money"></div>
      <div class="btncol">
        <div class="pick">
          <span class="k">Game</span>
          <div class="opts" role="group" aria-label="Game for the next session">
            @for (game of games; track game) {
              <button
                type="button"
                [attr.data-game]="game"
                [attr.aria-pressed]="game === chosen()"
                (click)="chosen.set(game)"
              >
                {{ label(game) }}
              </button>
            }
          </div>
        </div>
        <div class="acts">
          <button
            type="button"
            class="btn xl"
            data-action="open"
            (click)="opened.emit(chosen())"
          >
            {{ refusal() === null ? 'Open the service' : 'Try again' }}
          </button>
        </div>
        <div class="hint">We’ll tell you the exact time once it’s on its way.</div>
      </div>
    </div>
  `,
  styleUrl: './out-of-service.component.css',
})
export class OutOfServiceComponent {
  readonly view = input.required<ServerView>();
  readonly settings = input.required<SessionSettings>();

  readonly opened = output<Game>();

  private readonly clock = inject(CLOCK);

  readonly games = GAMES;
  /**
   * One is recorded from the start, so the button is never shut on a screen
   * whose whole job is to be pressable. Which one is arbitrary — nothing on an
   * idle document remembers the last evening — so it is the first, and one
   * press changes it.
   */
  readonly chosen = signal<Game>(GAMES[0]);
  readonly label = gameLabel;

  readonly refusal = computed(() => this.view().facts.lastError);

  /** The instant the refusal was recorded, when the record carries one. */
  readonly said = computed(() => {
    const at = this.view().stateSince;
    return at === null ? '' : `, at ${hourLabel(at)}`;
  });

  readonly duration = computed(
    () => `${Math.round(this.settings().sessionDurationMs / 3_600_000)} h`,
  );

  readonly until = computed(() =>
    hourLabel(new Date(this.clock.now().getTime() + this.settings().sessionDurationMs)),
  );

  readonly cost = computed(() => euroLabel(forecastCost(this.settings())));
}
