import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * `/join` itself: what a follower of the link sees while `JoinRoute` calls
 * `join()`, and what they see if it refuses. Pure like `WorldsPage` — it
 * names no world and reads no `worldId`, because it never received one: the
 * route is the only thing that talked to the record.
 */
@Component({
  selector: 'beacon-join-page',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './join.page.html',
})
export class JoinPage {
  readonly outcome = input.required<'joining' | 'refused'>();
}
