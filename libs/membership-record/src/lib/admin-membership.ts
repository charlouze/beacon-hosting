import type { Firestore } from 'firebase-admin/firestore';
import { MEMBERS } from './viewer.js';

/**
 * §5: a steam id is a public integer, and the one consequence of a wrong one is
 * not getting the in-game admin role. So a value that is not one is skipped
 * exactly like an absent one, rather than refused loudly — one member's typo
 * has no business costing an evening.
 *
 * That is also what keeps this value out of a shell. It reaches the game on a
 * launch line, unquoted, and a member writes it: `$(…)` there would run on a
 * machine the rules never let that member near. The shape is checked here
 * because this is where a declared value becomes an administrator.
 */
const isSteamId = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9]+$/.test(value);

/**
 * The Functions' face of the membership record, and it holds one question:
 * which Steam accounts the members declared. Nothing else — reading a member,
 * writing one, or listing the register are the browser's business (§5), and a
 * face the Functions could do them with is a face that will end up doing them.
 *
 * It says what the list **is**, never what a game makes of it. §4 keeps the two
 * words apart on purpose: the `admin` role of Beacon is a field of `members`,
 * the administrator of a game is what a launch line grants — and §2 grants that
 * one to every member, whatever their role.
 */
export interface AdminMembershipRecord {
  declaredSteamIds(): Promise<readonly string[]>;
}

export function adminMembershipRecord(db: Firestore): AdminMembershipRecord {
  return {
    /**
     * Every member, and no filter on the role: §2 gives the in-game
     * administrator role to all of them, on the same principle as « n'importe
     * qui démarre, prolonge et arrête ». A `where('role', '==', 'admin')` here
     * reads like a precaution and is a narrowing of that decision.
     *
     * What it grants is worth naming, because the reassuring half of it is the
     * one that gets remembered: an in-game administrator triggers a save from
     * the console, and can also kick another player. §2 assumes that second
     * half out loud — it is the only authority one member holds over another
     * anywhere in this system.
     *
     * Sorted here rather than by Firestore: an `orderBy` would need an index
     * and would drop the members with no `steamId` at all, which is the
     * ordinary case. The order itself is not cosmetic — a cloud-init is written
     * at every provisioning, and two identical evenings must produce two
     * identical files.
     *
     * The projection is not an optimisation either: `members` is the one
     * collection §5 narrows to protect e-mail addresses, and `select` is what
     * keeps them out of this process entirely.
     */
    async declaredSteamIds(): Promise<readonly string[]> {
      const snapshot = await db.collection(MEMBERS).select('steamId').get();
      return snapshot.docs
        .map((doc) => doc.get('steamId'))
        .filter(isSteamId)
        .sort();
    },
  };
}
