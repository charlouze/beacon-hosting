/**
 * The narrow slice of s3 this adapter needs, and nothing more. The same seam as
 * `InstanceApi` next door, for the same two reasons: the tests get a double
 * that is a Map rather than a mocked sdk, and the day the provider changes,
 * what has to be re-read is one file of four methods.
 *
 * There is no delete here, and there never will be (§8).
 */
export interface ObjectSummary {
  readonly key: string;
  readonly sizeBytes: number;
  readonly lastModified: Date;
}

/** Called as an object arrives: how many bytes so far, out of how many. */
export type TransferProgress = (receivedBytes: number, totalBytes: number) => void;

export interface ObjectApi {
  /** Every object under a prefix. Paged through by the implementation. */
  list(prefix: string): Promise<ObjectSummary[]>;
  /** Write a local file under this key. */
  put(key: string, fromFile: string): Promise<void>;
  /**
   * Write this key's content to a local file. `onProgress` is called as the
   * bytes arrive, and never when the bucket does not say how large the object
   * is.
   */
  get(key: string, toFile: string, onProgress?: TransferProgress): Promise<void>;
}
