import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import type { SessionSettings } from '@beacon/session';
import type { ServerView } from '@beacon/session-record/client';
import { CLOCK } from '../clock';
import { euroLabel, hourLabel, readyWindow } from '../format';

/**
 * The screen that releases. Constraint no. 3, word for word: the interface
 * announces the hour the server will answer and hands the user back to their
 * evening — it never tries to hold or occupy the wait. So: no progress bar, no
 * step, no percentage, nothing turning, and a sentence that gives the evening
 * back.
 *
 * A window and never an hour, and it is the probe that imposes it: 4 min 49 s
 * then 7 min 58 s on the same size in the same zone. What earned the right to
 * come back with the measurement is a figure; not its precision.
 *
 * The window opens from `stateSince` and not from `startedAt`: the same
 * instant today, a different one the day a state precedes another.
 */
@Component({
  selector: 'beacon-preparing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hero">
      <div>
        <span class="k">Ready between</span>
        @if (window(); as window) {
          <div class="clock range tabular" data-field="ready-window">{{ window.from }}<span
              class="to"> – </span>{{ window.to }}</div>
        }
      </div>
      <div class="right">
        <div>
          <span class="k">Closes at</span>
          <div class="v tabular" data-field="closes-at">{{ closesAt() }}</div>
        </div>
        <div>
          <span class="k">Opened at</span>
          <div class="v sm tabular" data-field="opened-at">{{ openedAt() }}</div>
        </div>
      </div>
    </div>

    <div class="rule-thin"></div>

    <div class="mid">
      <div class="release">
        <div class="big">Nothing to watch here.</div>
        <div class="sub">
          Close the tab and go back to your evening. The server will be up, and it will close
          itself at {{ closesAt() }} whether anyone comes back to this page or not. Five to eight
          minutes is what it has taken so far, and it moves with the network.
        </div>
      </div>
    </div>

    <div class="rule-thin"></div>

    <div class="foot">
      <div class="money">
        <div>
          <span class="k">This session</span>
          <div class="v tabular" data-field="cost">{{ cost() }}</div>
        </div>
      </div>
      <div class="btncol">
        <div class="acts">
          <button type="button" class="btn ghost" data-action="close" (click)="closed.emit()">
            Close it now
          </button>
        </div>
        <div class="hint">The first hour is charged either way.</div>
      </div>
    </div>
  `,
  styles: `
    :host {
      flex: 1;
      display: flex;
      flex-direction: column;
    }
  `,
})
export class PreparingComponent {
  readonly view = input.required<ServerView>();
  readonly settings = input.required<SessionSettings>();

  readonly closed = output<void>();

  private readonly clock = inject(CLOCK);

  readonly window = computed(() => {
    const since = this.view().stateSince;
    return since === null ? null : readyWindow(since);
  });

  readonly closesAt = computed(() =>
    hourLabel(this.view().session.displayedDeadline(this.clock, this.settings()).at),
  );

  readonly openedAt = computed(() => {
    const at = this.view().session.startedAt;
    return at === null ? '' : hourLabel(at);
  });

  readonly cost = computed(() =>
    euroLabel(this.view().session.estimatedCost(this.clock, this.settings())),
  );
}
