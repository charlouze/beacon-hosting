import { Timestamp, type Firestore } from 'firebase-admin/firestore';

export interface WatchdogHealth {
  beat(at: Date): Promise<void>;
}

/**
 * `health/watchdog`, the watchdog's own bookkeeping (§4). Today a diagnostic
 * trace and not a guard: nothing reads it automatically, and what signals the
 * watchdog's silence is the Cloud Monitoring alert on the scheduler job (§6).
 * It answers "since when?" once that alert has arrived.
 */
export function watchdogHealth(db: Firestore): WatchdogHealth {
  return {
    async beat(at: Date): Promise<void> {
      await db.doc('health/watchdog').set({ lastRunAt: Timestamp.fromDate(at) }, { merge: true });
    },
  };
}
