import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { forecastCost, type SessionSettings } from '@beacon/session';
import type { ServerView } from '@beacon/session-record/client';
import { CLOCK } from '../clock';
import { euroLabel, hourLabel, stoppedAt } from '../format';

/**
 * The screen most often seen, and the one a start that failed comes back to.
 * A creation the provider refuses, or a setup that is abandoned, is cleaned up
 * and returns to `IDLE`, the button clickable at once. That is not a sixth
 * state — it is this screen with a warning, and one word different on the
 * button.
 *
 * Where the setup stopped is a step and an hour, and nothing a game server
 * wrote. What the host said is quoted only when the host said something.
 */
@Component({
  selector: 'beacon-out-of-service',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mid">
      <div class="empty">
        <div>
          @if (stopped() !== null) {
            <div class="big sm">It didn’t start.</div>
            <div class="sub">
              Nothing was left running, and nothing is costing anything. Press again; if it stops
              at the same step twice, tell whoever runs this.
            </div>
          } @else if (refusal() !== null) {
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

      @if (stopped(); as stopped) {
        <div class="warn" data-field="stopped-at">
          <span class="k" data-warn>Where it stopped, at {{ stopped.at }}</span>
          <div class="said">
            <b>Step {{ stopped.rank }} of {{ stopped.total }}</b> · {{ stopped.name }}
          </div>
        </div>
      }

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
            {{ didNotStart() ? 'Try again' : 'Open the service' }}
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

  readonly stopped = computed(() => stoppedAt(this.view().setup));

  readonly didNotStart = computed(() => this.refusal() !== null || this.stopped() !== null);

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
