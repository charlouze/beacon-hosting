import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { forecastCost, type SessionSettings } from '@beacon/session';
import type { ServerView } from '@beacon/session-record/client';
import { CLOCK } from '../clock';
import { euroLabel, hourLabel } from '../format';

/**
 * The screen most often seen, and the one a refused start comes back to. §8:
 * a creation the provider refuses is cleaned up and returns to `IDLE` with
 * `lastError`, the button clickable at once. That is not a sixth state — it is
 * this screen with a warning, and one word different on the button.
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
        <div class="acts">
          <button type="button" class="btn xl" data-action="open" (click)="opened.emit()">
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

  readonly opened = output<void>();

  private readonly clock = inject(CLOCK);

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
