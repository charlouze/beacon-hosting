import { ChangeDetectionStrategy, Component, input, signal } from '@angular/core';

/**
 * Copying is the whole point of a string nobody reads. The value it delivers
 * is on the element, in `data-copy`, because what gets pasted into the game is
 * not always what is printed beside it — the address is shown without its
 * port, and pasted with it.
 *
 * The label turns to `Copied` and comes back. That is a state changing, not an
 * animation: the page's one moving thing is the falling second.
 */
@Component({
  selector: 'beacon-copy-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button type="button" [attr.data-copy]="value()" [attr.data-done]="done() ? '' : null" (click)="copy()">
      {{ done() ? 'Copied' : 'Copy' }}
    </button>
  `,
  styles: `
    button {
      font: 600 10px/1 var(--font-ui);
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--mute);
      border: 1px solid var(--rule);
      padding: 6px 8px;
      background: transparent;
      cursor: pointer;
      transition:
        color 0.12s ease-out,
        border-color 0.12s ease-out;
    }

    button:hover {
      color: var(--ink);
      border-color: var(--ink);
    }

    button[data-done] {
      color: var(--red);
      border-color: var(--red);
    }
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
