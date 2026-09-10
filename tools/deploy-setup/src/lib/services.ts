interface ListedService {
  readonly config?: { readonly name?: string };
  readonly state?: string;
}

/**
 * The wanted apis this project has not enabled, read out of
 * `gcloud services list --enabled --format=json`.
 */
export function servicesMissingFrom(
  listedJson: string,
  wanted: readonly string[],
): string[] {
  const listed: readonly ListedService[] = JSON.parse(listedJson);
  const enabled = new Set(
    listed
      .filter((service) => service.state === 'ENABLED')
      .map((service) => service.config?.name)
      .filter((name): name is string => name !== undefined),
  );
  return wanted.filter((service) => !enabled.has(service));
}
