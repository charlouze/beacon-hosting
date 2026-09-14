import { ChangeDetectionStrategy, Component, output } from '@angular/core';

/**
 * One door, and only one. No session state is shown, because §5 opens no read
 * to anyone who is not a member — and showing one would mean inventing it.
 * What the page says instead is what the product *is*: the idea fits in a
 * sentence, and that sentence is the positioning.
 *
 * Signing in leaves as an event. The Auth sdk lives in
 * `libs/membership-record`, and a screen that held it would hold the identity
 * every event's actor is built from (§4).
 */
@Component({
  selector: 'beacon-signed-out',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="board">
      <div class="lede">
        <div class="wordmark" data-field="wordmark">Beacon</div>
      </div>
      <div class="rule"></div>

      <div class="mid">
        <div class="empty">
          <div>
            <div class="big">A game server that closes itself.</div>
            <div class="sub">
              It opens for one evening, and the hour it shuts is set before it starts. Anyone in
              the group can open it, extend it, or close it early.
            </div>
          </div>
          <div class="plate">
            <div class="line"><span class="k">Group</span><span class="v">By invitation only</span></div>
            <div class="line"><span class="k">Hosted in</span><span class="v">Paris, France</span></div>
          </div>
        </div>
      </div>

      <div class="foot">
        <div class="money"></div>
        <div class="btncol">
          <div class="acts">
            <button type="button" class="btn xl" data-action="sign-in" (click)="signIn.emit()">
              Sign in with Google
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class SignedOutComponent {
  readonly signIn = output<void>();
}
