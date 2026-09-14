import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { SunkenlandJoinInfo } from '@beacon/session';
import { CopyButtonComponent } from './copy-button.component';

/**
 * The shape of a game with no address at all. It is joined by an identifier
 * regenerated at every boot — a world's guid followed by a boot instant — and
 * the world's name is how a player finds the server in the list when the
 * identifier is lost. Main way and fallback again, the same need under a
 * different shape.
 *
 * Two shapes and not one table of label-and-value: §4 takes adding a game
 * adding a shape as an honest, visible cost, where a table would only have
 * moved the problem into the screen.
 */
@Component({
  selector: 'beacon-sunkenland-join',
  standalone: true,
  imports: [CopyButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="join-cols">
      <div>
        <div class="head">
          <span class="k">Server identifier</span>
          <beacon-copy-button [value]="joinInfo().serverId" />
        </div>
        <!-- prettier-ignore -->
        <div class="v" data-field="server-id">@if (parts().tail !== null) {<span
            data-seg>{{ parts().head }}</span><wbr /><span data-seg class="tail">{{ parts().tail }}</span>} @else {<span
            data-seg>{{ parts().head }}</span>}</div>
      </div>
      <div>
        <span class="k">Region</span>
        <div class="v plain" data-field="region">{{ joinInfo().region }}</div>
      </div>
      <div>
        <span class="k">Or in the list</span>
        <div class="v plain" data-field="world-name">{{ joinInfo().worldName }}</div>
      </div>
    </div>
  `,
  styles: `
    /* Each half stays whole, so the only break falls on the tilde — the one
       place it separates two things rather than cutting an identifier in
       half. */
    [data-seg] {
      white-space: nowrap;
    }

    .tail {
      color: var(--mute);
    }
  `,
})
export class SunkenlandJoinComponent {
  readonly joinInfo = input.required<SunkenlandJoinInfo>();

  /** The guid, tilde included, and the boot instant it is joined to. */
  readonly parts = computed<{ head: string; tail: string | null }>(() => {
    const serverId = this.joinInfo().serverId;
    const at = serverId.indexOf('~');
    return at === -1
      ? { head: serverId, tail: null }
      : { head: serverId.slice(0, at + 1), tail: serverId.slice(at + 1) };
  });
}
