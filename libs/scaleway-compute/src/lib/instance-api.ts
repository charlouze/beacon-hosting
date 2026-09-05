/**
 * The slice of Scaleway's Instance API this adapter uses, declared here so the
 * adapter can be driven without a network, a key, or a cent. `Instancev1.API`
 * is adapted onto it in `from-sdk.ts`, next door.
 *
 * No method takes a zone. Which zone this system talks to is a fact of the
 * deployment, not of a destruction: threading it through seven signatures would
 * put it in the adapter, in every test and in every fake, for a value none of
 * them chooses. The translation closes over it once.
 */

export interface ScwServer {
  readonly id: string;
  readonly name: string;
  readonly state: string;
  readonly tags: string[];
  /**
   * Its disks. They carry no tag of ours — a volume is created by the server,
   * not by us — so this map is the only thing tying one to a session.
   */
  readonly volumes: Record<string, { readonly id: string }>;
}

export interface ScwIp {
  readonly id: string;
  readonly address: string;
  readonly tags: string[];
  /** Absent on some paths, null on others. Never test for one of the two. */
  readonly server?: { readonly id?: string } | null;
}

/**
 * A disk. It carries no tag — there is nothing to filter it by, which is the
 * entire reason §6 says a detached one is reported and never destroyed.
 */
export interface ScwVolume {
  readonly id: string;
  readonly name: string;
  readonly size: number;
  /** Absent or null when the volume is attached to nothing. */
  readonly server?: { readonly id?: string } | null;
}

export interface InstanceApi {
  listServers(request: { tags: string[] }): Promise<{ servers: ScwServer[] }>;
  listIps(request: { tags: string[] }): Promise<{ ips: ScwIp[] }>;
  /** No tag filter, because a volume has no tags. The whole project comes back. */
  listVolumes(): Promise<{ volumes: ScwVolume[] }>;
  serverAction(request: { serverId: string; action: 'terminate' }): Promise<unknown>;
  deleteServer(request: { serverId: string }): Promise<void>;
  deleteVolume(request: { volumeId: string }): Promise<void>;
  deleteIp(request: { ip: string }): Promise<void>;
}
