import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { SessionSettings } from '@beacon/session';
import type { WorldSummary } from '@beacon/session-record/client';
import { CLOCK } from '../clock';
import { countdownsTo } from '../countdown';
import { gameLabel, hourLabel, readyWindow, stateLabel, type Announced } from '../format';
import { byUrgency, overview } from './overview';

/** One band of the index: a world's name, what it is doing, and what its state gives to read. */
interface Band {
  readonly worldId: string;
  readonly name: string;
  readonly game: string;
  readonly players: string;
  readonly state: Announced;
  readonly deadline: Date | null;
  readonly closesAt: string | null;
  readonly window: { from: string; to: string } | null;
  readonly nextSession: string | null;
}

/**
 * The index of names: the first screen of Beacon, and the only one that speaks
 * of more than one world. The name leads at the display scale, the measure
 * follows, and the band itself is the link to the board — there is no primary
 * action here.
 *
 * A pure page: no `*-record`, no router beyond `routerLink`. It is handed the
 * worlds and the settings, and signing out leaves as an event, which is what
 * lets the whole screen be read without an emulator.
 */
@Component({
  selector: 'beacon-worlds-page',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './worlds.page.html',
  styleUrl: './worlds.page.css',
})
export class WorldsPage {
  readonly worlds = input.required<readonly WorldSummary[]>();
  readonly settings = input.required<SessionSettings>();

  readonly signedOut = output<void>();

  private readonly clock = inject(CLOCK);

  readonly lot = computed(() => overview(this.worlds()));

  /** Everything a band reads but the falling second, which no clock of its own may set. */
  private readonly bands = computed<readonly Band[]>(() =>
    byUrgency(this.worlds()).map((summary) => this.band(summary)),
  );

  private readonly seconds = countdownsTo(computed(() => this.bands().map((b) => b.deadline)));

  readonly rows = computed(() =>
    this.bands().map((band, index) => ({ ...band, timeLeft: this.seconds()[index] })),
  );

  private band(summary: WorldSummary): Band {
    const { world, server } = summary;
    const state = stateLabel(server?.session.state ?? 'unreadable');
    const common = {
      worldId: world.worldId,
      name: world.name,
      game: gameLabel(world.game),
      // Counted, never named: §5 forbids a player reading another member's
      // document, and a world of one would otherwise read "1 players".
      players: world.players.length === 1 ? '1 player' : `${world.players.length} players`,
      state,
    };

    // A world whose server cannot be read is announced and nothing more: the
    // screen has no session to interpret, and would be inventing the rest.
    if (server === null) {
      return { ...common, deadline: null, closesAt: null, window: null, nextSession: null };
    }

    const session = server.session;
    if (session.state === 'IDLE') {
      return {
        ...common,
        deadline: null,
        closesAt: null,
        window: null,
        nextSession: `${Math.round(this.settings().sessionDurationMs / 3_600_000)} h once opened`,
      };
    }

    // The displayed deadline and never the raw one, as in service: the domain
    // bounds on read, and a countdown built on the raw field walks backwards
    // the moment a forged deadline is written (§4).
    const deadline = session.displayedDeadline(this.clock, this.settings()).at;
    return {
      ...common,
      // Only a session in service has time left to count; the others have an
      // hour to announce.
      deadline: session.state === 'RUNNING' ? deadline : null,
      closesAt: hourLabel(deadline),
      window:
        session.state === 'PROVISIONING' && server.stateSince !== null
          ? readyWindow(server.stateSince)
          : null,
      nextSession: null,
    };
  }
}
