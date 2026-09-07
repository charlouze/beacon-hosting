import {
  mustSweep,
  reclamations,
  reconcile,
  type Clock,
  type ReclaimOutcome,
  type ServerHost,
  type UnclaimedSweep,
  type WatchdogLimits,
  type WatchdogView,
} from '@beacon/session';
import type { ServerStateStore, SettingsStore } from '@beacon/session-record';
import type { ProvisioningLedger } from './provisioning-ledger.js';
import type { WatchdogHealth } from './watchdog-health.js';

export interface WatchdogDeps {
  readonly clock: Clock;
  readonly host: ServerHost;
  readonly state: ServerStateStore;
  readonly ledger: ProvisioningLedger;
  readonly health: WatchdogHealth;
  readonly settings: SettingsStore;
  readonly limits: WatchdogLimits;
}

/**
 * Read the world, let the domain decide, do it, write down what happened.
 * There is no decision in here on purpose: everything that could be wrong
 * about *what* to destroy is tested without a network in libs/session.
 */
export async function runWatchdog(deps: WatchdogDeps): Promise<void> {
  const now = deps.clock.now();

  // Firestore only, and first. These four reads decide whether this pass has
  // any reason to reach for the provider at all.
  const [server, session, previous, settings] = await Promise.all([
    deps.state.read(),
    deps.state.readSession(),
    deps.health.previousPass(),
    deps.settings.read(),
  ]);

  // The job still fires every five minutes, and that is the point: the
  // Monitoring alert of §6 is the only signal of a dead watchdog, it only
  // detects a job that stops, and a pass that does less stays invisible to it
  // where a paused job would be indistinguishable from a dead one.
  if (!mustSweep(server, previous.sweptAt, now, deps.limits)) {
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
    server,
    session,
    settings,
    hosted,
    openSessions,
    alreadyAnnounced: previous.stranded,
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

  const correction = reconcile(view, outcomes, sweep);
  await deps.state.apply(correction, now);
  for (const sessionId of correction.closeIntents) {
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
