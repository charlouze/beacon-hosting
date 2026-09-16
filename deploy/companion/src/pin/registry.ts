/** Every manifest shape ghcr may answer with, so it reports the digest of what a machine would pull. */
const MANIFEST_TYPES = [
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.v2+json',
].join(', ');

type Fetcher = (url: string | URL, init?: RequestInit) => Promise<Response>;

/**
 * The digest a version currently resolves to. Read from the registry rather
 * than copied from a workflow's summary: the one number nobody can retype
 * wrong is the one nobody retypes.
 *
 * Anonymously — the image is public, which is what lets a bare game machine
 * pull it with no credentials at all (§7).
 */
export async function digestOf(
  repository: string,
  version: string,
  fetcher: Fetcher = fetch,
): Promise<string> {
  const token = await fetcher(
    `https://ghcr.io/token?service=ghcr.io&scope=repository:${repository}:pull`,
  );
  const { token: bearer } = (await token.json()) as { token?: string };

  const manifest = await fetcher(`https://ghcr.io/v2/${repository}/manifests/${version}`, {
    method: 'HEAD',
    headers: { Accept: MANIFEST_TYPES, Authorization: `Bearer ${bearer ?? ''}` },
  });

  const digest = manifest.headers.get('docker-content-digest');
  if (!manifest.ok || digest === null) {
    throw new Error(`the registry names no digest for ${repository}:${version}`);
  }
  return digest;
}
