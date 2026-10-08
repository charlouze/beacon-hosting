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

/** `volumeType` of a volume the Block Storage API owns. Anything else is local. */
export const BLOCK_VOLUME_TYPE = 'sbs_volume';

export interface ScwServer {
  readonly id: string;
  readonly name: string;
  readonly state: string;
  readonly tags: string[];
  /**
   * Its disks, and which api each one answers to. A local one dies by the
   * Instance API; a block one is unknown to it and dies by the Block API.
   */
  readonly volumes: Record<string, { readonly id: string; readonly volumeType: string }>;
}

export interface ScwIp {
  readonly id: string;
  readonly address: string;
  readonly tags: string[];
  /** Absent on some paths, null on others. Never test for one of the two. */
  readonly server?: { readonly id?: string } | null;
}

/**
 * A local disk, as the Instance API lists it. This system never tags one, so
 * nothing says whose a detached one is: it is reported and never destroyed. A
 * block volume is not in this listing — see `ScwBlockVolume`.
 */
export interface ScwVolume {
  readonly id: string;
  readonly name: string;
  readonly size: number;
  /** Absent or null when the volume is attached to nothing. */
  readonly server?: { readonly id?: string } | null;
}

/** What a server is created from. `serverCreation` composes it. */
export interface ServerCreation {
  readonly name: string;
  readonly commercialType: string;
  readonly image: string;
  readonly tags: string[];
  /** Absent when the server gets no flexible ip. */
  readonly publicIps?: string[];
  /**
   * The root volume, under the key the provider boots from, its size in bytes.
   * It takes no tag: the sdk offers none on the volume of a creation.
   */
  readonly volumes: { readonly '0': { readonly size: number; readonly volumeType: string } };
}

export interface InstanceApi {
  listServers(request: { tags: string[] }): Promise<{ servers: ScwServer[] }>;
  listIps(request: { tags: string[] }): Promise<{ ips: ScwIp[] }>;
  /** No tag filter: the whole project comes back, local volumes only. */
  listVolumes(): Promise<{ volumes: ScwVolume[] }>;
  serverAction(request: { serverId: string; action: 'terminate' }): Promise<unknown>;
  deleteServer(request: { serverId: string }): Promise<void>;
  deleteVolume(request: { volumeId: string }): Promise<void>;
  deleteIp(request: { ip: string }): Promise<void>;
  createIp(request: { tags: string[] }): Promise<{ ip?: ScwIp }>;
  createServer(request: ServerCreation): Promise<{ server?: ScwServer }>;
  /** cloud-init travels as user data, in a call of its own. */
  setServerUserData(request: { serverId: string; content: string }): Promise<void>;
  powerOn(request: { serverId: string }): Promise<void>;
}
