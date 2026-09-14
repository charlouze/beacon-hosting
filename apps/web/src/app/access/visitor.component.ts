import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * A Google account that is not a member exists, and `PRODUCT.md` requires it
 * be treated. §5 is what shapes this screen: no read is open to an
 * authenticated non-member, because without that rule any account would read
 * the e-mail addresses in `members`, the ip of a machine exposed on the
 * internet, and the costs.
 *
 * So there is nothing to show — and that is the correct answer, not an empty
 * state. It says the one true thing, and the one thing that can be done about
 * it, which is to ask a person.
 */
@Component({
  selector: 'beacon-visitor',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="board">
      <div class="lede">
        <div class="wordmark" data-field="wordmark">Beacon</div>
        <div class="status" data-tone="off">Not a member</div>
      </div>
      <div class="rule"></div>

      <div class="mid">
        <div class="empty">
          <div>
            <div class="big sm">You’re signed in, but not on the list.</div>
            <div class="sub">
              Beacon serves one closed group. Ask whoever runs it to add you, and this page will
              look very different.
            </div>
          </div>
          <div class="plate">
            <div class="line">
              <span class="k">Signed in as</span><span class="v" data-field="name">{{ name() }}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="foot">
        <div class="money"></div>
        <div class="btncol">
          <div class="acts">
            <button type="button" class="btn ghost" data-action="sign-out" (click)="signOut.emit()">
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class VisitorComponent {
  readonly name = input.required<string>();
  readonly signOut = output<void>();
}
