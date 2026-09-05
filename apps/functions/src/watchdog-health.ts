import { Timestamp, type Firestore } from 'firebase-admin/firestore';

export interface WatchdogHealth {
  /** The volumes the previous pass left stranded. Empty before the first one. */
  strandedLastPass(): Promise<string[]>;
  /** A pass went through: date it, and record what it found stranded. */
  beat(at: Date, stranded: readonly string[]): Promise<void>;
}

/**
 * `health/watchdog`, the watchdog's own bookkeeping (§4). One document, one
 * writer, and two things that are not of the same nature.
 *
 * `lastRunAt` is a diagnostic trace, not a guard. Nothing reads it
 * automatically: what signals the watchdog's silence is the Cloud Monitoring
 * alert on the scheduler job (§6). It answers "since when?" once that alert
 * has arrived.
 *
 * `stranded` is read, and by the watchdog itself. It is what one pass has to
 * remember for the next: a stranded volume is never destroyed, so it comes
 * back in every sweep, and announcing it is a fact that happens once (§5).
 * The document is also the standing answer to "what is stranded right now",
 * which no event can give.
 */
export function watchdogHealth(db: Firestore): WatchdogHealth {
  const doc = db.doc('health/watchdog');
  return {
    async strandedLastPass(): Promise<string[]> {
      const health = await doc.get();
      return (health.get('stranded') as string[] | undefined) ?? [];
    },

    async beat(at: Date, stranded: readonly string[]): Promise<void> {
      // Written whole, never merged into the previous one: the field says what
      // is stranded now, and a volume a human finally deleted has to leave it.
      await doc.set(
        { lastRunAt: Timestamp.fromDate(at), stranded: [...stranded] },
        { merge: true },
      );
    },
  };
}
