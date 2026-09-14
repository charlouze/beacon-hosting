import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

/**
 * Asks for the member's Steam account once, then shows it.
 *
 * It exists although no comp shows it: §2 gives every member the administrator
 * role *inside the game*, through `-adminSteamIDs`, and that is the only way a
 * human can trigger a save on the game where §8 measured that nothing else
 * can. The driver carried a bare field; dropping it without a replacement
 * would take that away from every member arriving after this tranche.
 *
 * A band and not a modal, decided 2026-09-12. It interrupts nothing, cannot be
 * dismissed by accident, and the state stays readable above it — what a modal
 * would cover is exactly what this screen exists to do.
 *
 * In ink and not in red: the one red is the falling seconds and warnings, and
 * a field to fill is neither.
 *
 * It validates nothing. `admin-membership.ts` carries that rule already,
 * beside the place where a declared value becomes an administrator, and a
 * second check here would be a second truth — the weaker of the two winning
 * the day they diverge.
 */
@Component({
  selector: 'beacon-steam-declaration',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (asking()) {
      <div class="band" data-field="steam-band">
        <div class="says">
          <span class="k">Steam account</span>
          <p>
            Every member is an administrator inside the game, which is how you save the world from
            inside the game. Beacon needs your Steam id to hand you that.
          </p>
        </div>
        <div class="entry">
          <input
            type="text"
            inputmode="numeric"
            aria-label="Steam account id"
            [value]="draft()"
            (input)="draft.set($any($event.target).value)"
          />
          <button type="button" data-action="declare" (click)="declare()">Declare</button>
        </div>
      </div>
    } @else {
      <div class="quiet-control">
        <span class="k">Steam account</span>
        <span class="value" data-field="steam-id">{{ steamId() }}</span>
        <button type="button" data-action="change" (click)="reopen()">Change</button>
      </div>
    }
  `,
  styleUrl: './steam-declaration.component.css',
})
export class SteamDeclarationComponent {
  readonly steamId = input.required<string | null>();
  readonly declared = output<string>();

  private readonly editing = signal(false);
  readonly draft = signal('');

  readonly asking = computed(() => this.steamId() === null || this.editing());

  reopen(): void {
    this.draft.set(this.steamId() ?? '');
    this.editing.set(true);
  }

  declare(): void {
    const value = this.draft().trim();
    // Nothing leaves on an empty field: a write that cleared the id would take
    // the in-game role away without anyone meaning to.
    if (value === '') return;
    this.editing.set(false);
    this.declared.emit(value);
  }
}
