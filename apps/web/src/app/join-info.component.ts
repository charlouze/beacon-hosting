import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { Session } from '@beacon/session';

/**
 * One component per shape of join point, and this is the one that carries an
 * address. The other game is joined by a server identifier, a region and a
 * world name, and its component arrives with its catalogue entry in tranche 3
 * — adding a game adds a shape, which §4 accepts as an honest, visible cost.
 *
 * The driver only knows whether a join point exists: what it contains is
 * `server/current`'s reserved field, and the screen that reads it is tranche 5.
 */
@Component({
  selector: 'beacon-join-info',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (session()?.state === 'RUNNING') {
      <p>How to join: published — the screen that shows it is tranche 5.</p>
    }
  `,
})
export class JoinInfoComponent {
  readonly session = input<Session | null>(null);
}
