import { withPin } from './catalogue-pin.js';

export interface PinDeps {
  /** The published version, as the `companion-v*` tag names it. */
  readonly version: string;
  readonly read: () => string;
  readonly write: (catalogue: string) => void;
  readonly digest: (version: string) => Promise<string>;
  readonly fingerprint: () => string;
}

/**
 * The gesture that follows a publication, and the reason it is a target rather
 * than a step of `companion.yml`: a push made with the `GITHUB_TOKEN` triggers
 * no workflow, so a commit the runner pushed would leave `verify` — a required
 * check — never run, and the merge blocked on a check that cannot arrive. Run
 * from a workstation, the push is the author's and everything fires normally.
 *
 * It returns what it wrote so a caller can print it; deciding it has nothing
 * to do is the test's business, not this function's.
 */
export async function runPin(deps: PinDeps): Promise<string> {
  const digest = await deps.digest(deps.version);
  const catalogue = withPin(deps.read(), digest, deps.fingerprint());
  deps.write(catalogue);
  return digest;
}
