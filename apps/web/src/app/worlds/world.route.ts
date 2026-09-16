import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import type { WorldSummary } from '@beacon/session-record/client';
import { Records } from '../records';
import { SessionPage } from '../session/session.page';

/**
 * The one place a `worldId` from the address becomes a subscription: one
 * `watchWorld`, reopened whenever the router hands in a different id, and
 * every gesture the board raises turned into the matching call on the
 * record. The board itself computes nothing about the world — it only
 * renders what this route and `watchWorld` hand it.
 */
@Component({
  selector: 'beacon-world-route',
  standalone: true,
  imports: [RouterLink, SessionPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view(); as summary) {
      <beacon-session-page
        [view]="summary.server"
        [world]="summary.world"
        [settings]="records.settings()"
        [member]="records.member()!"
        (opened)="onOpened()"
        (extended)="onExtended()"
        (closed)="onClosed()"
        (declared)="onDeclared($event)"
        (signedOut)="onSignedOut()"
        (renamed)="onRenamed($event)"
        (reinvited)="onReinvited()"
        (left)="onLeft()"
      />
    } @else if (received()) {
      <div class="board" data-field="not-yours">
        <div class="lede">
          <div class="wordmark">Beacon</div>
          <div class="status" data-tone="off">Not yours</div>
        </div>
        <div class="rule"></div>

        <div class="mid">
          <div class="empty solo">
            <div class="big sm">This world is not on your list.</div>
            <div class="sub">Ask a player there for the invite link.</div>
          </div>
        </div>

        <div class="foot">
          <div class="money"></div>
          <div class="btncol">
            <div class="acts">
              <a class="btn ghost" routerLink="/">Your worlds</a>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class WorldRoute {
  protected readonly records = inject(Records);
  private readonly router = inject(Router);

  readonly worldId = input.required<string>();

  protected readonly received = signal(false);
  protected readonly view = signal<WorldSummary | null>(null);

  constructor() {
    effect((onCleanup) => {
      const worldId = this.worldId();
      this.received.set(false);
      this.view.set(null);
      const stop = this.records.session().watchWorld(worldId, (summary) => {
        this.received.set(true);
        this.view.set(summary);
      });
      onCleanup(() => stop());
    });
  }

  protected onOpened(): void {
    this.records.run(() =>
      this.records
        .session()
        .open({ worldId: this.worldId(), sessionId: crypto.randomUUID(), actor: this.records.actor() }),
    );
  }

  protected onExtended(): void {
    this.records.run(() => this.records.session().extend(this.worldId(), this.records.actor()));
  }

  protected onClosed(): void {
    this.records.run(() => this.records.session().requestStop(this.worldId(), this.records.actor()));
  }

  protected onRenamed(name: string): void {
    this.records.run(() => this.records.session().rename(this.worldId(), name, this.records.actor()));
  }

  protected onReinvited(): void {
    this.records.run(() => this.records.session().regenerateInvite(this.worldId(), this.records.actor()));
  }

  protected onDeclared(steamId: string): void {
    this.records.declareSteamId(steamId);
  }

  protected onSignedOut(): void {
    this.records.signOut();
  }

  protected async onLeft(): Promise<void> {
    const worldId = this.worldId();
    const left = await this.records.run(() => this.records.session().leave(worldId, this.records.actor()));
    if (left) this.router.navigateByUrl('/');
  }
}
