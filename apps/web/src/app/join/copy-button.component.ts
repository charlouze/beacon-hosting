import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

/**
 * Copying is the whole point of a string nobody reads. The value it delivers
 * is on the element, in `data-copy`, because what gets pasted into the game is
 * not always what is printed beside it — the address is shown without its
 * port, and pasted with it.
 *
 * The label turns to `Copied` and comes back. That is a state changing, not an
 * animation: the page's one moving thing is the falling second.
 *
 * It wears `.small`, the world's own bordered control, rather than a sheet of
 * its own: the band of the world sets Rename and Leave this world beside this
 * button, and two definitions of the same control is how they drift apart.
 */
@Component({
  selector: 'beacon-copy-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      class="small"
      type="button"
      [attr.data-copy]="value()"
      [attr.data-done]="done() ? '' : null"
      (click)="copy()"
    >
      {{ done() ? 'Copied' : 'Copy' }}
    </button>
  `,
})
export class CopyButtonComponent {
  readonly value = input.required<string>();
  readonly done = signal(false);

  copy(): void {
    // Guarded rather than assumed: a page served over plain http has no
    // clipboard, and the label must not claim a copy that never happened.
    navigator.clipboard
      ?.writeText(this.value())
      .then(() => {
        this.done.set(true);
        setTimeout(() => this.done.set(false), 1_400);
      })
      .catch(() => undefined);
  }
}
