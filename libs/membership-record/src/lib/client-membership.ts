import { doc, onSnapshot, updateDoc, type Firestore } from 'firebase/firestore';
import { MEMBERS, viewerFrom, type Identity, type Viewer } from './viewer.js';

/**
 * The port over the sign-in. A Google popup cannot open in a runner, so the
 * only way anything here is testable is for the identity to arrive through an
 * interface a double can implement.
 */
export interface IdentitySource {
  watch(on: (identity: Identity | null) => void): () => void;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}

/**
 * The browser's face of the membership context. It owns the connection on
 * purpose: `apps/web` must not import a Firebase sdk nor name a document field
 * (§4), and that holds only if this module is the one that reads `members`.
 */
export interface ClientMembershipRecord {
  /**
   * `onError` is not optional, and that is the whole point: a refused read
   * ends the underlying listener, so without it the viewer would keep its last
   * value — `signed-out` for someone who has just signed in — and no screen
   * could tell that apart from a real sign-out. Required, the caller has to
   * decide what a refusal looks like. It carries an `Error` and never the
   * sdk's own type, which would put a Firebase import back in `apps/web`.
   */
  watchViewer(on: (viewer: Viewer) => void, onError: (error: Error) => void): () => void;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  declareSteamId(steamId: string): Promise<void>;
}

interface ViewerListener {
  readonly onViewer: (viewer: Viewer) => void;
  readonly onError: (error: Error) => void;
}

export function clientMembershipRecord(
  db: Firestore,
  identity: IdentitySource,
): ClientMembershipRecord {
  let signedIn: Identity | null = null;
  let viewer: Viewer = { kind: 'signed-out' };
  const listeners = new Set<ViewerListener>();
  let stopDocument = (): void => undefined;

  function publish(next: Viewer): void {
    viewer = next;
    for (const listener of listeners) listener.onViewer(next);
  }

  /**
   * Reported, and the viewer left untouched. A refusal on `members/{uid}` is
   * not evidence of anything about the person — the rules let a subject read
   * its own document, so a refusal says the read broke, not that the reader is
   * a visitor. Publishing one would trade a silent wrong state for a loud one.
   */
  function fail(error: Error): void {
    for (const listener of listeners) listener.onError(error);
  }

  // Subscribed for the record's whole lifetime, and eagerly: `declareSteamId`
  // needs to know who is signed in even when no screen is watching the viewer.
  identity.watch((next) => {
    signedIn = next;
    // A listener left open on `members/{uid}` after a sign-out is a read the
    // rules refuse, retried for as long as the tab stays open.
    stopDocument();
    stopDocument = () => undefined;

    if (next === null) {
      publish(viewerFrom(null, null));
      return;
    }
    stopDocument = onSnapshot(
      doc(db, MEMBERS, next.uid),
      (snapshot) => publish(viewerFrom(next, snapshot.data() ?? null)),
      fail,
    );
  });

  return {
    watchViewer(on, onError) {
      const listener: ViewerListener = { onViewer: on, onError };
      listeners.add(listener);
      on(viewer);
      return () => {
        listeners.delete(listener);
      };
    },

    signIn: () => identity.signIn(),
    signOut: () => identity.signOut(),

    /**
     * §5: the one write a member makes on its own document. The field travels
     * alone because the rules refuse an update that touches anything else —
     * opening `members/{uid}` wider would hand the subject its own `role`.
     */
    async declareSteamId(steamId: string): Promise<void> {
      if (signedIn === null) throw new Error('nobody is signed in');
      await updateDoc(doc(db, MEMBERS, signedIn.uid), { steamId });
    },
  };
}
