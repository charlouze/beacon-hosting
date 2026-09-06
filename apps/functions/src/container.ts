import { DEFAULT_LIMITS } from '@beacon/session';
import { serverStateStore, settingsStore } from '@beacon/session-record';
import { fromSdk, marketplaceImages, ScalewayServerHost } from '@beacon/scaleway-compute';
import { dynHostUpdater } from '@beacon/ovh-dns';
import { createClient, type Zone } from '@scaleway/sdk-client';
import { Instancev1, Marketplacev2 } from '@scaleway/sdk';
import { getFirestore } from 'firebase-admin/firestore';
import { defaultApp } from './firebase-app.js';
import { defineSecret, defineString } from 'firebase-functions/params';
import { agentTokens } from './agent-tokens.js';
import { saveRecords } from './save-records.js';
import type { AgentReportDeps } from './agent-report.js';
import { provisioningLedger } from './provisioning-ledger.js';
import type { ProvisionDeps } from './provisioning.js';
import type { WatchdogDeps } from './watchdog.js';
import { watchdogHealth } from './watchdog-health.js';

// Annotated with the function's own return type, not the SecretParam /
// StringParam class names: firebase-functions/params returns them from
// defineSecret/defineString without exporting either from its public
// entrypoint, so a declaration referencing the class by name is not
// portable (TS2883). Referencing the exported function is.
export const SCW_SECRET_KEY: ReturnType<typeof defineSecret> = defineSecret('SCW_SECRET_KEY');
export const SCW_ACCESS_KEY: ReturnType<typeof defineString> = defineString('SCW_ACCESS_KEY');
export const SCW_PROJECT_ID: ReturnType<typeof defineString> = defineString('SCW_PROJECT_ID');
export const SCW_ZONE: ReturnType<typeof defineString> = defineString('SCW_ZONE');
export const SERVER_PASSWORD: ReturnType<typeof defineSecret> = defineSecret('SERVER_PASSWORD');
export const DYNHOST_USER: ReturnType<typeof defineSecret> = defineSecret('DYNHOST_USER');
export const DYNHOST_PASSWORD: ReturnType<typeof defineSecret> =
  defineSecret('DYNHOST_PASSWORD');

/**
 * The Firestore half of `buildShared` — no Scaleway client, no zone to
 * validate. `buildAgentReportDeps` needs exactly this and nothing more: the
 * endpoint it wires touches no Scaleway config, and building the provider
 * client for it read `SCW_SECRET_KEY` on every report of every session
 * forever (a secret `main.ts` deliberately does not declare for that
 * function), and threw on a malformed zone this endpoint never uses.
 */
function buildFirestoreDeps() {
  const db = getFirestore(defaultApp());
  return {
    clock: { now: () => new Date() },
    state: serverStateStore(db),
    ledger: provisioningLedger(db),
    health: watchdogHealth(db),
    settings: settingsStore(db),
  };
}

/**
 * What `onServerStateChange` and the watchdog both need on top of the
 * Firestore half: one Scaleway client. Built once here so neither Function
 * recopies the other's wiring.
 */
function buildShared() {
  const zone = SCW_ZONE.value();

  // The region is derived from the zone, and an empty or malformed one derives
  // an empty region without complaining: the client would then be built
  // against nothing at all. This is the frontier, and a loud failure at
  // startup beats a misconfiguration that only shows as a silent watchdog.
  if (!zone.includes('-')) {
    throw new Error(`SCW_ZONE must be a Scaleway zone such as fr-par-1, got "${zone}"`);
  }

  const client = createClient({
    accessKey: SCW_ACCESS_KEY.value(),
    secretKey: SCW_SECRET_KEY.value(),
    defaultProjectId: SCW_PROJECT_ID.value(),
    defaultZone: zone,
    defaultRegion: zone.slice(0, zone.lastIndexOf('-')),
  });

  return {
    ...buildFirestoreDeps(),
    host: new ScalewayServerHost(
      fromSdk(new Instancev1.API(client), zone as Zone),
      marketplaceImages(new Marketplacev2.API(client), zone),
    ),
  };
}

export function buildDeps(): WatchdogDeps {
  return { ...buildShared(), limits: DEFAULT_LIMITS };
}

export function buildProvisionDeps(): ProvisionDeps {
  const shared = buildShared();
  return {
    clock: shared.clock,
    host: shared.host,
    dns: dynHostUpdater({
      user: DYNHOST_USER.value(),
      password: DYNHOST_PASSWORD.value(),
    }),
    state: shared.state,
    settings: shared.settings,
    ledger: shared.ledger,
    serverPassword: () => SERVER_PASSWORD.value(),
  };
}

export function buildAgentReportDeps(): AgentReportDeps {
  const shared = buildFirestoreDeps();
  const db = getFirestore(defaultApp());
  return {
    clock: shared.clock,
    tokens: agentTokens(db),
    state: shared.state,
    settings: shared.settings,
    ledger: shared.ledger,
    saves: saveRecords(db),
    dns: dynHostUpdater({
      user: DYNHOST_USER.value(),
      password: DYNHOST_PASSWORD.value(),
    }),
  };
}
