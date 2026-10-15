# L'attente d'un remplacement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quand la copie d'un jeu était en retard à la dernière lecture de la version que son éditeur publie, et qu'aucun dépôt n'a suivi, l'écran d'un monde hors service de ce jeu dit que le jeu attend que sa copie soit remplacée, et n'offre pas d'ouvrir ; une Function planifiée relit cette version toutes les heures.

**Architecture:** `libs/session` gagne la lecture chez l'éditeur (`PublisherReading`) et la règle `awaitsCopyReplacement`, qui juge la copie, la dernière lecture et la marque d'abandon du monde ; `markOfLastOpening`, que `shownSetup` gardait pour lui, devient public pour que la marque soit jugée de la même façon partout. `firestore.rules` laisse tout utilisateur lire `gameCopies/{game}`. `libs/session-record` ouvre, côté navigateur, un écouteur sur `gameCopies/{game}` à côté de celui de `completedSetups/{game}`, et publie la décision dans `ServerView.awaitsCopyReplacement`. `apps/functions` gagne `refreshPublishedVersions`, planifiée toutes les heures, qui passe par `readPublished` comme la vérification préalable. L'écran hors service suit la décision W2 du tour `.impeccable/mocks/preflight/`.

**Tech Stack:** TypeScript, Vitest, Nx, Angular, `firebase-admin`, `firebase` (SDK client), `firebase-functions` v2, émulateur Firestore.

**Spec:** docs/specs/session.md
**Batch:** docs/batches/04-copie-du-jeu-en-retard/README.md
**Sections:** Opening a session
**Blocks:** D4

## Global Constraints

**Constraints of the batch**, which every task of this plan holds:

Le document de la copie d'un jeu est `gameCopies/{game}`. L'outil de dépôt, les
Functions et l'écran s'y retrouvent.

Une `GameVersion` ne se construit que par la fonction de `libs/session`.

La story qui fait enregistrer la version par l'outil de dépôt est fusionnée
avant celle qui fait échouer la vérification préalable sur une copie en retard.
Entre les deux, le commanditaire lance
`BEACON_FIREBASE_PROJECT=<projet> npx nx run game-depot:update` jusqu'à ce que
l'outil annonce la version enregistrée. Sans version enregistrée, toute mise
en place d'un jeu qui passe par une copie est abandonnée.

D2 est transcrit avant D3, ou avec lui. D4 est transcrit après D3, ou avec
lui. D5, D6 et D7 sont transcrits avec D2. D1 est transcrit avec le premier des
autres blocs.

**Execution rules:** `spec freeze`, `spec authority`, `concision`, `untenable constraint or ADR`, `held ADRs`, `decision worth an ADR`
Before you execute or review a task of this plan, invoke
`supercharlouze:following-the-rules`. Its `Execution Rules` section says where
each rule named here is written: read them there, and follow them.

**ADRs the code of this story holds:** `docs/adr/aucun-code-ne-supprime-une-sauvegarde.md`, `docs/adr/chaque-geste-sur-une-session-laisse-un-evenement-dans-un-journal.md`, `docs/adr/chaque-jeu-apporte-sa-propre-forme-de-point-de-jonction.md`, `docs/adr/chaque-sauvegarde-a-sa-cle-et-l-origine-vient-en-tete.md`, `docs/adr/il-n-existe-qu-un-environnement.md`, `docs/adr/l-identifiant-d-un-monde-sert-de-cle-de-rangement-et-de-sous-domaine.md`, `docs/adr/la-mise-en-place-du-compte-est-un-outil-sans-etat.md`, `docs/adr/le-compte-qui-possede-un-jeu-ne-monte-jamais-sur-un-serveur-de-jeu.md`, `docs/adr/le-role-d-administrateur-vit-dans-l-enregistrement-de-l-utilisateur.md`, `docs/adr/le-semis-ne-cree-aucun-administrateur.md`, `docs/adr/le-systeme-possede-la-session-et-tout-le-reste-est-le-compte.md`, `docs/adr/les-ecrans-n-accedent-au-stockage-que-par-un-record.md`, `docs/adr/les-identifiants-d-hebergeur-vivent-dans-secret-manager.md`, `docs/adr/les-regles-d-acces-verifient-l-entree-dans-un-monde.md`, `docs/adr/toute-image-de-conteneur-est-designee-par-une-reference-immuable.md`, `docs/adr/un-outil-en-ligne-de-commande-cree-les-mondes-et-deplace-leurs-sauvegardes.md`, `docs/adr/un-serveur-de-jeu-met-fin-a-sa-propre-mise-en-place.md`, `docs/adr/un-serveur-de-jeu-n-atteint-que-les-sauvegardes-de-son-monde-et-le-depot-des-jeux.md`

### Le périmètre de cette story

Cette story ne modifie que les fichiers que ses tâches nomment, et ce document.

`docs/specs/`, `tools/`, `deploy/companion`, `deploy/cloud-init` et `probe/` ne changent pas.

`firestore.rules` ne gagne que le bloc `match /gameCopies/{game}` de la tâche 2. Aucun client n'écrit `gameCopies/{game}`.

La Function planifiée n'écrit dans `gameCopies/{game}` que `publishedVersion` et `publishedReadAt`, par `readPublished`. Elle ne loge pas dans la surveillance.

`apps/web` ne lit `gameCopies/{game}` que par `libs/session-record` : il n'importe aucun SDK Firestore et ne nomme aucun champ.

Aucun test n'atteint Steam. Aucune commande n'atteint la production : ni `firebase deploy`, ni appel à un fournisseur, ni écriture dans le Firestore de production, ni tag git. Les tests tournent contre l'émulateur.

À partir de la tâche 1, `companion:test` échoue sur le seul test `names an image built from the sources in the tree` de `deploy/companion/src/pin/catalogue-pin.spec.ts`, parce que l'empreinte du compagnon couvre `libs/session`. Cet échec est attendu jusqu'à l'épinglage décrit sous `Before the merge`, et aucune tâche ne le corrige.

### Ce que la story ne livre pas

La récupération du jeu par l'outil de dépôt appartient à sa propre story.

### Les commandes

Les tests se lancent par Nx, un projet à la fois :

```bash
npx nx run @beacon/session:test
npx nx run @beacon/session-record:test
npx nx run @beacon/functions:test
npx nx run @beacon/rules:test
npx nx run web:test
```

`@beacon/session-record:test`, `@beacon/functions:test` et `@beacon/rules:test` démarrent l'émulateur eux-mêmes.

Chaque tâche finit par `npx nx run-many -t lint typecheck -p <projets touchés>`. Prettier ne tourne pas sur les sources.

### Les commits

Un commit par tâche, au sujet que la tâche donne, en Conventional Commits, en français. Chaque commit se termine par la ligne `Co-Authored-By: Charlouze <me@charlouze.com>` et ne porte aucune autre ligne d'attribution. Les commits passent par `bash ~/.config/github-app/as-agent.sh git commit …`.

## Review Focus

- Un monde dont le jeu ne passe pas par une copie : `gameCopies/{game}` n'existe pas, et le bouton d'ouverture reste. Épinglé en tâche 3.
- `gameCopies/{game}` refusé à la lecture, comme pour un onglet ouvert avant le déploiement des règles : le monde publie toujours, et le bouton reste. Épinglé en tâche 3.
- Une lecture et un dépôt au même instant : le dépôt ne précède pas la lecture, et le jeu n'attend rien. Épinglé en tâche 1.
- Un abandon pour une copie en retard sans aucune lecture enregistrée, l'enregistrement de la Function ayant échoué : le jeu attend. Épinglé en tâche 1.
- Un dépôt fait pendant qu'un membre regarde l'écran : le bouton revient sans rechargement. Épinglé en tâche 3.

---

### Task 1: L'attente d'un remplacement, dans le domaine

**Files:**
- Create: `libs/session/src/lib/copy-replacement.ts`
- Modify: `libs/session/src/lib/setup.ts` (`shownSetup`, `markOf`)
- Modify: `libs/session/src/index.ts`
- Test: `libs/session/src/lib/copy-replacement.spec.ts`, `libs/session/src/lib/setup.spec.ts`

**Interfaces:**
- Consumes: `GameCopy`, `copyIsBehind` (`preflight.ts`) ; `AbandonedSetup`, `LastOpening` (`setup.ts`) ; `GameVersion`, `gameVersionFrom` (`game-version.ts`).
- Produces:
  - `interface PublisherReading { readonly version: GameVersion; readonly readAt: Date }`
  - `interface CopyReplacementFacts { readonly copy: GameCopy | null; readonly lastReading: PublisherReading | null; readonly abandoned: AbandonedSetup | null }`
  - `function awaitsCopyReplacement(facts: CopyReplacementFacts): boolean`
  - `function markOfLastOpening(opening: LastOpening, abandoned: AbandonedSetup | null): AbandonedSetup | null`

Les règles viennent du `Technical design` du lot, section « Le domaine » : un jeu attend que sa copie soit remplacée quand une lecture existe, que la copie est en retard sur elle, et que le dernier dépôt, s'il y en a un, la précède ; il l'attend aussi quand la dernière mise en place du monde a été abandonnée pour une copie en retard et que ni un dépôt ni une lecture enregistrée ne suit cet abandon. « Précède » et « suit » sont stricts.

- [ ] **Step 1: Write the failing tests**

`libs/session/src/lib/copy-replacement.spec.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { awaitsCopyReplacement, type PublisherReading } from './copy-replacement.js';
import { gameVersionFrom, type GameVersion } from './game-version.js';
import type { GameCopy } from './preflight.js';
import type { AbandonedSetup } from './setup.js';

const version = (digits: string): GameVersion => {
  const built = gameVersionFrom(digits);
  if (built === null) throw new Error(`not a version: ${digits}`);
  return built;
};

const at = (hhmm: string) => new Date(`2026-10-15T${hhmm}:00Z`);
const copy = (digits: string, depositedAt: string): GameCopy => ({ version: version(digits), depositedAt: at(depositedAt) });
const reading = (digits: string, readAt: string): PublisherReading => ({ version: version(digits), readAt: at(readAt) });
const abandoned = (when: string, cause: AbandonedSetup['cause']): AbandonedSetup => ({ sessionId: 's1', at: at(when), cause });

describe('awaitsCopyReplacement', () => {
  describe('from the last reading of the publisher', () => {
    it('waits when the reading follows the deposit and finds another version', () => {
      expect(
        awaitsCopyReplacement({ copy: copy('100', '18:00'), lastReading: reading('200', '19:00'), abandoned: null }),
      ).toBe(true);
    });

    it('does not wait when the reading finds the version deposited', () => {
      expect(
        awaitsCopyReplacement({ copy: copy('200', '18:00'), lastReading: reading('200', '19:00'), abandoned: null }),
      ).toBe(false);
    });

    // Any deposit gives the button back; the next reading decides again.
    it('does not wait once a deposit follows the reading, whatever it deposited', () => {
      expect(
        awaitsCopyReplacement({ copy: copy('100', '20:00'), lastReading: reading('200', '19:00'), abandoned: null }),
      ).toBe(false);
    });

    it('does not wait when the deposit and the reading fall on the same instant', () => {
      expect(
        awaitsCopyReplacement({ copy: copy('100', '19:00'), lastReading: reading('200', '19:00'), abandoned: null }),
      ).toBe(false);
    });

    it('waits when no deposit is recorded at all', () => {
      expect(awaitsCopyReplacement({ copy: null, lastReading: reading('200', '19:00'), abandoned: null })).toBe(true);
    });

    it('does not wait while nothing was ever read', () => {
      expect(awaitsCopyReplacement({ copy: copy('100', '18:00'), lastReading: null, abandoned: null })).toBe(false);
      expect(awaitsCopyReplacement({ copy: null, lastReading: null, abandoned: null })).toBe(false);
    });
  });

  describe('after a setup abandoned for a behind copy', () => {
    // The preflight check read the publisher; recording what it read may have failed.
    it('waits when nothing follows the abandon, even with no reading recorded', () => {
      expect(
        awaitsCopyReplacement({ copy: copy('100', '18:00'), lastReading: null, abandoned: abandoned('20:14', 'copy-behind') }),
      ).toBe(true);
    });

    it('waits when the only recorded reading precedes the abandon and found the copy current', () => {
      expect(
        awaitsCopyReplacement({
          copy: copy('100', '18:00'),
          lastReading: reading('100', '19:00'),
          abandoned: abandoned('20:14', 'copy-behind'),
        }),
      ).toBe(true);
    });

    it('does not wait once a deposit follows the abandon', () => {
      expect(
        awaitsCopyReplacement({
          copy: copy('200', '20:30'),
          lastReading: reading('200', '20:14'),
          abandoned: abandoned('20:14', 'copy-behind'),
        }),
      ).toBe(false);
    });

    it('leaves it to a reading that follows the abandon', () => {
      const facts = { copy: copy('100', '18:00'), abandoned: abandoned('20:14', 'copy-behind') };
      expect(awaitsCopyReplacement({ ...facts, lastReading: reading('100', '21:00') })).toBe(false);
      expect(awaitsCopyReplacement({ ...facts, lastReading: reading('200', '21:00') })).toBe(true);
    });

    it('reads nothing into an abandon for another cause, or for none', () => {
      const facts = { copy: copy('100', '18:00'), lastReading: reading('100', '19:00') };
      expect(awaitsCopyReplacement({ ...facts, abandoned: abandoned('20:14', 'version-unreadable') })).toBe(false);
      expect(awaitsCopyReplacement({ ...facts, abandoned: abandoned('20:14', null) })).toBe(false);
    });
  });
});
```

Dans `libs/session/src/lib/setup.spec.ts`, ajouter `markOfLastOpening` à l'import depuis `./setup.js`, puis à la fin du fichier :

```ts
describe('markOfLastOpening', () => {
  const AT = new Date('2026-10-15T20:14:00Z');
  const mark: AbandonedSetup = { sessionId: 's1', at: AT, cause: 'copy-behind' };
  const opening = (state: 'IDLE' | 'PROVISIONING', sessionId: string) => ({ state, sessionId, startedAt: AT });

  it('is the mark of the last session opened, once it no longer prepares', () => {
    expect(markOfLastOpening(opening('IDLE', 's1'), mark)).toBe(mark);
  });

  it('is none while the last session opened prepares', () => {
    expect(markOfLastOpening(opening('PROVISIONING', 's1'), mark)).toBeNull();
  });

  // A session stopped before it was claimed leaves the mark of the session before it.
  it('is none when the mark names another session', () => {
    expect(markOfLastOpening(opening('IDLE', 's2'), mark)).toBeNull();
  });

  it('is none when there is no mark', () => {
    expect(markOfLastOpening(opening('IDLE', 's1'), null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx run @beacon/session:test`
Expected: FAIL — `copy-replacement.js` introuvable, `markOfLastOpening` non exporté.

- [ ] **Step 3: Write the implementation**

`libs/session/src/lib/copy-replacement.ts` :

```ts
import type { GameVersion } from './game-version.js';
import { copyIsBehind, type GameCopy } from './preflight.js';
import type { AbandonedSetup } from './setup.js';

/** The last version the system read from a game's publisher, and when it read it. */
export interface PublisherReading {
  readonly version: GameVersion;
  readonly readAt: Date;
}

/** What decides, for one world, whether its game waits for its copy to be replaced. */
export interface CopyReplacementFacts {
  /** The copy the last recorded deposit put in place, or null when none is. */
  readonly copy: GameCopy | null;
  /** The last recorded reading of the publisher, or null when none is. */
  readonly lastReading: PublisherReading | null;
  /** The mark of the world's last setup when it was abandoned, or null. */
  readonly abandoned: AbandonedSetup | null;
}

/**
 * Whether a game waits for its copy to be replaced: its copy was behind the
 * last version read from its publisher, and no deposit followed that reading.
 *
 * A setup abandoned for a behind copy is such a reading, the preflight check's
 * own, and counts even when recording it failed, until a deposit or a recorded
 * reading follows the abandon.
 */
export function awaitsCopyReplacement(facts: CopyReplacementFacts): boolean {
  const { copy, lastReading, abandoned } = facts;
  if (
    abandoned?.cause === 'copy-behind' &&
    !follows(copy?.depositedAt, abandoned.at) &&
    !follows(lastReading?.readAt, abandoned.at)
  ) {
    return true;
  }
  if (lastReading === null) return false;
  const depositPrecedesReading = copy === null || copy.depositedAt.getTime() < lastReading.readAt.getTime();
  return depositPrecedesReading && copyIsBehind(copy, lastReading.version);
}

function follows(instant: Date | undefined, reference: Date): boolean {
  return instant !== undefined && instant.getTime() > reference.getTime();
}
```

Dans `libs/session/src/lib/setup.ts`, remplacer la fonction privée `markOf` par une fonction exportée, placée juste après `shownSetup`, et l'appeler sous ce nom dans `shownSetup` (`const mark = markOfLastOpening(opening, abandoned);`). Le commentaire de `shownSetup` qui dit « The mark counts on the same condition… » reste.

```ts
/**
 * The mark of the last session a world opened, once that session no longer
 * prepares. A session stopped before it was claimed leaves the mark of the
 * session before it, which counts for nothing.
 */
export function markOfLastOpening(opening: LastOpening, abandoned: AbandonedSetup | null): AbandonedSetup | null {
  if (opening.state === 'PROVISIONING') return null;
  return abandoned !== null && abandoned.sessionId === opening.sessionId ? abandoned : null;
}
```

Dans `libs/session/src/index.ts`, ajouter, dans l'ordre alphabétique des lignes existantes :

```ts
export * from './lib/copy-replacement.js';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx run @beacon/session:test`
Expected: PASS, les tests existants de `shownSetup` compris.

- [ ] **Step 5: Lint, typecheck, commit**

```bash
npx nx run-many -t lint typecheck -p @beacon/session
git add libs/session/src
bash ~/.config/github-app/as-agent.sh git commit -m "feat(session): décide qu'un jeu attend que sa copie soit remplacée

Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 2: Tout utilisateur lit la copie d'un jeu

**Files:**
- Modify: `firestore.rules` (après le bloc `match /completedSetups/{game}`)
- Create: `libs/rules/src/lib/game-copies.spec.ts`

**Interfaces:**
- Consumes: le harnais de `libs/rules/src/lib/harness.ts` (`ALICE`, `BOB`, `MALLORY`, `ROOT`, `env`, `as`, `given`, `useRulesEnvironment`).
- Produces: `gameCopies/{game}` lisible par tout utilisateur, écrit par aucun client.

Avant de toucher `firestore.rules`, invoquer `firebase-firestore`, puis `firebase-security-rules-auditor` sur le bloc écrit.

- [ ] **Step 1: Write the failing test**

`libs/rules/src/lib/game-copies.spec.ts` :

```ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { beforeEach, describe, it } from 'vitest';
import { ALICE, BOB, env, MALLORY, ROOT, as, given, useRulesEnvironment } from './harness.js';

useRulesEnvironment();

const gameCopy = (uid: string | null, game = 'sunkenland') => doc(as(env, uid), 'gameCopies', game);

const RECORDED = { depositedVersion: '25700000', publishedVersion: '25746735' };

describe('gameCopies/{game}', () => {
  beforeEach(async () => {
    await given(env, 'gameCopies/sunkenland', RECORDED);
  });

  // Two public versions and two instants: the screen of any world of that
  // game says from them whether the game waits for its copy.
  it('is read by every user, whatever world they play in', async () => {
    await assertSucceeds(getDoc(gameCopy(ALICE)));
    await assertSucceeds(getDoc(gameCopy(BOB)));
    await assertSucceeds(getDoc(gameCopy(ROOT)));
  });

  it('is read as absent by a user, for a game that keeps no copy', async () => {
    await assertSucceeds(getDoc(gameCopy(ALICE, 'enshrouded')));
  });

  it('is read by nobody who is not a user', async () => {
    await assertFails(getDoc(gameCopy(MALLORY)));
    await assertFails(getDoc(gameCopy(null)));
  });

  it('is written by no user, whatever the write', async () => {
    await assertFails(updateDoc(gameCopy(ALICE), { depositedVersion: '25746735' }));
    await assertFails(setDoc(gameCopy(ALICE), RECORDED));
    await assertFails(deleteDoc(gameCopy(ALICE)));
  });

  it('is written by no admin either', async () => {
    await assertFails(updateDoc(gameCopy(ROOT), { publishedVersion: '25700000' }));
    await assertFails(deleteDoc(gameCopy(ROOT)));
  });

  it('is created by no user for a game that keeps no copy', async () => {
    await assertFails(setDoc(gameCopy(ALICE, 'enshrouded'), RECORDED));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx run @beacon/rules:test`
Expected: FAIL sur les trois lectures autorisées, refusées par défaut.

- [ ] **Step 3: Write the rule**

Dans `firestore.rules`, juste après le bloc `match /completedSetups/{game} { … }` :

```
    // The copy Beacon keeps of each game, and the version its publisher last
    // published: public versions and instants, nothing of a world. Every user
    // reads them — the screen of a world out of service says from them whether
    // its game waits for its copy — and no client writes them: the deposit
    // tool and the Functions write through the Admin SDK.
    match /gameCopies/{game} {
      allow read: if isMember();
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx run @beacon/rules:test`
Expected: PASS.

- [ ] **Step 5: Lint, typecheck, commit**

```bash
npx nx run-many -t lint typecheck -p @beacon/rules
git add firestore.rules libs/rules/src/lib/game-copies.spec.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(rules): laisse tout utilisateur lire la copie d'un jeu

Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 3: Le navigateur publie si le jeu attend que sa copie soit remplacée

**Files:**
- Modify: `libs/session-record/src/lib/fields.ts` (après `gameCopyFrom`)
- Modify: `libs/session-record/src/lib/client-session.ts` (`ServerView`, `watchWorldSummary`)
- Modify: les fixtures de `ServerView` de `apps/web` : `apps/web/src/app/session/closing.component.spec.ts`, `in-service.component.spec.ts`, `not-cleared.component.spec.ts`, `out-of-service.component.spec.ts`, `preparing.component.spec.ts`, `session.page.spec.ts`, `apps/web/src/app/worlds/overview.spec.ts`, `world.route.spec.ts`, `worlds.page.spec.ts`
- Test: `libs/session-record/src/lib/fields.spec.ts`, `libs/session-record/src/lib/client-session.spec.ts`, `libs/session-record/src/lib/client-session-resilience.spec.ts`

**Interfaces:**
- Consumes: `awaitsCopyReplacement`, `markOfLastOpening`, `PublisherReading` (tâche 1) ; `gameCopyFrom`, `gameCopyDocPath` (`fields.ts`).
- Produces:
  - `function publisherReadingFrom(data: Record<string, unknown>): PublisherReading | null` dans `fields.ts`
  - `ServerView.awaitsCopyReplacement: boolean`

- [ ] **Step 1: Write the failing tests**

Dans `libs/session-record/src/lib/fields.spec.ts`, ajouter `publisherReadingFrom` à l'import depuis `./fields.js`, puis après le `describe('gameCopyFrom', …)` :

```ts
describe('publisherReadingFrom', () => {
  const AT = new Date('2026-10-15T19:00:00Z');

  it('reads the version last read from the publisher, and when', () => {
    expect(publisherReadingFrom({ publishedVersion: '25746735', publishedReadAt: AT })).toEqual({
      version: '25746735',
      readAt: AT,
    });
  });

  it('reads no reading where none is recorded', () => {
    expect(publisherReadingFrom({})).toBeNull();
    expect(publisherReadingFrom({ depositedVersion: '25746735', depositedAt: AT })).toBeNull();
  });

  it('reads no reading from half of one, or from a version that is not one', () => {
    expect(publisherReadingFrom({ publishedVersion: '25746735' })).toBeNull();
    expect(publisherReadingFrom({ publishedReadAt: AT })).toBeNull();
    expect(publisherReadingFrom({ publishedVersion: 'v1.2', publishedReadAt: AT })).toBeNull();
  });
});
```

Dans `libs/session-record/src/lib/client-session.spec.ts`, ajouter à la fin du fichier un `describe` de premier niveau :

```ts
describe('whether the game waits for its copy to be replaced', () => {
  const DEPOSITED = new Date('2026-10-15T18:00:00Z');
  const READ = new Date('2026-10-15T19:00:00Z');
  const ABANDONED = new Date('2026-10-15T20:14:00Z');

  const copyDoc = () => getFirestore().doc('gameCopies/sunkenland');

  const recorded = (fields: Record<string, unknown>) => copyDoc().set(fields, { merge: true });

  const deposit = (version: string, at: Date) =>
    recorded({ depositedVersion: version, depositedAt: Timestamp.fromDate(at) });

  const reading = (version: string, at: Date) =>
    recorded({ publishedVersion: version, publishedReadAt: Timestamp.fromDate(at) });

  const view = () =>
    firstValue<WorldSummary | null>((on) => record().watchWorld('les-copains', on));

  beforeEach(async () => {
    await seedWorld('les-copains', { players: ['alice'], game: 'sunkenland' });
  });

  it('waits when the last reading follows the deposit and finds another version', async () => {
    await deposit('25700000', DEPOSITED);
    await reading('25746735', READ);

    expect((await view())?.server?.awaitsCopyReplacement).toBe(true);
  });

  it('does not wait when the last reading finds the version deposited', async () => {
    await deposit('25746735', DEPOSITED);
    await reading('25746735', READ);

    expect((await view())?.server?.awaitsCopyReplacement).toBe(false);
  });

  // A game that goes through no copy has no document at all.
  it('does not wait when the game has no copy document', async () => {
    expect((await view())?.server?.awaitsCopyReplacement).toBe(false);
  });

  it('waits after a setup abandoned for a behind copy, with no reading recorded', async () => {
    await deposit('25700000', DEPOSITED);
    await getFirestore()
      .doc(serverDocPath('les-copains'))
      .set(
        {
          state: 'IDLE',
          stateSince: Timestamp.fromDate(ABANDONED),
          sessionId: 's1',
          abandonedSetup: { sessionId: 's1', at: Timestamp.fromDate(ABANDONED), cause: 'copy-behind' },
        },
        { merge: true },
      );

    expect((await view())?.server?.awaitsCopyReplacement).toBe(true);
  });

  it('follows a deposit made while the world is watched', async () => {
    await deposit('25700000', DEPOSITED);
    await reading('25746735', READ);
    const seen: (WorldSummary | null)[] = [];
    const unsubscribe = record().watchWorld('les-copains', (summary) => seen.push(summary));
    await vi.waitFor(() => expect(seen.at(-1)?.server?.awaitsCopyReplacement).toBe(true));

    await deposit('25746735', new Date('2026-10-15T21:00:00Z'));

    await vi.waitFor(() => expect(seen.at(-1)?.server?.awaitsCopyReplacement).toBe(false));
    unsubscribe();
  });
});
```

Dans `libs/session-record/src/lib/client-session-resilience.spec.ts`, ses règles refusent tout ce qu'elles ne nomment pas, `gameCopies/{game}` compris. Dans le test `does not stop the world and server from still publishing, nor from publishing again`, après `expect(seen.at(-1)?.server?.readyWindow).toBeNull();`, ajouter :

```ts
    // Nor on `gameCopies`: the world publishes all the same, and its game waits for nothing.
    expect(seen.at(-1)?.server?.awaitsCopyReplacement).toBe(false);
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx run @beacon/session-record:test`
Expected: FAIL — `publisherReadingFrom` non exporté ; `awaitsCopyReplacement` absent de la vue publiée.

- [ ] **Step 3: Write the implementation**

Dans `libs/session-record/src/lib/fields.ts`, ajouter `type PublisherReading` à l'import depuis `@beacon/session`, puis juste après `gameCopyFrom` :

```ts
/** The reading of the publisher recorded on `gameCopies/{game}`. Half a reading, or a version that is not one, reads as none. */
export function publisherReadingFrom(data: Record<string, unknown>): PublisherReading | null {
  const version = gameVersionFrom(data['publishedVersion']);
  const readAt = toDate(data['publishedReadAt']);
  if (version === null || readAt === null) return null;
  return { version, readAt };
}
```

Dans `libs/session-record/src/lib/client-session.ts` :

1. Ajouter `awaitsCopyReplacement` et `markOfLastOpening` à l'import depuis `@beacon/session`, et `gameCopyDocPath`, `gameCopyFrom`, `publisherReadingFrom` à l'import depuis `./fields.js`.

2. Dans `ServerView`, après `readyWindow` :

```ts
  /**
   * Whether the world's game waits for its copy to be replaced, whatever the
   * state: only the screen of a world out of service says it.
   */
  readonly awaitsCopyReplacement: boolean;
```

3. Dans `watchWorldSummary`, à côté de `completedData` et `unsubCompleted` :

```ts
    let copyData: Record<string, unknown> | undefined;
    let unsubCopy: Unsubscribe | null = null;
```

4. Dans `publish`, remplacer la garde et son commentaire :

```ts
          // A world `worldFrom` reads names a game this vocabulary knows, so the
          // listeners on that game's documents are already open and will
          // answer, by a snapshot or by a refusal: waiting here cannot hang.
          if (completedData === undefined || copyData === undefined) return;
```

5. Dans l'objet `server` publié, après `readyWindow` :

```ts
              awaitsCopyReplacement: awaitsCopyReplacement({
                copy: gameCopyFrom(copyData),
                lastReading: publisherReadingFrom(copyData),
                abandoned: markOfLastOpening(opening, abandonedSetupFrom(serverData)),
              }),
```

6. Remplacer `watchCompletedSetups` et son commentaire par :

```ts
    // One document per game for each, and a world never changes game: the
    // listeners open on the first snapshot of the world that names one, and
    // stay. Absent or refused, each reads as nothing recorded: no window is
    // announced, and the game waits for no copy.
    const watchGameDocuments = (world: Record<string, unknown>): void => {
      const game = gameFrom(world);
      if (game === null || unsubCompleted !== null) return;
      unsubCompleted = onSnapshot(
        doc(db, completedSetupsDocPath(game)),
        (snapshot) => {
          completedData = snapshot.data() ?? {};
          publish();
        },
        () => {
          completedData = {};
          publish();
        },
      );
      unsubCopy = onSnapshot(
        doc(db, gameCopyDocPath(game)),
        (snapshot) => {
          copyData = snapshot.data() ?? {};
          publish();
        },
        () => {
          copyData = {};
          publish();
        },
      );
    };
```

et l'appeler sous ce nom dans le listener du monde (`if (worldData !== null) watchGameDocuments(worldData);`).

7. Dans la fonction de désabonnement, après `unsubCompleted?.();` : `unsubCopy?.();`.

Dans `apps/web`, chaque littéral `ServerView` des fichiers listés sous **Files** gagne `awaitsCopyReplacement: false` à côté de `readyWindow`. Dans `preparing.component.spec.ts`, c'est l'objet que construit la fonction qui reçoit `readyWindow` en paramètre. `npx nx run web:typecheck` nomme tout littéral oublié.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx run @beacon/session-record:test`, puis `npx nx run web:test`
Expected: PASS.

- [ ] **Step 5: Lint, typecheck, commit**

```bash
npx nx run-many -t lint typecheck -p @beacon/session-record web
git add libs/session-record/src apps/web/src
bash ~/.config/github-app/as-agent.sh git commit -m "feat(session-record): publie si le jeu d'un monde attend que sa copie soit remplacée

Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 4: Une Function relit toutes les heures la version publiée

**Files:**
- Create: `apps/functions/src/published-refresh.ts`
- Modify: `apps/functions/src/platform-journal.ts` (`FailureSource`)
- Modify: `apps/functions/src/container.ts`
- Modify: `apps/functions/src/main.ts`
- Modify: `apps/functions/bundle-check.mjs` (`FUNCTIONS`)
- Test: `apps/functions/src/published-refresh.spec.ts`, `apps/functions/src/main.spec.ts`

**Interfaces:**
- Consumes: `readPublished`, `PublishedVersionDeps` (`published-version.ts`) ; `PlatformJournal` ; `GAMES` (`@beacon/session`) ; `catalogFor` (`@beacon/cloud-init`).
- Produces:
  - `interface PublishedRefreshDeps extends PublishedVersionDeps { readonly journal: PlatformJournal }`
  - `function runPublishedRefresh(deps: PublishedRefreshDeps): Promise<void>`
  - `function buildPublishedRefreshDeps(): PublishedRefreshDeps` dans `container.ts`
  - les sources `publishedRefresh.read` et `publishedRefresh.record` de `FailureSource`
  - la Function `refreshPublishedVersions`

- [ ] **Step 1: Write the failing tests**

`apps/functions/src/published-refresh.spec.ts` :

```ts
import { describe, expect, it, vi } from 'vitest';
import { gameVersionFrom, type GameVersion, type PublishedVersion } from '@beacon/session';
import { runPublishedRefresh } from './published-refresh.js';

const version = (digits: string): GameVersion => {
  const built = gameVersionFrom(digits);
  if (built === null) throw new Error(`not a version: ${digits}`);
  return built;
};

const depsAnswering = (answer: PublishedVersion) => ({
  publisher: { publishedVersion: vi.fn(async () => answer) },
  gameCopies: { read: vi.fn(async () => null), recordPublished: vi.fn(async () => undefined) },
  journal: { failure: vi.fn(), setupChanged: vi.fn(), discarded: vi.fn() },
});

describe('runPublishedRefresh', () => {
  it('reads the publisher of a game that goes through a copy, and of no other', async () => {
    const deps = depsAnswering({ readable: true, version: version('25746735') });

    await runPublishedRefresh(deps);

    expect(deps.publisher.publishedVersion).toHaveBeenCalledWith('sunkenland');
    expect(deps.publisher.publishedVersion).not.toHaveBeenCalledWith('enshrouded');
  });

  it('records what it read, and journals nothing', async () => {
    const deps = depsAnswering({ readable: true, version: version('25746735') });

    await runPublishedRefresh(deps);

    expect(deps.gameCopies.recordPublished).toHaveBeenCalledWith('sunkenland', '25746735');
    expect(deps.journal.failure).not.toHaveBeenCalled();
  });

  it('writes nothing when the version is unreadable, and journals why', async () => {
    const deps = depsAnswering({ readable: false, cause: 'no answer within 10 s' });

    await runPublishedRefresh(deps);

    expect(deps.gameCopies.recordPublished).not.toHaveBeenCalled();
    expect(deps.journal.failure).toHaveBeenCalledWith({
      source: 'publishedRefresh.read',
      sessionId: null,
      error: 'no answer within 10 s',
    });
  });

  it('journals a reading it could not record', async () => {
    const deps = depsAnswering({ readable: true, version: version('25746735') });
    deps.gameCopies.recordPublished.mockRejectedValue(new Error('firestore is down'));

    await runPublishedRefresh(deps);

    expect(deps.journal.failure).toHaveBeenCalledWith({
      source: 'publishedRefresh.record',
      sessionId: null,
      error: 'Error: firestore is down',
    });
  });
});
```

Dans `apps/functions/src/main.spec.ts`, importer `refreshPublishedVersions` depuis `./main.js` à côté des deux autres, puis ajouter :

```ts
describe('the refreshPublishedVersions schedule', () => {
  it('reads the publishers every hour, with no retry', () => {
    const endpoint = (
      refreshPublishedVersions as unknown as {
        __endpoint: { scheduleTrigger: { schedule: string; retryConfig?: { retryCount?: number } } };
      }
    ).__endpoint;
    expect(endpoint.scheduleTrigger.schedule).toBe('every 60 minutes');
    expect(endpoint.scheduleTrigger.retryConfig?.retryCount).toBe(0);
  });
});
```

Si la forme de `__endpoint` diffère de celle écrite ici, lire celle que `firebase-functions/v2/scheduler` produit pour `watchdog` et ajuster le type du test, pas la valeur attendue.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx run @beacon/functions:test`
Expected: FAIL — `published-refresh.js` introuvable, `refreshPublishedVersions` non exporté.

- [ ] **Step 3: Write the implementation**

Dans `apps/functions/src/platform-journal.ts`, ajouter à `FailureSource`, après `'provisioning.recordPublished'` :

```ts
  | 'publishedRefresh.read'
  | 'publishedRefresh.record'
```

`apps/functions/src/published-refresh.ts` :

```ts
import { catalogFor } from '@beacon/cloud-init';
import { GAMES, type Game } from '@beacon/session';
import type { PlatformJournal } from './platform-journal.js';
import { readPublished, type PublishedVersionDeps } from './published-version.js';

export interface PublishedRefreshDeps extends PublishedVersionDeps {
  readonly journal: PlatformJournal;
}

/**
 * Reads, then records, the version the publisher of each game that goes
 * through a copy publishes. What it cannot read or record goes to the platform
 * journal, and the other games are read all the same.
 */
export async function runPublishedRefresh(deps: PublishedRefreshDeps): Promise<void> {
  for (const game of GAMES.filter(goesThroughCopy)) {
    const { published, recordError } = await readPublished(deps, game);
    if (!published.readable) {
      deps.journal.failure({ source: 'publishedRefresh.read', sessionId: null, error: published.cause });
    }
    if (recordError !== null) {
      deps.journal.failure({ source: 'publishedRefresh.record', sessionId: null, error: recordError });
    }
  }
}

function goesThroughCopy(game: Game): boolean {
  return catalogFor(game).copySteamApp !== null;
}
```

Dans `apps/functions/src/container.ts` :

1. Importer `type PublishedRefreshDeps` depuis `./published-refresh.js`.

2. Ajouter, avant `buildDeps` :

```ts
/**
 * The reading of a game's publisher, shared by the preflight check and the
 * hourly refresh. The catalogue knows which Steam application a game's copy
 * holds; the adapter only knows how to read one.
 */
function publisher() {
  return steamPublisher({ appOf: (game) => catalogFor(game).copySteamApp });
}
```

3. Dans `buildProvisionDeps`, remplacer la ligne `publisher: steamPublisher(…)` et son commentaire par `publisher: publisher(),`.

4. Ajouter à la fin du fichier :

```ts
/** What the hourly refresh needs: no Scaleway client, no secret. */
export function buildPublishedRefreshDeps(): PublishedRefreshDeps {
  const db = getFirestore(defaultApp());
  return { publisher: publisher(), gameCopies: gameCopyStore(db), journal: platformJournal };
}
```

Dans `apps/functions/src/main.ts`, importer `buildPublishedRefreshDeps` depuis `./container.js` et `runPublishedRefresh` depuis `./published-refresh.js`, puis ajouter après `watchdog` :

```ts
/**
 * Reads, every hour, the version each game's publisher publishes, so that the
 * screen of a world out of service says its game waits for its copy before
 * anyone opens. Apart from the watchdog: a pass of the watchdog must not
 * depend on a call to Steam.
 */
export const refreshPublishedVersions = onSchedule(
  {
    schedule: 'every 60 minutes',
    timeZone: 'Etc/UTC',
    region: 'europe-west1',
    timeoutSeconds: 120,
    // steam-user, loaded at the first reading, as in onServerStateChange.
    memory: '512MiB',
    // No retry: the next reading is an hour away.
    retryCount: 0,
  },
  async () => {
    await runPublishedRefresh(buildPublishedRefreshDeps());
  },
);
```

Dans `apps/functions/bundle-check.mjs` :

```js
const FUNCTIONS = ['watchdog', 'refreshPublishedVersions', 'onServerStateChange', 'agentReport'];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx run @beacon/functions:test`
Expected: PASS.

Run: `npx nx run @beacon/functions:bundle-check`
Expected: `bundle-check: the bundle loads, and steam-user loads from the dependencies it declares`.

- [ ] **Step 5: Lint, typecheck, commit**

```bash
npx nx run-many -t lint typecheck -p @beacon/functions
git add apps/functions/src apps/functions/bundle-check.mjs
bash ~/.config/github-app/as-agent.sh git commit -m "feat(functions): relit toutes les heures la version que l'éditeur d'un jeu publie

Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 5: L'écran hors service dit que le jeu attend que sa copie soit remplacée

**Files:**
- Modify: `apps/web/src/app/session/out-of-service.component.ts`
- Modify: `apps/functions/src/screen.ts`
- Modify: `mise.toml` (`[tasks.screen]`)
- Already written: `.impeccable/mocks/preflight/` (planche, section 5, et décision W2), commitée avec cette tâche
- Test: `apps/web/src/app/session/out-of-service.component.spec.ts`, `apps/functions/src/screen.spec.ts`

**Interfaces:**
- Consumes: `ServerView.awaitsCopyReplacement` (tâche 3).
- Produces: l'écran `copy-awaited` de `mise run screen`.

Les mots et la forme viennent du tour `.impeccable/mocks/preflight/README.md`, section « L'attente d'un remplacement », décision W2 :

| Situation | Titre | Texte sous le titre | Pied |
|---|---|---|---|
| Le jeu attend, sans abandon ni refus | `Nothing is running.` | `The game had an update that the copy here doesn’t have yet, and nothing opens on an old copy. Tell whoever runs this.` | la ligne d'attente |
| Le jeu attend, après un abandon ou un refus | `It didn’t start.` | `Nothing was left running, and nothing is costing anything. The game had an update that the copy here doesn’t have yet. Tell whoever runs this.` | la ligne d'attente |
| Le jeu n'attend rien | inchangé | inchangé | le bouton, inchangé |

La ligne d'attente reprend la classe `.call` de `apps/web/src/styles.css`, celle de `Extension call` en service : `Waiting for` (`.k`), `A new copy of the game` (`.at`), `Opening comes back here as soon as it’s in place.` (`.said`). Quand le jeu attend, la plaque `Next session` / `Estimated cost`, le bouton et la ligne `We’ll tell you the exact time once it’s on its way.` disparaissent. La ligne d'arrêt rouge reste telle que la story 3 l'a livrée.

- [ ] **Step 1: Write the failing tests**

Dans `apps/web/src/app/session/out-of-service.component.spec.ts`, faire prendre à `render` un troisième paramètre `awaitsCopyReplacement = false`, transmis dans la vue à la place du `awaitsCopyReplacement: false` de la tâche 3, puis ajouter :

```ts
  describe('while the game waits for its copy to be replaced', () => {
    const PREFLIGHT_BEHIND: ShownSetup = {
      stage: 'preflight',
      since: new Date('2026-09-12T20:13:00'),
      abandonedAt: new Date('2026-09-12T20:14:00'),
      failure: 'copy-behind',
    };

    it('says so in place of offering to open', async () => {
      const fixture = await render(null, null, true);
      const element: HTMLElement = fixture.nativeElement;

      expect(element.querySelector('[data-action="open"]')).toBeNull();
      expect(element.querySelector('[data-field="copy-awaited"]')?.textContent).toContain('A new copy of the game');
      expect(element.textContent).toContain('Opening comes back here as soon as it’s in place.');
    });

    it('says why nothing opens, and quotes no next session', async () => {
      const text: string = (await render(null, null, true)).nativeElement.textContent;

      expect(text).toContain('Nothing is running.');
      expect(text).toContain('nothing opens on an old copy. Tell whoever runs this.');
      expect(text).not.toContain('Next session');
      expect(text).not.toContain('exact time');
    });

    it('says both after a setup abandoned for a behind copy, and offers no retry', async () => {
      const fixture = await render(null, PREFLIGHT_BEHIND, true);
      const element: HTMLElement = fixture.nativeElement;

      expect(element.textContent).toContain('It didn’t start.');
      expect(element.textContent).toContain(
        'Nothing was left running, and nothing is costing anything. The game had an update that the copy here doesn’t have yet. Tell whoever runs this.',
      );
      expect(element.querySelector('[data-field="stopped-at"]')?.textContent).toContain('the game’s copy is out of date');
      expect(element.textContent).not.toContain('Try again');
      expect(element.textContent).not.toContain('pressing again');
      expect(element.querySelector('[data-field="copy-awaited"]')).not.toBeNull();
    });

    it('offers no retry after a refusal either', async () => {
      const fixture = await render('no capacity left for this machine size in the zone', null, true);

      expect(fixture.nativeElement.querySelector('[data-action="open"]')).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain('Press again');
    });
  });

  it('offers to open, and says no wait, while the game waits for nothing', async () => {
    const fixture = await render();

    expect(fixture.nativeElement.querySelector('[data-action="open"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-field="copy-awaited"]')).toBeNull();
  });
```

Dans `apps/functions/src/screen.spec.ts` :

1. Dans `names only screens the board can actually announce`, ajouter `'copy-awaited',` à la liste attendue, après `'preflight-unreadable',`.
2. Dans le `it.each` de `makes %s readable as %s`, ajouter `['copy-awaited', 'IDLE'],` après `['failed', 'FAILED'],`.
3. Après le `it.each` de `stages %s as a world out of service…` :

```ts
  // It waits from the copy document `screen()` writes, not from an abandon.
  it('stages copy-awaited as a world out of service with no abandoned setup', () => {
    expect(screenFixture('copy-awaited', NOW)['abandonedSetup']).toBeNull();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx run web:test`, puis `npx nx run @beacon/functions:test`
Expected: FAIL — le bouton s'affiche encore ; `copy-awaited` n'est pas un écran.

- [ ] **Step 3: Write the implementation**

Dans `apps/web/src/app/session/out-of-service.component.ts` :

1. Ajouter, sous `PREFLIGHT_ADVICE` :

```ts
/** Why nothing opens while the game waits for its copy to be replaced. */
const COPY_AWAITED = 'The game had an update that the copy here doesn’t have yet';
```

2. Dans la classe, ajouter :

```ts
  readonly awaits = computed(() => this.view().awaitsCopyReplacement);
```

et faire commencer `advice` par :

```ts
    if (this.awaits()) return `${COPY_AWAITED}. Tell whoever runs this.`;
```

avant la garde `if (stopped === null) return '';`, puis lui faire rendre le conseil du refus quand rien ne s'est arrêté :

```ts
    if (stopped === null) return 'Press again — a refusal one minute is usually gone the next.';
```

3. Dans le gabarit, remplacer le premier bloc `<div>` de `.empty` par :

```html
        <div>
          @if (didNotStart()) {
            <div class="big sm">It didn’t start.</div>
            <div class="sub">
              Nothing was left running, and nothing is costing anything. {{ advice() }}
            </div>
          } @else if (awaits()) {
            <div class="big">Nothing is running.</div>
            <div class="sub">{{ copyAwaited }}, and nothing opens on an old copy. Tell whoever runs this.</div>
          } @else {
            <div class="big">Nothing is running.</div>
            <div class="sub">It closed itself, which is the whole idea.</div>
          }
        </div>
```

avec `readonly copyAwaited = COPY_AWAITED;` dans la classe. Entourer la `.plate` de `@if (!awaits()) { … }`.

4. Remplacer le contenu de `.foot` par :

```html
      <div class="money"></div>
      <div class="btncol">
        @if (awaits()) {
          <div class="call" data-field="copy-awaited">
            <span class="k">Waiting for</span>
            <span class="at">A new copy of the game</span>
            <span class="said">Opening comes back here as soon as it’s in place.</span>
          </div>
        } @else {
          <div class="acts">
            <button type="button" class="btn xl" data-action="open" (click)="opened.emit()">
              {{ didNotStart() ? 'Try again' : 'Open the service' }}
            </button>
          </div>
          <div class="hint">We’ll tell you the exact time once it’s on its way.</div>
        }
      </div>
```

5. Mettre à jour le commentaire de la classe : il dit déjà que l'écran est celui d'un monde hors service avec un avertissement ; y ajouter une phrase : « While the game waits for its copy to be replaced, the foot says what it waits for in place of the button. »

Dans `apps/functions/src/screen.ts` :

1. Ajouter `'copy-awaited'` à `SCREENS`, après `'preflight-unreadable'`, et le `case` dans `screenFixture` :

```ts
    // Out of service and nothing abandoned: the game waits for its copy all
    // the same, from what `screen()` writes on `gameCopies/{game}`.
    case 'copy-awaited':
      return blank;
```

2. Ajouter `gameCopyDocPath` à l'import depuis `@beacon/session-record`, puis, dans `screen()`, après l'écriture de `completedSetups` :

```ts
  // Written whole on every screen too: only 'copy-awaited' records a reading
  // newer than the deposit and at another version. 'preflight-behind' waits as
  // well, from its abandon alone.
  const copy = db.doc(gameCopyDocPath(DEV_WORLD_GAME));
  if (name === 'copy-awaited') {
    await copy.set({
      depositedVersion: '25700000',
      depositedAt: new Date(now.getTime() - 3 * 86_400_000),
      publishedVersion: '25746735',
      publishedReadAt: new Date(now.getTime() - 20 * 60_000),
    });
  } else {
    await copy.delete();
  }
```

Dans `mise.toml`, `[tasks.screen]`, ajouter `copy-awaited` à la liste de `usage`, après `preflight-unreadable`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx run web:test`, puis `npx nx run @beacon/functions:test`
Expected: PASS, les tests existants de l'écran hors service compris.

- [ ] **Step 5: Look at it**

`mise run dev`, se connecter en `dev-player`, puis `mise run screen copy-awaited` et `mise run screen preflight-behind`, et comparer l'écran à `.impeccable/mocks/preflight/phone.html`, section 5, cadres W2, en 390 px et en 1440 px. `mise run screen idle` rend le bouton sans recharger. Lancer une fois la détection d'`impeccable` sur `apps/web/src/app/session/out-of-service.component.ts`, et corriger ce qu'elle relève.

- [ ] **Step 6: Lint, typecheck, commit**

```bash
npx nx run-many -t lint typecheck -p web @beacon/functions
git add apps/web/src apps/functions/src/screen.ts apps/functions/src/screen.spec.ts mise.toml .impeccable/mocks/preflight
bash ~/.config/github-app/as-agent.sh git commit -m "feat(web): dit à la place du bouton que le jeu attend que sa copie soit remplacée

Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

## Before the merge

Cette story change `libs/session`, que l'empreinte de l'image du compagnon couvre. `companion:test` reste rouge sur `names an image built from the sources in the tree` tant que l'image n'est pas republiée.

Une fois la revue accordée et les `fixup!` écrasés :

1. Le commanditaire pose le tag `companion-v0.17` sur la tête de la branche et le pousse. Le workflow `companion` publie l'image.
2. `npx nx run companion:pin -- 0.17` récrit `deploy/cloud-init/src/lib/companion-image.ts`.
3. Le changement est commité sous `build(cloud-init): épingle le compagnon 0.17` et poussé.
4. `npx nx run companion:test` passe.

Un commit qui touche `libs/session`, `libs/agent-protocol`, `libs/scaleway-storage`, `deploy/companion/src` ou `package-lock.json` après le tag demande un nouveau tag.

La première lecture de Steam par `refreshPublishedVersions` a lieu dans l'heure qui suit la fusion. Si elle échoue, le journal de la plateforme porte sa cause sous la source `publishedRefresh.read`, et l'écran garde le bouton.

## Rulings log

## Observed drift
