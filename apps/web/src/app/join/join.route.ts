import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Records } from '../records';
import { JoinPage } from './join.page';

/**
 * The one place a `worldId` and an invite code from the address become a
 * call to `join()`. Not `records.run`: the record's refusal is this page's
 * whole content, not a banner over some other view, so it is caught here and
 * turned into `outcome` directly. On success there is nothing left to show —
 * the world route takes over.
 */
@Component({
  selector: 'beacon-join-route',
  standalone: true,
  imports: [JoinPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<beacon-join-page [outcome]="outcome()" />`,
})
export class JoinRoute {
  private readonly records = inject(Records);
  private readonly router = inject(Router);

  readonly worldId = input.required<string>();
  readonly code = input.required<string>();

  protected readonly outcome = signal<'joining' | 'refused'>('joining');

  constructor() {
    effect(() => {
      const worldId = this.worldId();
      const code = this.code();
      this.records.session().join(worldId, code, this.records.actor()).then(
        () => this.router.navigateByUrl(`/worlds/${worldId}`),
        () => this.outcome.set('refused'),
      );
    });
  }
}
