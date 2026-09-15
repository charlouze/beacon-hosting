import { randomBytes } from 'node:crypto';
import type { World } from '@beacon/session';

/**
 * Twelve url-safe characters an administrator can read aloud and a player can
 * paste into a join screen. `randomBytes(9)` rather than a rounder number: 9
 * is a multiple of 3, so base64url produces exactly 12 characters with no
 * padding to strip.
 */
export function newInviteCode(): string {
  return randomBytes(9).toString('base64url');
}

/**
 * What `adopt` prints for a world that just came into existence. The link is
 * always there — a world with no invite is a world nobody can join. The
 * record line follows only for a game a session is joined by address:
 * `hostname` carries that decision already (§4's `catalogFor(game).hostname`),
 * so nothing here re-derives it from the game's name.
 *
 * DynHost updates a record, it never creates one — the sentence an
 * administrator has to read before the first session, not after it fails.
 */
export function worldBirth(world: World, hostname: string | null): readonly string[] {
  const lines = [`invite link: https://beacon.charlouze.com/join/${world.worldId}/${world.inviteCode}`];
  if (hostname !== null) {
    lines.push(
      `create the A record ${hostname} in the OVH zone, DynHost enabled, before the first session — DynHost updates a record, it never creates one`,
    );
  }
  return lines;
}
