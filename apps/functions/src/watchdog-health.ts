import { Timestamp, type Firestore } from 'firebase-admin/firestore';

export interface PreviousPass {
  /** The volumes the previous pass left stranded. Empty before the first one. */
  readonly stranded: string[];
  /** When a pass last asked the provider anything. Null before the first one. */
  readonly sweptAt: Date | null;
}

export interface WatchdogHealth {
  previousPass(): Promise<PreviousPass>;
  /** `sweptAt` null leaves the recorded one: this pass did not look. */
  beat(at: Date, stranded: readonly string[], sweptAt: Date | null): Promise<void>;
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
 *
 * `lastSweptAt` is what the quiet-sweep decision of §6 is measured on. It only
 * moves on a pass that actually asked the provider something — never on a
 * quiet pass, or the next quiet pass would reset the clock and nothing would
 * ever sweep again.
 */
export function watchdogHealth(db: Firestore): WatchdogHealth {
  const doc = db.doc('health/watchdog');
  return {
    async previousPass(): Promise<PreviousPass> {
      const health = await doc.get();
      return {
        stranded: (health.get('stranded') as string[] | undefined) ?? [],
        sweptAt: (health.get('lastSweptAt') as Timestamp | undefined)?.toDate() ?? null,
      };
    },

    async beat(at, stranded, sweptAt): Promise<void> {
      // Written whole, never merged into the previous one: the field says what
      // is stranded now, and a volume a human finally deleted has to leave it.
      await doc.set(
        {
          lastRunAt: Timestamp.fromDate(at),
          stranded: [...stranded],
          ...(sweptAt !== null ? { lastSweptAt: Timestamp.fromDate(sweptAt) } : {}),
        },
        { merge: true },
      );
    },
  };
}
