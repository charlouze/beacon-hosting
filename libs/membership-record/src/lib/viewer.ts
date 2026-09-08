export const MEMBERS = 'members';

export type Role = 'admin' | 'player';

export interface Identity {
  readonly uid: string;
  readonly name: string;
}

export interface Member {
  readonly uid: string;
  readonly name: string;
  readonly role: Role;
  readonly steamId: string | null;
}

export type Viewer =
  | { kind: 'signed-out' }
  | { kind: 'visitor'; identity: Identity }
  | { kind: 'member'; member: Member };

const ROLES: readonly string[] = ['admin', 'player'];

/**
 * Who is at the keyboard and what they may do, read as one value.
 *
 * A role outside `ROLES` yields a visitor. The rules bound `role` to those two
 * words on write, so such a document can only be born of a console gesture —
 * and then the screen refuses where the rules let through. That is the single
 * divergence possible between the two, and it is better written here than
 * discovered.
 */
export function viewerFrom(identity: Identity | null, data: Record<string, unknown> | null): Viewer {
  if (identity === null) return { kind: 'signed-out' };

  const role = data?.['role'];
  if (typeof role !== 'string' || !ROLES.includes(role)) return { kind: 'visitor', identity };

  const steamId = data?.['steamId'];
  return {
    kind: 'member',
    member: {
      uid: identity.uid,
      name: identity.name,
      role: role as Role,
      steamId: typeof steamId === 'string' ? steamId : null,
    },
  };
}
