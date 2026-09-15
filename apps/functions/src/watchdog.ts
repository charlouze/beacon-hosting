import {
  mustSweep,
  reclamations,
  reconcileWorld,
  sweepEvents,
  type Clock,
  type DomainEvent,
  type ReclaimOutcome,
  type ServerHost,
  type SessionId,
  type UnclaimedSweep,
  type WatchdogLimits,
  type WatchdogView,
  type WorldId,
  type WorldView,
} from '@beacon/session';
import type { SettingsStore, SystemEvents, WorldStateStores } from '@beacon/session-record';
import type { ProvisioningLedger } from './provisioning-ledger.js';
import type { WatchdogHealth } from './watchdog-health.js';

export interface WatchdogDeps {
  readonly clock: Clock;
  readonly host: ServerHost;
  readonly states: WorldStateStores;
  readonly events: SystemEvents;
  readonly ledger: ProvisioningLedger;
  readonly health: WatchdogHealth;
  readonly settings: SettingsStore;
  readonly limits: WatchdogLimits;
}

/** A world with no destruction attributable to it — never a real world (§6, task 12). */
const UNCLAIMED_WORLD: WorldId = 'unclaimed';

/**
 * Read every world, let the domain decide for each, do it, write down what
 * happened. There is no decision in here on purpose: everything that could be
 * wrong about *what* to destroy is tested without a network in libs/session.
 */
export async function runWatchdog(deps: WatchdogDeps): Promise<void> {
  const now = deps.clock.now();

  // Firestore only, and first. These reads decide whether this pass has any
  // reason to reach for the provider at all.
  const [worldIds, previous, settings] = await Promise.all([
    deps.states.all(),
    deps.health.previousPass(),
    deps.settings.read(),
  ]);
  const worlds = await Promise.all(worldIds.map((worldId) => readWorld(deps.states, worldId)));

  // The job still fires every five minutes, and that is the point: the
  // Monitoring alert of §6 is the only signal of a dead watchdog, it only
  // detects a job that stops, and a pass that does less stays invisible to it
  // where a paused job would be indistinguishable from a dead one.
  //
  // No world at all reads as `[null]`, never as `[]`: `mustSweep([], ...)`
  // finds nothing that needs attention vacuously and would fall back to the
  // quiet interval — exactly the throttle this pass has no record to justify,
  // since it never had one to call clean in the first place.
  const servers = worlds.length === 0 ? [null] : worlds.map((world) => world.server);
  if (!mustSweep(servers, previous.sweptAt, now, deps.limits)) {
    await deps.health.beat(now, previous.stranded, null);
    return;
  }

  const hosted = await deps.host.list();
  // The intents last, and never beside the inventory. §6 writes the intent
  // before it calls the provider, so anything the provider holds was preceded
  // by an intent — but only if the intents are read afterwards. Read in
  // parallel, a machine born between the two reads appears in the inventory
  // while its intent is still absent from the query, and the watchdog destroys
  // a session on its first minute of life.
  const openSessions = await deps.ledger.openSessions();
  const view: WatchdogView = {
    now,
    worlds,
    hosted,
    openSessions,
    alreadyAnnounced: previous.stranded,
    settings,
  };

  const decision = reclamations(view, deps.limits);

  const outcomes: ReclaimOutcome[] = [];
  for (const reclamation of decision.destroy) {
    try {
      await deps.host.close(reclamation.sessionId);
      outcomes.push({ reclamation, closed: true });
    } catch (error) {
      // Caught per reclamation, and this is the whole point of the loop. A
      // throw that escaped would abort the pass after a successful
      // destruction and let the next resource live — measured, on the probe's
      // own reaper, on 2026-09-03.
      outcomes.push({ reclamation, closed: false, error: String(error) });
    }
  }

  // The adapter already survives a refusal on any single resource. This catch
  // is for the other kind: the provider unreachable, the whole listing
  // refused. It stays here rather than in a helper because whether the sweep
  // actually looked is a fact only this frame holds, and the beat needs it.
  let swept = true;
  let sweep: UnclaimedSweep;
  try {
    sweep = await deps.host.sweepUnclaimed();
  } catch (error) {
    swept = false;
    sweep = { destroyed: [], stranded: [], errors: [String(error)] };
  }

  // Each world's own session, and nothing that belongs to another one: the
  // reconcile.ts contract this task closes. A session that names no current
  // world's own record — the machine no record explains any more — is the
  // "unexplained" of `reclamations()`, and it belongs to the pass, not to any
  // world's per-world correction (see reconcile.ts's doc on `reconcileWorld`).
  const claimedBy = new Map<SessionId, WorldId>();
  for (const world of worlds) {
    if (world.server?.sessionId != null) claimedBy.set(world.server.sessionId, world.worldId);
  }

  const closeIntents = new Set<SessionId>();
  const systemEvents: DomainEvent[] = [];

  for (const world of view.worlds) {
    const own = outcomes.filter((outcome) => claimedBy.get(outcome.reclamation.sessionId) === world.worldId);
    const expired = decision.expired.filter((e) => e.worldId === world.worldId);
    // decision.expired folds into this same correction (review finding 2):
    // a session marked expired can, in this very pass, also be one the
    // grounding above already sent to IDLE, and reconcileWorld is the one
    // function that gets to decide between the two.
    const correction = reconcileWorld(view, world, own, expired);
    await deps.states.for(world.worldId).apply(correction, now);
    for (const sessionId of correction.closeIntents) closeIntents.add(sessionId);
  }

  const unclaimed = outcomes.filter(
    (outcome) => !claimedBy.has(outcome.reclamation.sessionId),
  );
  if (unclaimed.length > 0) {
    const noWorld: WorldView = { worldId: UNCLAIMED_WORLD, server: null, session: null };
    const correction = reconcileWorld(view, noWorld, unclaimed, []);
    systemEvents.push(...correction.events);
    for (const sessionId of correction.closeIntents) closeIntents.add(sessionId);
  }

  systemEvents.push(...sweepEvents(sweep, view.alreadyAnnounced));
  if (systemEvents.length > 0) await deps.events.file(systemEvents, now);

  for (const sessionId of closeIntents) {
    await deps.ledger.close(sessionId, now);
  }

  // Last, so that a beat means a whole pass went through — and it carries what
  // is stranded now, which is what the next pass must not announce again. A
  // refused sweep keeps what the last sweep that *looked* saw: recording an
  // empty set would claim nothing is stranded, and re-announce it all in five
  // minutes. `now` as the sweep instant either way: this pass did reach for
  // the provider, whatever the provider answered.
  await deps.health.beat(now, swept ? sweep.stranded : previous.stranded, now);
}

async function readWorld(states: WorldStateStores, worldId: WorldId): Promise<WorldView> {
  const store = states.for(worldId);
  const [server, session] = await Promise.all([store.read(), store.readSession()]);
  return { worldId, server, session };
}
