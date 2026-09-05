import { DEFAULT_LIMITS } from '@beacon/session';
import { serverStateStore } from '@beacon/session-record';
import { fromSdk, ScalewayServerHost } from '@beacon/scaleway-compute';
import { createClient, type Zone } from '@scaleway/sdk-client';
import { Instancev1 } from '@scaleway/sdk';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { provisioningLedger } from './provisioning-ledger.js';
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

export function buildDeps(): WatchdogDeps {
  if (getApps().length === 0) initializeApp();
  const db = getFirestore();
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
    clock: { now: () => new Date() },
    host: new ScalewayServerHost(fromSdk(new Instancev1.API(client), zone as Zone)),
    state: serverStateStore(db),
    ledger: provisioningLedger(db),
    health: watchdogHealth(db),
    limits: DEFAULT_LIMITS,
  };
}
