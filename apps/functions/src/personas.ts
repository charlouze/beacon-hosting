import { getAuth, type UserImportRecord } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { defaultApp } from './firebase-app.js';
import { emulatorsOnly } from './emulator-guard.js';

export interface Persona {
  readonly uid: string;
  readonly email: string;
  readonly name: string;
  /** Null when this persona has no `members` document — that is the visitor. */
  readonly role: 'admin' | 'player' | null;
  readonly steamId: string | null;
  /** What signing in as this one is for. Printed, so the list is its own help. */
  readonly shows: string;
}

/**
 * The four people the emulator cannot invent on its own.
 *
 * `seed()` deliberately creates no member: the first uid does not exist until
 * someone has signed in against the project, so in production the first admin
 * is a console gesture. Against the emulator that constraint is a chore rather
 * than a safeguard — nothing is billed, and the uid is whatever we say it is.
 * So we say it, once, here.
 *
 * They carry a `google.com` provider and not a password, because that is the
 * only sign-in the app offers. The Auth emulator matches its sign-in popup on
 * the email of an existing provider link, so signing in as `admin@dev.beacon`
 * lands on `dev-admin` rather than minting a fresh uid — which is the whole
 * point of fixing them.
 */
export const PERSONAS: readonly Persona[] = [
  {
    uid: 'dev-admin',
    email: 'admin@dev.beacon',
    name: 'Ada (admin)',
    role: 'admin',
    steamId: '76561197960287930',
    shows: 'the board with the controls an admin alone has',
  },
  {
    uid: 'dev-player',
    email: 'player@dev.beacon',
    name: 'Paul (player)',
    role: 'player',
    steamId: '76561197960287931',
    shows: 'the ordinary evening: open, extend, close',
  },
  {
    uid: 'dev-rookie',
    email: 'rookie@dev.beacon',
    name: 'Remi (rookie)',
    role: 'player',
    steamId: null,
    shows: 'the steam declaration banner, asked once',
  },
  {
    uid: 'dev-visitor',
    email: 'visitor@dev.beacon',
    name: 'Vera (visitor)',
    role: null,
    shows: 'the door that stays shut for who is not a member',
    steamId: null,
  },
];

function importRecordOf(persona: Persona): UserImportRecord {
  return {
    uid: persona.uid,
    email: persona.email,
    emailVerified: true,
    displayName: persona.name,
    providerData: [
      {
        uid: persona.email,
        email: persona.email,
        displayName: persona.name,
        providerId: 'google.com',
      },
    ],
  };
}

/**
 * Lays the four personas down in the Auth emulator and in `members`.
 *
 * Idempotent by overwrite rather than by abstention, which is the opposite of
 * `seed()` and for a reason: this exists to put the emulator in a known state,
 * so a `steamId` declared during yesterday's run must go back to null. The
 * visitor's document is deleted rather than left alone for the same reason —
 * promote them once to see an enrolment and the visitor screen is gone until
 * someone remembers why.
 */
export async function personas(): Promise<void> {
  emulatorsOnly('personas');

  const app = defaultApp();
  await getAuth(app).importUsers(PERSONAS.map(importRecordOf));

  const db = getFirestore(app);
  for (const persona of PERSONAS) {
    const doc = db.doc(`members/${persona.uid}`);
    if (persona.role === null) {
      await doc.delete();
    } else {
      await doc.set({ email: persona.email, role: persona.role, steamId: persona.steamId });
    }
    console.log(`${persona.email.padEnd(20)} ${persona.role ?? 'not a member'} — ${persona.shows}`);
  }
}
