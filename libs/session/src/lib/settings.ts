/**
 * The provider's word for a machine size stops at the adapter (§4): `flavor`
 * at OpenStack, *commercial type* at Scaleway. The domain only ever carries
 * the string, and never reads it.
 */
export type InstanceSize = string;

/**
 * What `config/settings` holds, as the domain needs it. It is read, never
 * decided here: an admin edits the document, and every process — browser,
 * function, watchdog — computes from the same values.
 */
export interface SessionSettings {
  /** How far ahead an opening session may close. Also the clamp bound (§6). */
  readonly sessionDurationMs: number;
  /** One click of the button. */
  readonly extensionStepMs: number;
  /** How long before closing the button becomes clickable. */
  readonly extensionWindowMs: number;
  readonly defaultInstanceSize: InstanceSize;
  /**
   * Per size, and all-inclusive: instance, local disk and ip. The three are
   * billed together by the started hour (§11), so one rate per size is the
   * honest unit — splitting them would invite adding them up wrong.
   */
  readonly tariffPerHour: Readonly<Record<InstanceSize, number>>;
}

/**
 * What §2 and §11 say, and what the seed writes. It is a fallback and not the
 * truth: the document wins, because a provider changes its prices and a rate
 * compiled into a bundle would silently lie about the only figure this product
 * shows on money (§5).
 */
export const DEFAULT_SETTINGS: SessionSettings = {
  sessionDurationMs: 4 * 60 * 60_000,
  extensionStepMs: 60 * 60_000,
  extensionWindowMs: 30 * 60_000,
  defaultInstanceSize: 'DEV1-L',
  tariffPerHour: { 'DEV1-L': 0.05454 },
};
