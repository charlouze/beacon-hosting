import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { forecastCost, type PreflightFailure, type SessionSettings } from '@beacon/session';
import type { ServerView } from '@beacon/session-record/client';
import { CLOCK } from '../clock';
import { euroLabel, hourLabel, stoppedAt } from '../format';

/** What the warning line says after `Preflight check`, by the cause of the abandon. */
const PREFLIGHT_STOPPED: Record<PreflightFailure, string> = {
  'copy-behind': 'the game’s copy is out of date',
  'version-unreadable': 'the game’s current version couldn’t be read',
};

/** What to do next, by the cause of the abandon: pressing again cannot replace a copy. */
const PREFLIGHT_ADVICE: Record<PreflightFailure, string> = {
  'copy-behind':
    'The game had an update that the copy here doesn’t have yet. Tell whoever runs this: pressing again won’t help until they replace it.',
  'version-unreadable':
    'We couldn’t find out which version of the game is current, and nothing starts without knowing. Press again in a few minutes; if it stops here twice, tell whoever runs this.',
};

/**
 * The screen most often seen, and the one a start that failed comes back to.
 * A creation the provider refuses, or a setup that is abandoned, is cleaned up
 * and returns to `IDLE`, the button clickable at once. That is not a sixth
 * state — it is this screen with a warning, and one word different on the
 * button.
 *
 * Where the setup stopped is a step and an hour, and nothing a game server
 * wrote. What the host said is quoted only when the host said something.
 * After an abandon at the preflight check, the warning line says why when the
 * mark says it, and the text above says what to do about it.
 */
@Component({
  selector: 'beacon-out-of-service',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mid">
      <div class="empty">
        <div>
          @if (stopped()) {
            <div class="big sm">It didn’t start.</div>
            <div class="sub">
              Nothing was left running, and nothing is costing anything. {{ advice() }}
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
            @if (stopped.stage === 'step') {
              <b>Step {{ stopped.rank }} of {{ stopped.total }}</b> · {{ stopped.name }}
            } @else {
              <b>Preflight check</b> · <span class="before">{{ preflightStopped() }}</span>
            }
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

  /** What follows `Nothing was left running, and nothing is costing anything.` after an abandon. */
  readonly advice = computed(() => {
    const stopped = this.stopped();
    if (stopped === null) return '';
    if (stopped.stage === 'preflight' && stopped.failure !== null) return PREFLIGHT_ADVICE[stopped.failure];
    return `Press again; if it stops at the same ${stopped.stage === 'step' ? 'step' : 'place'} twice, tell whoever runs this.`;
  });

  /** Where a setup abandoned at its preflight check stopped, or why when the mark says it. */
  readonly preflightStopped = computed(() => {
    const stopped = this.stopped();
    return stopped?.stage === 'preflight' && stopped.failure !== null
      ? PREFLIGHT_STOPPED[stopped.failure]
      : 'before the first step';
  });

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
