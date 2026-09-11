import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import type { SessionSettings } from '@beacon/session';
import type { ServerView } from '@beacon/session-record/client';
import { CLOCK } from '../clock';
import { euroLabel } from '../format';

/**
 * The machine is going, and this screen carries the one promise the product
 * may never make. `PRODUCT.md`: the server saves on its own cadence, nothing
 * can force one, and depending on the game the last minutes of an evening may
 * be missing — so the interface must never claim everything is saved right
 * now.
 *
 * It is the only place in the product where that sentence has to be seen, and
 * it is said without alarming: a cadence is not an incident.
 *
 * Nothing to press. There is no gesture that would help, and offering one
 * would be a lie about who is in charge of the next minute.
 */
@Component({
  selector: 'beacon-closing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mid">
      <div class="empty solo">
        <div class="big sm">Closing down.</div>
        <div class="sub">
          The machine is being destroyed — there is no paused server to come back to, and that is
          on purpose.
        </div>
      </div>

      <div class="rule-thin"></div>

      <div class="release">
        <div class="big">The world saves on its own schedule.</div>
        <div class="sub">
          Every few minutes, and nothing here can force one. The last minutes of an evening may not
          be in it — the same as if the machine had crashed.
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
        <div class="hint">Nothing left to do here.</div>
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
export class ClosingComponent {
  readonly view = input.required<ServerView>();
  readonly settings = input.required<SessionSettings>();

  private readonly clock = inject(CLOCK);

  readonly cost = computed(() =>
    euroLabel(this.view().session.estimatedCost(this.clock, this.settings())),
  );
}
