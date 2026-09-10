import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
} from 'firebase/auth';
import type { IdentitySource } from './client-membership.js';

/**
 * The humble object: every line of it is an sdk call, so there is nothing here
 * a test could tell us that the sdk's own does not. Everything worth testing
 * lives on the other side of `IdentitySource`.
 */
export function firebaseIdentity(auth: Auth): IdentitySource {
  return {
    watch(on) {
      return onAuthStateChanged(auth, (user) =>
        on(
          user === null
            ? null
            : {
                uid: user.uid,
                // §5: an `Actor` without a name makes the journal unreadable,
                // and a Google account may carry neither display name nor
                // email. The uid is a poor name and still better than none.
                name: user.displayName ?? user.email ?? user.uid,
              },
        ),
      );
    },

    async signIn() {
      await signInWithPopup(auth, new GoogleAuthProvider());
    },

    signOut() {
      return signOut(auth);
    },
  };
}
