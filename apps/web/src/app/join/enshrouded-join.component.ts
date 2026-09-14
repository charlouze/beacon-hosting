import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { EnshroudedJoinInfo } from '@beacon/session';
import { CopyButtonComponent } from './copy-button.component';

/**
 * The shape of a game joined by an address. A main way in and a fallback, both
 * of which `PRODUCT.md` asked for before either existed: §8 has DynHost fail
 * without the evening being lost, and then the raw ip *is* the way in — which
 * is why it is named for what it is rather than left beside the other for the
 * player to guess between.
 *
 * The port is printed once. Inside both values and in its own column it was
 * the same number three times on one line; each Copy still delivers host and
 * port together, which is what gets pasted.
 */
@Component({
  selector: 'beacon-enshrouded-join',
  standalone: true,
  imports: [CopyButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="join-cols">
      <div>
        <div class="head">
          <span class="k">Address</span>
          <beacon-copy-button [value]="joinInfo().hostname + ':' + joinInfo().port" />
        </div>
        <div class="v host" data-field="address">{{ joinInfo().hostname }}</div>
      </div>
      <div>
        <div class="head">
          <span class="k">Raw ip, if that fails</span>
          <beacon-copy-button [value]="joinInfo().address + ':' + joinInfo().port" />
        </div>
        <div class="v" data-field="raw-ip">{{ joinInfo().address }}</div>
      </div>
      <div>
        <span class="k">Port</span>
        <div class="v plain tabular" data-field="port">{{ joinInfo().port }}</div>
      </div>
    </div>
  `,
})
export class EnshroudedJoinComponent {
  readonly joinInfo = input.required<EnshroudedJoinInfo>();
}
