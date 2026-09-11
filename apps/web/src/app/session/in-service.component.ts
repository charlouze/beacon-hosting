import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import {
  isEnshroudedJoinInfo,
  type EnshroudedJoinInfo,
  type JoinInfo,
  type SessionSettings,
  type SunkenlandJoinInfo,
} from '@beacon/session';
import type { ServerView } from '@beacon/session-record/client';
import { CLOCK } from '../clock';
import { countdownTo } from '../countdown';
import { euroLabel, hourLabel } from '../format';
import { EnshroudedJoinComponent } from '../join/enshrouded-join.component';
import { SunkenlandJoinComponent } from '../join/sunkenland-join.component';

/**
 * The screen of the alt-tab at half past eleven. The time left leads, its
 * seconds alone in red and the only thing on the page that moves; the closing
 * hour and the opening hour sit to its right; the join point below; and in the
 * foot, what the evening has cost and the two actions.
 *
 * Nothing is written from here. The actions leave as events, which is what
 * lets this screen be tested without an emulator.
 */
@Component({
  selector: 'beacon-in-service',
  standalone: true,
  imports: [EnshroudedJoinComponent, SunkenlandJoinComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hero">
      <div>
        <span class="k">Time left</span>
        @if (countdown(); as left) {
          <div class="clock tabular" data-field="countdown"><span
              data-field="hours-minutes">{{ left.hoursMinutes }}</span><span class="sec"
              data-field="seconds">{{ left.seconds }}</span></div>
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
      @if (joinInfo(); as joinInfo) {
        <div data-field="join-point">
          <div class="blocklabel"><span class="k">How to join</span></div>
          @if (asEnshrouded(joinInfo); as addressed) {
            <beacon-enshrouded-join [joinInfo]="addressed" />
          } @else if (asSunkenland(joinInfo); as identified) {
            <beacon-sunkenland-join [joinInfo]="identified" />
          }
        </div>
      }
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
        <div class="call" data-field="extension-call">
          <span class="k">Extension call</span>
          <span class="at tabular">{{ callAt() }}</span>
          <span class="said">{{ callSaid() }}</span>
        </div>
        <div class="acts">
          <button
            type="button"
            class="btn xl"
            data-action="extend"
            [disabled]="!canExtend()"
            (click)="extended.emit()"
          >
            + 1 hour
          </button>
          <button
            type="button"
            class="btn ghost"
            data-action="close"
            [disabled]="!canClose()"
            (click)="closed.emit()"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  `,
  styleUrl: './in-service.component.css',
})
export class InServiceComponent {
  readonly view = input.required<ServerView>();
  readonly settings = input.required<SessionSettings>();

  readonly extended = output<void>();
  readonly closed = output<void>();

  private readonly clock = inject(CLOCK);

  /**
   * The displayed deadline and never the raw one. The domain bounds on read,
   * which is what keeps the countdown from walking backwards in the five
   * minutes between a forged deadline being written and the watchdog bringing
   * it back (§4).
   */
  private readonly deadline = computed(() => {
    const session = this.view().session;
    return session.state === 'IDLE'
      ? null
      : session.displayedDeadline(this.clock, this.settings()).at;
  });

  readonly countdown = countdownTo(this.deadline);
  readonly closesAt = computed(() => {
    const at = this.deadline();
    return at === null ? '' : hourLabel(at);
  });
  readonly openedAt = computed(() => {
    const at = this.view().session.startedAt;
    return at === null ? '' : hourLabel(at);
  });

  readonly joinInfo = computed(() => this.view().facts.joinInfo);

  /**
   * The discriminant is `game`, and never the presence of a field: a session
   * already carries its game, and a second field saying the same thing could
   * contradict it (§4).
   */
  asEnshrouded = (info: JoinInfo): EnshroudedJoinInfo | null =>
    isEnshroudedJoinInfo(info) ? info : null;

  asSunkenland = (info: JoinInfo): SunkenlandJoinInfo | null =>
    isEnshroudedJoinInfo(info) ? null : info;

  readonly cost = computed(() =>
    euroLabel(this.view().session.estimatedCost(this.clock, this.settings())),
  );

  readonly canExtend = computed(() =>
    this.view().session.canExtend(this.clock, this.settings()),
  );
  readonly canClose = computed(() => this.view().session.canRequestStop());

  /** The instant the window opens, which is the deadline less the window. */
  readonly callAt = computed(() => {
    if (this.canExtend()) return 'now';
    const at = this.deadline();
    return at === null
      ? ''
      : hourLabel(new Date(at.getTime() - this.settings().extensionWindowMs));
  });

  /**
   * The minutes come from the deployed settings rather than from the comp's
   * "thirty minutes": the window is a setting an admin can move, and a
   * sentence that spelled it out would be the one lying about it.
   */
  readonly callSaid = computed(() =>
    this.canExtend()
      ? 'until it closes'
      : `${Math.round(this.settings().extensionWindowMs / 60_000)} minutes before closing`,
  );
}
