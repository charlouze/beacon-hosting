import type { Firestore } from 'firebase-admin/firestore';
import { SETTINGS_DOC } from './fields.js';

/**
 * What the deployment stamps on `config/settings`, as opposed to what an admin
 * tunes there (§4, §5). A separate port and not a method on `SettingsStore`,
 * because the two answer different questions and have different writers — one
 * is the browser's admin, the other is the Admin SDK at étape 5 of §10.
 *
 * `agentEndpoint` is deliberately absent from `SessionSettings`: that type says
 * what the document holds *as the domain needs it*, and the domain never reads
 * this address. Only the adapter that renders a cloud-init does.
 */
export interface DeploymentRecord {
  agentEndpoint(): Promise<string>;
}

/**
 * The address the last deployment published, or a refusal.
 *
 * Refusing is the point. A seeded-but-unstamped document carries null, and so
 * does one whose deployment failed before étape 5. Read as an empty address, a
 * provisioning would build a machine that reports nowhere — a session stuck in
 * PROVISIONING until the watchdog collects it, on a games night, with nothing
 * saying why. Thrown here, it becomes a FAILED session carrying a reason.
 */
export function agentEndpointFrom(data: Record<string, unknown>): string {
  const endpoint = data['agentEndpoint'];
  if (typeof endpoint !== 'string' || endpoint === '') {
    throw new Error(
      'no deployment has stamped config/settings.agentEndpoint — ' +
        'a machine provisioned now would report nowhere',
    );
  }
  return endpoint;
}

export function deploymentRecord(db: Firestore): DeploymentRecord {
  return {
    async agentEndpoint(): Promise<string> {
      const snapshot = await db.doc(SETTINGS_DOC).get();
      return agentEndpointFrom(snapshot.data() ?? {});
    },
  };
}
