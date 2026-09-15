import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { Records } from '../records';
import { WorldsPage } from './worlds.page';
import type { WorldSummary } from '@beacon/session-record/client';

@Component({
  selector: 'beacon-worlds-route',
  standalone: true,
  imports: [WorldsPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <beacon-worlds-page
      [worlds]="worlds()"
      [settings]="records.settings()"
      (signedOut)="onSignedOut()"
    />
  `,
})
export class WorldsRoute {
  readonly records = inject(Records);

  readonly worlds = signal<readonly WorldSummary[]>([]);

  constructor() {
    effect((onCleanup) => {
      const member = this.records.member();
      if (!member) return;

      const stop = this.records.session().watchMyWorlds(member.uid, (worlds) => {
        this.worlds.set(worlds);
      });

      onCleanup(() => stop());
    });
  }

  onSignedOut(): void {
    this.records.signOut();
  }
}
