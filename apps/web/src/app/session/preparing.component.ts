import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import {
  SETUP_STEPS,
  setupStepRank,
  type SessionSettings,
  type ShownSetup,
} from '@beacon/session';
import type { ServerView } from '@beacon/session-record/client';
import { CLOCK } from '../clock';
import { activityLabel, euroLabel, hourLabel, stepLabel, windowLabel } from '../format';

/** One of the four lengths the rule under the step is cut in. */
interface Length {
  readonly state: 'done' | 'cur' | 'todo';
  /** Null for a length to come while the order of the game is not known. */
  readonly name: string | null;
  /** How far the length under way is filled, when the game server measures it. */
  readonly at: string | null;
  readonly waiting: boolean;
}

function lengthsOf(shown: ShownSetup, rank: number): Length[] {
  const { step, progress } = shown.step;
  return SETUP_STEPS.map((_, index) => {
    const position = index + 1;
    if (position !== rank) {
      const named = shown.order?.[index] ?? null;
      return {
        state: position < rank ? 'done' : 'todo',
        // Without the order of the game, only the step under way has a name.
        name: named === null ? null : stepLabel(named),
        at: null,
        waiting: false,
      };
    }
    return {
      state: 'cur',
      name: stepLabel(step),
      at: progress === null ? null : `${progress}%`,
      waiting: progress === null,
    };
  });
}

/**
 * The screen that releases. It says where the setup is — the step under way,
 * its rank, the hour it began, and how far it has got when the game server
 * measures it — and hands the user back to their evening. It never draws a
 * progress no measure carries: a step with no figure gets a length that
 * passes, and no percentage.
 *
 * A window and never an hour: two setups of the same game end minutes apart,
 * and an hour contradicted releases nobody. It is drawn from the last setups
 * of the game that came into service, and this screen computes neither of
 * its hours. While the game counts too few, the line goes and nothing stands
 * in for it.
 */
@Component({
  selector: 'beacon-preparing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hero">
      @if (step(); as step) {
        <div class="stephero">
          <span class="k">Step</span>
          <div class="clock" data-field="step-rank">{{ step.rank }}<span class="of">/{{ total }}</span></div>
          <div class="what">
            <div class="name" data-field="step-name">{{ step.name }}</div>
            <div class="meta tabular">
              @if (step.progress !== null) {
                <b data-field="step-progress">{{ step.progress }} %</b>
              }
              <span data-field="step-said">{{ step.said }}</span>
            </div>
          </div>
        </div>
      }
      <div class="right">
        @if (window(); as window) {
          <div>
            <span class="k">Ready between</span>
            <div class="v tabular" data-field="ready-window">{{ window.from }}<span
                class="to"> – </span>{{ window.to }}</div>
          </div>
        }
        <div>
          <span class="k">Closes at</span>
          <div class="v tabular" [class.sm]="window() !== null" data-field="closes-at">{{ closesAt() }}</div>
        </div>
      </div>
      @if (step(); as step) {
        <div class="track" role="img" [attr.aria-label]="step.spoken">
          @for (length of step.lengths; track $index) {
            <div [attr.data-length]="length.state" [class.wait]="length.waiting">
              <i [style.--at]="length.at"></i>
              @if (length.name !== null) {
                <span class="k">{{ length.name }}</span>
              }
            </div>
          }
        </div>
      }
    </div>

    <div class="mid">
      <div class="release">
        <div class="big">No need to stay.</div>
        <div class="sub">
          Close the tab and go back to your evening. The server will be up, and it will close
          itself at {{ closesAt() }} whether anyone comes back to this page or not.
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
        <div>
          <span class="k">Opened at</span>
          <div class="v tabular" data-field="opened-at">{{ openedAt() }}</div>
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
  styleUrl: './preparing.component.css',
})
export class PreparingComponent {
  readonly view = input.required<ServerView>();
  readonly settings = input.required<SessionSettings>();

  readonly closed = output<void>();

  private readonly clock = inject(CLOCK);

  readonly total = SETUP_STEPS.length;

  /** Everything the screen says of the step under way, or null when it is given no setup. */
  readonly step = computed(() => {
    const shown = this.view().setup;
    if (shown === null) return null;

    const rank = setupStepRank(shown);
    const { step, since, activity, progress } = shown.step;
    const name = stepLabel(step);
    const begun = `since ${hourLabel(since)}`;

    return {
      rank,
      name,
      progress,
      said: activity === null ? begun : `${activityLabel(activity)} · ${begun}`,
      spoken: [
        `Step ${rank} of ${this.total}`,
        name,
        ...(progress === null ? [] : [`${progress} percent`]),
      ].join(', '),
      lengths: lengthsOf(shown, rank),
    };
  });

  readonly window = computed(() => {
    const window = this.view().readyWindow;
    return window === null ? null : windowLabel(window);
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
