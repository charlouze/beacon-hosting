import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { SessionSettings } from '@beacon/session';
import type { ServerView } from '@beacon/session-record/client';
import { CLOCK } from '../clock';
import { euroLabel, hourLabel } from '../format';

/**
 * A machine was left standing, and it is still being billed. §8: cleanup that
 * cannot be guaranteed leaves `FAILED`, which the watchdog retries every five
 * minutes until `IDLE` — no state of this system is a dead end.
 *
 * So no button, anywhere on this screen. There is no useful gesture, and
 * offering one would be lying about who repairs this. Saying who does, and
 * that it does not give up, is the whole design of the screen.
 *
 * The one red figure of the product is here, because it is the only one still
 * climbing. Constraint no. 4 holds nothing back on this page: nothing is being
 * compared, it is a fact and not an argument.
 */
@Component({
  selector: 'beacon-not-cleared',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mid">
      <div class="empty">
        <div>
          <div class="big sm">A machine was left behind.</div>
          <div class="sub">
            Last night’s server could not be taken down, so it is still being charged. Beacon
            retries every five minutes on its own, and it does not give up.
          </div>
        </div>
        <div class="plate">
          @if (since(); as since) {
            <div class="line">
              <span class="k">Left behind since</span>
              <span class="v">{{ since }}</span>
            </div>
          }
          <div class="line">
            <span class="k">Next retry</span>
            <span class="v">within 5 min</span>
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
      <div class="money">
        <div>
          <span class="k">Still being charged</span>
          <div class="v tabular" data-field="cost" data-climbing="true">{{ cost() }}</div>
        </div>
      </div>
      <div class="btncol">
        <div class="hint">Nothing for you to do. Nobody can open a session until it clears.</div>
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
export class NotClearedComponent {
  readonly view = input.required<ServerView>();
  readonly settings = input.required<SessionSettings>();

  private readonly clock = inject(CLOCK);

  readonly refusal = computed(() => this.view().facts.lastError);

  readonly since = computed(() => {
    const at = this.view().stateSince;
    return at === null ? null : hourLabel(at);
  });

  readonly said = computed(() => {
    const at = this.since();
    return at === null ? '' : `, at ${at}`;
  });

  readonly cost = computed(() =>
    euroLabel(this.view().session.estimatedCost(this.clock, this.settings())),
  );
}
