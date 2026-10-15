# La copie en retard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La vérification préalable d'une session dont le jeu passe par une copie lit la version que l'éditeur publie et échoue quand la copie est en retard ou que cette version est illisible ; la mise en place est alors abandonnée sans qu'aucun serveur soit demandé, la marque d'abandon porte la cause, et l'écran hors service la dit.

**Architecture:** `libs/session` gagne la copie du jeu, la version publiée, la décision de la vérification préalable et le port `GamePublisher` ; la marque d'une mise en place abandonnée porte désormais une cause, que `StateCorrection`, `server/current` et `shownSetup` transportent. `libs/session-record` gagne `gameCopyStore`, la face de `gameCopies/{game}` que les Functions lisent et où elles enregistrent la version lue. Une nouvelle bibliothèque `libs/steam-publications` implémente le port avec `steam-user`, chargé à la première lecture. La Function `provision` vérifie entre la revendication et la première étape gardée : elle lit puis enregistre la version publiée, lit la copie, décide, et abandonne par une écriture conditionnelle à une session toujours en préparation. Une cible `bundle-check` charge le bundle construit hors du dépôt, sur ses seules dépendances déclarées. L'écran hors service suit la décision C1 du tour `.impeccable/mocks/preflight/`.

Deux écarts au `Technical design` du lot, à consigner en `Technical design ruling:` à l'étape des records : la Function ne lit la copie que lorsque la version publiée est lisible, puisque la décision ne dépend alors pas d'elle et qu'un échec de cette lecture changerait une version illisible en refus ordinaire ; le bundle se charge dans un Node isolé hors du dépôt et non dans l'émulateur, qui résout les modules en remontant jusqu'aux `node_modules` du dépôt et chargerait `steam-user` même si le bundle ne le déclarait pas.

**Tech Stack:** TypeScript, Vitest, Nx, Angular, `firebase-admin`, `steam-user`, émulateur Firestore.

**Spec:** docs/specs/session.md
**Batch:** docs/batches/04-copie-du-jeu-en-retard/README.md
**Sections:** Opening a session
**Blocks:** D3

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

`docs/specs/`, `firestore.rules`, `tools/`, `deploy/companion`, `deploy/cloud-init` et `probe/` ne changent pas.

Aucun client ne lit ni n'écrit `gameCopies/{game}` dans cette story : aucune règle ne s'y ajoute.

Les Functions n'écrivent dans `gameCopies/{game}` que `publishedVersion` et `publishedReadAt`, par fusion. `publishedReadAt` est l'heure du serveur Firestore.

`libs/steam-publications` ne dépend que de `@beacon/session` et de `steam-user`. Aucun mot de Steam — application, build, branche — n'entre dans `libs/session`, `libs/session-record` ni `apps/web`.

Aucun test n'atteint Steam. Aucune commande n'atteint la production : ni `firebase deploy`, ni appel à un fournisseur, ni écriture dans le Firestore de production, ni tag git. Les tests tournent contre l'émulateur.

À partir de la tâche 1, `companion:test` échoue sur le seul test `names an image built from the sources in the tree` de `deploy/companion/src/pin/catalogue-pin.spec.ts`, parce que l'empreinte du compagnon couvre `libs/session` et `package-lock.json`. Cet échec est attendu jusqu'à l'épinglage décrit sous `Before the merge`, et aucune tâche ne le corrige.

### Ce que la story ne livre pas

L'annonce avant l'ouverture, l'attente d'un remplacement, le rafraîchissement planifié de la version lue et la règle qui laisse un utilisateur lire `gameCopies/{game}` appartiennent à la story qui transcrit D4. Le bouton `Try again` reste donc après un abandon pour une copie en retard.

La récupération du jeu par l'outil de dépôt appartient à sa propre story.

### Les commandes

Les tests se lancent par Nx, un projet à la fois :

```bash
npx nx run @beacon/session:test
npx nx run @beacon/session-record:test
npx nx run steam-publications:test
npx nx run @beacon/functions:test
npx nx run @beacon/rules:test
npx nx run web:test
```

`@beacon/session-record:test`, `@beacon/functions:test` et `@beacon/rules:test` démarrent l'émulateur eux-mêmes.

Chaque tâche finit par `npx nx run-many -t lint typecheck -p <projets touchés>`. Après tout changement des dépendances d'un `package.json`, `npx nx sync` remet à jour les références TypeScript avant le typecheck. Prettier ne tourne pas sur les sources.

### Les commits

Un commit par tâche, au sujet que la tâche donne, en Conventional Commits, en français. Chaque commit se termine par la ligne `Co-Authored-By: Charlouze <me@charlouze.com>` et ne porte aucune autre ligne d'attribution. Les commits passent par `bash ~/.config/github-app/as-agent.sh git commit …`.

## Review Focus

- Steam répond après le délai : la réponse tardive ne change pas l'issue déjà rendue, et une erreur tardive ne fait pas tomber l'instance. Épinglé en tâche 4.
- `gameCopies/{game}` n'existe pas encore, ou porte une version déposée illisible : la copie est en retard, jamais un refus ordinaire. Épinglé en tâches 3 et 5.
- Une marque d'abandon écrite avant cette story, sans cause, ou avec une cause inconnue : elle se lit comme une marque sans cause. Épinglé en tâche 2.
- Une copie en avance sur l'éditeur, après un retour en arrière de sa publication : elle est en retard. Épinglé en tâche 1.
- Un monde dont le jeu ne passe pas par une copie, et une seconde livraison du même déclencheur : aucune lecture chez l'éditeur. Épinglé en tâche 5.

---

### Task 1: La copie du jeu et la vérification préalable, dans le domaine

**Files:**
- Create: `libs/session/src/lib/preflight.ts`
- Create: `libs/session/src/lib/preflight.spec.ts`
- Modify: `libs/session/src/lib/ports.ts`
- Modify: `libs/session/src/index.ts`

**Interfaces:**
- Consumes: `GameVersion`, `gameVersionFrom` (`libs/session/src/lib/game-version.ts`), `Game` (`game.ts`).
- Produces, exportés par `@beacon/session` :
  - `PREFLIGHT_FAILURES = ['copy-behind', 'version-unreadable'] as const`, `type PreflightFailure`, `isPreflightFailure(value: unknown): value is PreflightFailure`
  - `interface GameCopy { readonly version: GameVersion; readonly depositedAt: Date }`
  - `type PublishedVersion = { readonly readable: true; readonly version: GameVersion } | { readonly readable: false; readonly cause: string }`
  - `copyIsBehind(copy: GameCopy | null, published: GameVersion): boolean`
  - `type PreflightFacts = { readonly throughCopy: false } | { readonly throughCopy: true; readonly published: PublishedVersion; readonly copy: GameCopy | null }`
  - `type PreflightOutcome = { readonly passed: true } | { readonly passed: false; readonly failure: PreflightFailure }`
  - `preflightOutcome(facts: PreflightFacts): PreflightOutcome`
  - `interface GamePublisher { publishedVersion(game: Game): Promise<PublishedVersion> }`

- [ ] **Step 1: Write the failing test**

`libs/session/src/lib/preflight.spec.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { gameVersionFrom, type GameVersion } from './game-version.js';
import {
  copyIsBehind,
  isPreflightFailure,
  preflightOutcome,
  type GameCopy,
  type PublishedVersion,
} from './preflight.js';

const version = (digits: string): GameVersion => {
  const built = gameVersionFrom(digits);
  if (built === null) throw new Error(`not a version: ${digits}`);
  return built;
};

const DEPOSITED_AT = new Date('2026-10-14T18:00:00Z');
const copyAt = (digits: string): GameCopy => ({ version: version(digits), depositedAt: DEPOSITED_AT });
const readable = (digits: string): PublishedVersion => ({ readable: true, version: version(digits) });

describe('copyIsBehind', () => {
  it('is not behind a version it is at', () => {
    expect(copyIsBehind(copyAt('25746735'), version('25746735'))).toBe(false);
  });

  it('is behind a version it is not at', () => {
    expect(copyIsBehind(copyAt('25746735'), version('25800001'))).toBe(true);
  });

  // Versions are compared for equality only: a publisher that rolls back
  // leaves a copy ahead of it, and that copy is behind like any other.
  it('is behind when it is ahead of the publisher', () => {
    expect(copyIsBehind(copyAt('25800001'), version('25746735'))).toBe(true);
  });

  it('is behind when no copy is recorded', () => {
    expect(copyIsBehind(null, version('25746735'))).toBe(true);
  });
});

describe('preflightOutcome', () => {
  it('passes for a game that goes through no copy', () => {
    expect(preflightOutcome({ throughCopy: false })).toEqual({ passed: true });
  });

  it('fails for an unreadable version when the publisher returned nothing', () => {
    expect(
      preflightOutcome({
        throughCopy: true,
        published: { readable: false, cause: 'no answer within 10000 ms' },
        copy: copyAt('25746735'),
      }),
    ).toEqual({ passed: false, failure: 'version-unreadable' });
  });

  it('fails for a copy behind the published version', () => {
    expect(
      preflightOutcome({ throughCopy: true, published: readable('25800001'), copy: copyAt('25746735') }),
    ).toEqual({ passed: false, failure: 'copy-behind' });
  });

  it('fails for a copy behind when no copy is recorded', () => {
    expect(preflightOutcome({ throughCopy: true, published: readable('25746735'), copy: null })).toEqual({
      passed: false,
      failure: 'copy-behind',
    });
  });

  it('passes for a copy at the published version', () => {
    expect(
      preflightOutcome({ throughCopy: true, published: readable('25746735'), copy: copyAt('25746735') }),
    ).toEqual({ passed: true });
  });
});

describe('isPreflightFailure', () => {
  it('knows the two failures, and nothing else', () => {
    expect(isPreflightFailure('copy-behind')).toBe(true);
    expect(isPreflightFailure('version-unreadable')).toBe(true);
    expect(isPreflightFailure('disk-full')).toBe(false);
    expect(isPreflightFailure(null)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx run @beacon/session:test`
Expected: FAIL, `preflight.js` introuvable.

- [ ] **Step 3: Write minimal implementation**

`libs/session/src/lib/preflight.ts` :

```ts
import type { GameVersion } from './game-version.js';

/** Why a preflight check failed. A closed list: the screen says each one in its own words. */
export const PREFLIGHT_FAILURES = ['copy-behind', 'version-unreadable'] as const;

export type PreflightFailure = (typeof PREFLIGHT_FAILURES)[number];

export function isPreflightFailure(value: unknown): value is PreflightFailure {
  return PREFLIGHT_FAILURES.includes(value as PreflightFailure);
}

/** The files of a game Beacon keeps for its servers: the version its last deposit put in place, and when. */
export interface GameCopy {
  readonly version: GameVersion;
  readonly depositedAt: Date;
}

/**
 * What asking a game's publisher returns. The cause of an unreadable version
 * is for the platform journal only.
 */
export type PublishedVersion =
  | { readonly readable: true; readonly version: GameVersion }
  | { readonly readable: false; readonly cause: string };

/** Missing, or at any other version than the published one: versions are only compared for equality. */
export function copyIsBehind(copy: GameCopy | null, published: GameVersion): boolean {
  return copy === null || copy.version !== published;
}

/** What the preflight check of a session knows of its game. A game that goes through no copy brings nothing. */
export type PreflightFacts =
  | { readonly throughCopy: false }
  | {
      readonly throughCopy: true;
      readonly published: PublishedVersion;
      readonly copy: GameCopy | null;
    };

export type PreflightOutcome =
  | { readonly passed: true }
  | { readonly passed: false; readonly failure: PreflightFailure };

export function preflightOutcome(facts: PreflightFacts): PreflightOutcome {
  if (!facts.throughCopy) return { passed: true };
  if (!facts.published.readable) return { passed: false, failure: 'version-unreadable' };
  if (copyIsBehind(facts.copy, facts.published.version)) return { passed: false, failure: 'copy-behind' };
  return { passed: true };
}
```

À la fin de `libs/session/src/lib/ports.ts`, après avoir ajouté `import type { Game } from './game.js';` et `import type { PublishedVersion } from './preflight.js';` aux imports :

```ts
/**
 * Asks the publisher of a game which version it publishes. It speaks of a game
 * and a version, never of the platform that answers.
 *
 * Never rejects: a version it cannot read comes back unreadable, with a cause
 * that only the platform journal reads.
 */
export interface GamePublisher {
  publishedVersion(game: Game): Promise<PublishedVersion>;
}
```

Dans `libs/session/src/index.ts`, ajouter `export * from './lib/preflight.js';` à sa place alphabétique, après `ports.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx run @beacon/session:test`
Expected: PASS.

- [ ] **Step 5: Lint, typecheck, commit**

```bash
npx nx run-many -t lint typecheck -p @beacon/session
git add libs/session/src
bash ~/.config/github-app/as-agent.sh git commit -m "feat(session): décide la vérification préalable d'après la copie du jeu et la version publiée

Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 2: La marque d'abandon porte la cause de l'échec

**Files:**
- Modify: `libs/session/src/lib/setup.ts`
- Modify: `libs/session/src/lib/session-aggregate.ts`
- Create: `libs/session/src/lib/abandoned-at-preflight.ts`
- Create: `libs/session/src/lib/abandoned-at-preflight.spec.ts`
- Modify: `libs/session/src/lib/watchdog/reconcile.ts`
- Modify: `libs/session/src/index.ts`
- Modify: `libs/session-record/src/lib/fields.ts`
- Modify: `libs/session-record/src/lib/server-state.ts`
- Modify: `apps/functions/src/abandon-setup.ts`
- Test: `libs/session/src/lib/setup.spec.ts`, `libs/session/src/lib/session-aggregate.spec.ts`, `libs/session/src/lib/watchdog/reconcile.spec.ts`, `libs/session-record/src/lib/fields.spec.ts`, `libs/session-record/src/lib/server-state.spec.ts`, `apps/functions/src/agent-report.spec.ts`, `apps/functions/src/provisioning.spec.ts`, et chaque spec que le typecheck désigne parce qu'il construit un `ShownPreflight`

**Interfaces:**
- Consumes: `PreflightFailure`, `isPreflightFailure` (tâche 1).
- Produces :
  - `AbandonedSetup` devient `{ readonly sessionId: SessionId; readonly at: Date; readonly cause: PreflightFailure | null }`
  - `interface SetupAbandonment { readonly sessionId: SessionId; readonly cause: PreflightFailure | null }`
  - `StateCorrection.abandonedSetup: SetupAbandonment | null`
  - `ShownPreflight` gagne `readonly failure: PreflightFailure | null`
  - `Session.prototype.failPreflight(failure: PreflightFailure): SessionDecision`, réservé à une session `PROVISIONING`
  - `abandonedAtPreflight(session: Session, failure: PreflightFailure): StateCorrection`
  - sur `server/current`, le champ `abandonedSetup` vaut `{ sessionId, at, cause }`, `cause` à `null` hors d'un échec de la vérification préalable

- [ ] **Step 1: Write the failing tests**

Dans `libs/session/src/lib/setup.spec.ts`, `markOf` prend une cause :

```ts
  const markOf = (sessionId: string, cause: PreflightFailure | null = null): AbandonedSetup => ({
    sessionId,
    at: ABANDONED,
    cause,
  });
```

avec `import type { PreflightFailure } from './preflight.js';`. Chaque objet `{ stage: 'preflight', … }` attendu par les tests existants gagne `failure: null`. Puis, dans `describe('shownSetup')` :

```ts
  it('shows why the preflight check failed, when the mark of the abandon says it', () => {
    expect(shownSetup(OUT_OF_SERVICE, markOf('s1', 'copy-behind'), null)).toEqual({
      stage: 'preflight',
      since: OPENED,
      abandonedAt: ABANDONED,
      failure: 'copy-behind',
    });
    expect(shownSetup(OUT_OF_SERVICE, markOf('s1', 'version-unreadable'), null)).toEqual({
      stage: 'preflight',
      since: OPENED,
      abandonedAt: ABANDONED,
      failure: 'version-unreadable',
    });
  });

  it('shows no failure for a preflight check abandoned without a cause, nor for one under way', () => {
    expect(shownSetup(OUT_OF_SERVICE, markOf('s1'), null)).toMatchObject({ failure: null });
    expect(shownSetup(PREPARING, markOf('s0', 'copy-behind'), null)).toMatchObject({ failure: null });
  });
```

Dans `libs/session/src/lib/session-aggregate.spec.ts`, à côté des tests de `endWithoutServer`, avec une session `PROVISIONING` construite comme les autres sessions du fichier :

```ts
describe('failPreflight', () => {
  it('puts the session out of service and files a failed provisioning, for each failure', () => {
    expect(provisioning().failPreflight('copy-behind')).toEqual({
      session: Session.idle(),
      events: [
        {
          type: 'ProvisioningFailed',
          sessionId: 's1',
          detail: 'preflight check failed: the copy of the game is behind what its publisher publishes',
        },
      ],
    });
    expect(provisioning().failPreflight('version-unreadable').events).toEqual([
      {
        type: 'ProvisioningFailed',
        sessionId: 's1',
        detail: 'preflight check failed: the version its publisher publishes could not be read',
      },
    ]);
  });

  it('refuses a session that is not preparing', () => {
    expect(() => running().failPreflight('copy-behind')).toThrow();
  });
});
```

`provisioning()` et `running()` : réutiliser les fabriques du fichier si elles existent, sinon les écrire sur le modèle de `stopping()` de `ended-without-server.spec.ts`, avec `state: 'PROVISIONING'` et `state: 'RUNNING'`, `sessionId: 's1'`.

`libs/session/src/lib/abandoned-at-preflight.spec.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { abandonedAtPreflight } from './abandoned-at-preflight.js';
import { Deadline } from './deadline.js';
import { Session } from './session-aggregate.js';

const provisioning = () =>
  Session.from({
    state: 'PROVISIONING',
    sessionId: 's1',
    worldId: 'les-copains',
    game: 'sunkenland',
    startedBy: 'u1',
    startedAt: new Date('2026-10-15T20:00:00Z'),
    deadline: Deadline.at(new Date('2026-10-16T00:00:00Z')),
    instanceSize: null,
    hasJoinInfo: false,
  });

describe('abandonedAtPreflight', () => {
  it('writes the session out of service with the mark and its cause, empties what the claim set, and files the failure', () => {
    expect(abandonedAtPreflight(provisioning(), 'copy-behind')).toEqual({
      state: 'IDLE',
      lastError: null,
      clearFacts: true,
      clearLastError: false,
      closeIntents: [],
      events: [
        {
          type: 'ProvisioningFailed',
          sessionId: 's1',
          detail: 'preflight check failed: the copy of the game is behind what its publisher publishes',
        },
      ],
      deadline: null,
      abandonedSetup: { sessionId: 's1', cause: 'copy-behind' },
    });
  });
});
```

Dans `libs/session-record/src/lib/fields.spec.ts`, `describe('abandonedSetupFrom')` : le premier test attend `{ sessionId: 's1', at: AT, cause: null }`, et s'ajoutent :

```ts
  it('reads why the preflight check failed, when the mark says it', () => {
    expect(
      abandonedSetupFrom({ abandonedSetup: { sessionId: 's1', at: AT, cause: 'version-unreadable' } }),
    ).toEqual({ sessionId: 's1', at: AT, cause: 'version-unreadable' });
  });

  // A mark written before causes existed, or by a version that knows one more:
  // still a mark, without a cause.
  it('reads a mark with no cause, or a cause it does not know, as a mark without a cause', () => {
    expect(abandonedSetupFrom({ abandonedSetup: { sessionId: 's1', at: AT } })).toEqual({
      sessionId: 's1',
      at: AT,
      cause: null,
    });
    expect(
      abandonedSetupFrom({ abandonedSetup: { sessionId: 's1', at: AT, cause: 'disk-full' } }),
    ).toEqual({ sessionId: 's1', at: AT, cause: null });
  });
```

Dans `libs/session-record/src/lib/server-state.spec.ts`, le test qui applique `abandonedSetup: 's1'` (vers la ligne 377) applique `abandonedSetup: { sessionId: 's1', cause: null }` et attend `{ sessionId: 's1', at: NOW, cause: null }`. S'ajoute à côté :

```ts
  it('writes the cause of a preflight check that failed with the mark', async () => {
    await apply({ state: 'IDLE', clearFacts: true, abandonedSetup: { sessionId: 's1', cause: 'copy-behind' } });

    expect(abandonedSetupFrom(await current())).toEqual({ sessionId: 's1', at: NOW, cause: 'copy-behind' });
  });
```

`apply` et `current` sont les aides du fichier ; `MARK`, s'il est un `AbandonedSetup`, gagne `cause: null`.

Les assertions qui attendent `abandonedSetup: 's1'` ou `.abandonedSetup` égal à `'s1'` attendent `{ sessionId: 's1', cause: null }` : `libs/session/src/lib/watchdog/reconcile.spec.ts` (lignes 134 à 160, `toBe('s1')` devient `toEqual({ sessionId: 's1', cause: null })`), `apps/functions/src/agent-report.spec.ts` (lignes 955, 982, 1100) et `apps/functions/src/provisioning.spec.ts` (lignes 340 et 354).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx run @beacon/session:test`
Expected: FAIL — `failPreflight`, `abandoned-at-preflight.js` et `failure` manquent.

- [ ] **Step 3: Write the implementation**

`libs/session/src/lib/setup.ts` :

```ts
import type { PreflightFailure } from './preflight.js';
```

```ts
/**
 * The mark an abandoned setup leaves: whose it was, the instant it was
 * abandoned, and why its preflight check failed when the setup was abandoned
 * for one of its failures.
 */
export interface AbandonedSetup {
  readonly sessionId: SessionId;
  readonly at: Date;
  readonly cause: PreflightFailure | null;
}

/** The mark as a correction asks for it: its instant is the instant the correction is written. */
export interface SetupAbandonment {
  readonly sessionId: SessionId;
  readonly cause: PreflightFailure | null;
}
```

`ShownPreflight` gagne, après `abandonedAt` :

```ts
  /** Why it failed, when the setup was abandoned for one of its failures; null otherwise. */
  readonly failure: PreflightFailure | null;
```

`shownSetup` lit la marque entière plutôt que son heure :

```ts
export function shownSetup(
  opening: LastOpening,
  abandoned: AbandonedSetup | null,
  kept: KeptSetup | null,
): ShownSetup | null {
  if (opening.sessionId === null || opening.startedAt === null) return null;

  const mark = markOf(opening, abandoned);
  const abandonedAt = mark?.at ?? null;
  if (opening.state !== 'PROVISIONING' && mark === null) return null;

  if (kept !== null && kept.sessionId === opening.sessionId) {
    return { stage: 'step', step: kept.step, order: kept.order, abandonedAt };
  }
  // No step kept for this session: it has not passed its preflight check, or
  // was abandoned before it did.
  return { stage: 'preflight', since: opening.startedAt, abandonedAt, failure: mark?.cause ?? null };
}

function markOf(opening: LastOpening, abandoned: AbandonedSetup | null): AbandonedSetup | null {
  if (opening.state === 'PROVISIONING') return null;
  return abandoned !== null && abandoned.sessionId === opening.sessionId ? abandoned : null;
}
```

`abandonedAtOf` disparaît.

`libs/session/src/lib/session-aggregate.ts`, avec `import type { PreflightFailure } from './preflight.js';` :

```ts
const PREFLIGHT_FAILED: Record<PreflightFailure, string> = {
  'copy-behind': 'preflight check failed: the copy of the game is behind what its publisher publishes',
  'version-unreadable': 'preflight check failed: the version its publisher publishes could not be read',
};
```

au niveau du module, et dans la classe, après `endWithoutServer` :

```ts
  /** Its preflight check failed: the session stops being in progress, and no server was ever asked for. */
  failPreflight(failure: PreflightFailure): SessionDecision {
    const fields = this.required();
    if (fields.state !== 'PROVISIONING') {
      throw new Error(`cannot fail the preflight check of a ${fields.state} session`);
    }
    return {
      session: Session.idle(),
      events: [{ type: 'ProvisioningFailed', sessionId: fields.sessionId, detail: PREFLIGHT_FAILED[failure] }],
    };
  }
```

`libs/session/src/lib/abandoned-at-preflight.ts` :

```ts
import type { PreflightFailure } from './preflight.js';
import type { Session } from './session-aggregate.js';
import type { StateCorrection } from './watchdog/reconcile.js';

/**
 * What `server/current` becomes when a session's preflight check fails. Nothing
 * was created, so nothing is closed and no intent is open.
 */
export function abandonedAtPreflight(session: Session, failure: PreflightFailure): StateCorrection {
  const sessionId = session.sessionId;
  if (sessionId === null) throw new Error('a session without an id has no preflight check');
  const { events } = session.failPreflight(failure);
  return {
    state: 'IDLE',
    lastError: null,
    // What the claim set goes with it, or the next opening could not claim.
    clearFacts: true,
    clearLastError: false,
    closeIntents: [],
    events,
    deadline: null,
    abandonedSetup: { sessionId, cause: failure },
  };
}
```

`libs/session/src/index.ts` : `export * from './lib/abandoned-at-preflight.js';` en tête, à sa place alphabétique.

`libs/session/src/lib/watchdog/reconcile.ts` : `StateCorrection.abandonedSetup` devient `SetupAbandonment | null` (importé de `../setup.js`), et son commentaire dit « The setup this correction abandons, and why its preflight check failed when it did, or null. » suivi des deux phrases actuelles sur `null`. Les deux affectations `abandonedSetup: abandonedBy(own.reclamation)` deviennent `abandonedSetup: abandonmentBy(own.reclamation)`, avec, à côté de `abandonedBy` :

```ts
/** The watchdog abandons a setup only when its delay runs out: never for a preflight failure. */
function abandonmentBy(reclamation: Reclamation): SetupAbandonment | null {
  const sessionId = abandonedBy(reclamation);
  return sessionId === null ? null : { sessionId, cause: null };
}
```

`libs/session-record/src/lib/fields.ts`, `abandonedSetupFrom` :

```ts
/** The mark as the domain reads it. Half a mark reads as none; a cause it does not know reads as none. */
export function abandonedSetupFrom(data: Record<string, unknown>): AbandonedSetup | null {
  const mark = data[ABANDONED_SETUP];
  if (typeof mark !== 'object' || mark === null) return null;
  const { sessionId, at, cause } = mark as Record<string, unknown>;
  const abandonedAt = toDate(at);
  if (typeof sessionId !== 'string' || abandonedAt === null) return null;
  return { sessionId, at: abandonedAt, cause: isPreflightFailure(cause) ? cause : null };
}
```

avec `isPreflightFailure` importé de `@beacon/session`.

`libs/session-record/src/lib/server-state.ts`, `correctionPatch` :

```ts
    patch[ABANDONED_SETUP] = {
      sessionId: correction.abandonedSetup.sessionId,
      at: Timestamp.fromDate(at),
      cause: correction.abandonedSetup.cause,
    };
```

`apps/functions/src/abandon-setup.ts` : les deux `abandonedSetup: sessionId` deviennent `abandonedSetup: { sessionId, cause: null }`.

Tout autre fichier que le typecheck désigne parce qu'il construit un `ShownPreflight` ou un `AbandonedSetup` (specs de `client-session`, de `format`, des composants de `apps/web`) gagne `failure: null` ou `cause: null`, et rien d'autre.

- [ ] **Step 4: Run tests to verify they pass**

Run, un par un : `npx nx run @beacon/session:test`, `npx nx run @beacon/session-record:test`, `npx nx run @beacon/functions:test`, `npx nx run @beacon/rules:test`, `npx nx run web:test`
Expected: PASS.

- [ ] **Step 5: Lint, typecheck, commit**

```bash
npx nx run-many -t lint typecheck -p @beacon/session @beacon/session-record @beacon/functions @beacon/rules web
git add libs/session/src libs/session-record/src apps/functions/src apps/web/src
bash ~/.config/github-app/as-agent.sh git commit -m "feat(session): fait porter à la marque d'abandon la cause d'une vérification préalable échouée

Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 3: Ce que les Functions lisent et écrivent de la copie du jeu

**Files:**
- Modify: `libs/session-record/src/lib/fields.ts`
- Modify: `libs/session-record/src/lib/game-copy-record.ts`
- Test: `libs/session-record/src/lib/game-copy-record.spec.ts`, `libs/session-record/src/lib/fields.spec.ts`

**Interfaces:**
- Consumes: `GameCopy`, `GameVersion`, `gameVersionFrom` (`@beacon/session`).
- Produces, exportés par `@beacon/session-record` :
  - `gameCopyFrom(data: Record<string, unknown>): GameCopy | null`
  - `interface GameCopyStore { read(game: Game): Promise<GameCopy | null>; recordPublished(game: Game, version: GameVersion): Promise<void> }`
  - `gameCopyStore(db: Firestore): GameCopyStore`
  - sur `gameCopies/{game}`, les champs `publishedVersion` et `publishedReadAt`

`GameCopyRecord`, la face de l'outil de dépôt, ne change pas : l'outil ne lit ni n'écrit ce que lisent les Functions.

- [ ] **Step 1: Write the failing tests**

Dans `libs/session-record/src/lib/fields.spec.ts` :

```ts
describe('gameCopyFrom', () => {
  const AT = new Date('2026-10-14T18:00:00Z');

  it('reads the version the last deposit put in place, and when', () => {
    expect(gameCopyFrom({ depositedVersion: '25746735', depositedAt: AT })).toEqual({
      version: '25746735',
      depositedAt: AT,
    });
  });

  it('reads no copy where no deposit is recorded', () => {
    expect(gameCopyFrom({})).toBeNull();
    expect(gameCopyFrom({ publishedVersion: '25746735', publishedReadAt: AT })).toBeNull();
  });

  // A copy whose version cannot be read is a copy nobody can vouch for: it is
  // missing, and a missing copy is behind.
  it('reads no copy from half a deposit, or from a version that is not one', () => {
    expect(gameCopyFrom({ depositedVersion: '25746735' })).toBeNull();
    expect(gameCopyFrom({ depositedAt: AT })).toBeNull();
    expect(gameCopyFrom({ depositedVersion: 'v1.2', depositedAt: AT })).toBeNull();
  });
});
```

Dans `libs/session-record/src/lib/game-copy-record.spec.ts`, avec `store = gameCopyStore(db)` créé dans le `beforeAll` à côté de `record` :

```ts
describe('gameCopyStore', () => {
  it('reads no copy when the document does not exist', async () => {
    expect(await store.read('sunkenland')).toBeNull();
  });

  it('reads the copy the tool recorded', async () => {
    await record.recordDeposit('sunkenland', version('25746735'));

    expect(await store.read('sunkenland')).toEqual({
      version: '25746735',
      depositedAt: expect.any(Date),
    });
  });

  it('records the published version, at the time of the Firestore server', async () => {
    const before = Date.now();
    await store.recordPublished('sunkenland', version('25800001'));

    const data = await stored();
    expect(data?.['publishedVersion']).toBe('25800001');
    expect(data?.['publishedReadAt']).toBeInstanceOf(Timestamp);
    expect((data?.['publishedReadAt'] as Timestamp).toMillis()).toBeGreaterThanOrEqual(before - 5_000);
  });

  it('leaves the deposit as it is, and the tool leaves the published version', async () => {
    await record.recordDeposit('sunkenland', version('25746735'));
    await store.recordPublished('sunkenland', version('25800001'));
    await record.recordDeposit('sunkenland', version('25800001'));

    const data = await stored();
    expect(data?.['depositedVersion']).toBe('25800001');
    expect(data?.['publishedVersion']).toBe('25800001');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx run @beacon/session-record:test`
Expected: FAIL — `gameCopyFrom` et `gameCopyStore` n'existent pas.

- [ ] **Step 3: Write the implementation**

`libs/session-record/src/lib/fields.ts`, après `gameCopyDocPath`, avec `gameVersionFrom` et `type GameCopy` importés de `@beacon/session` :

```ts
/** The copy a deposit recorded on `gameCopies/{game}`. Half a deposit, or a version that is not one, reads as none. */
export function gameCopyFrom(data: Record<string, unknown>): GameCopy | null {
  const version = gameVersionFrom(data['depositedVersion']);
  const depositedAt = toDate(data['depositedAt']);
  if (version === null || depositedAt === null) return null;
  return { version, depositedAt };
}
```

`libs/session-record/src/lib/game-copy-record.ts`, à la suite de `gameCopyRecord` :

```ts
/** The face of `gameCopies/{game}` the Functions use. */
export interface GameCopyStore {
  /** The copy the last recorded deposit put in place, or null when none is. Rejects when the document cannot be read. */
  read(game: Game): Promise<GameCopy | null>;
  /**
   * Records the version read from the publisher, at the time of the Firestore
   * server. Leaves every other field of the document as it is: the deposit is
   * written by the tool.
   */
  recordPublished(game: Game, version: GameVersion): Promise<void>;
}

export function gameCopyStore(db: Firestore): GameCopyStore {
  return {
    async read(game): Promise<GameCopy | null> {
      const snapshot = await db.doc(gameCopyDocPath(game)).get();
      return gameCopyFrom(snapshot.data() ?? {});
    },

    async recordPublished(game, version): Promise<void> {
      await db
        .doc(gameCopyDocPath(game))
        .set({ publishedVersion: version, publishedReadAt: FieldValue.serverTimestamp() }, { merge: true });
    },
  };
}
```

avec `type GameCopy` ajouté à l'import de `@beacon/session` et `gameCopyFrom` à celui de `./fields.js`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx run @beacon/session-record:test`
Expected: PASS.

- [ ] **Step 5: Lint, typecheck, commit**

```bash
npx nx run-many -t lint typecheck -p @beacon/session-record
git add libs/session-record/src
bash ~/.config/github-app/as-agent.sh git commit -m "feat(session-record): lit la copie du jeu et enregistre la version lue chez l'éditeur

Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 4: La lecture de la version publiée chez Steam

**Files:**
- Create (par `nx g`): `libs/steam-publications/`
- Create: `libs/steam-publications/src/lib/steam-publisher.ts`
- Create: `libs/steam-publications/src/lib/steam-publisher.spec.ts`
- Create, seulement si `steam-user` ne porte pas ses propres types: `libs/steam-publications/src/lib/steam-user.d.ts`
- Create: `libs/steam-publications/README.md`
- Modify: `libs/steam-publications/package.json`, `libs/steam-publications/src/index.ts`, `package-lock.json`

**Interfaces:**
- Consumes: `GamePublisher`, `PublishedVersion`, `Game`, `gameVersionFrom` (`@beacon/session`).
- Produces, exportés par `@beacon/steam-publications` :
  - `interface SteamClient` (la part d'un client `steam-user` que l'adapter emploie)
  - `type SteamClientFactory = () => SteamClient`
  - `interface SteamPublisherOptions { readonly appOf: (game: Game) => string | null; readonly load?: () => Promise<SteamClientFactory>; readonly timeoutMs?: number }`
  - `steamPublisher(options: SteamPublisherOptions): GamePublisher`

- [ ] **Step 1: Generate the library**

Invoquer `nx-generate`, puis :

```bash
npx nx g @nx/js:library libs/steam-publications --importPath=@beacon/steam-publications --bundler=none --unitTestRunner=vitest --linter=eslint --no-interactive
```

Corriger ensuite ce que le générateur produit pour qu'il ressemble à `libs/ovh-dns` : dans `libs/steam-publications/package.json`, `"nx": { "name": "steam-publications", "tags": ["scope:adapter"] }`, et les mêmes champs `type`, `main`, `types`, `exports` ; supprimer les fichiers d'exemple que le générateur a posés sous `src/lib/`.

```bash
npm install steam-user@^5.3.0 --workspace=@beacon/steam-publications
npx nx sync
```

Si `node_modules/steam-user/package.json` n'a ni champ `types` ni `typings`, et qu'aucun `index.d.ts` n'est à sa racine, écrire `libs/steam-publications/src/lib/steam-user.d.ts` :

```ts
declare module 'steam-user' {
  const SteamUser: unknown;
  export default SteamUser;
}
```

- [ ] **Step 2: Write the failing test**

`libs/steam-publications/src/lib/steam-publisher.spec.ts` :

```ts
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';
import type { Game } from '@beacon/session';
import { steamPublisher, type SteamClient } from './steam-publisher.js';

const APP = '2667530';
const appOf = (game: Game): string | null => (game === 'sunkenland' ? APP : null);

const publicBuild = (buildid: unknown) => ({
  apps: { [APP]: { appinfo: { depots: { branches: { public: { buildid } } } } } },
});

interface Behaviour {
  /** What happens once the client is asked to log on. */
  readonly onLogOn: (client: FakeClient) => void;
  readonly productInfo?: () => Promise<unknown>;
}

class FakeClient extends EventEmitter implements SteamClient {
  readonly logOns: unknown[] = [];
  readonly asked: unknown[][] = [];
  logOffs = 0;

  constructor(private readonly behaviour: Behaviour) {
    super();
  }

  logOn(details: { anonymous: true }): void {
    this.logOns.push(details);
    this.behaviour.onLogOn(this);
  }

  logOff(): void {
    this.logOffs += 1;
  }

  getProductInfo(apps: number[], packages: number[], inclTokens: boolean): Promise<unknown> {
    this.asked.push([apps, packages, inclTokens]);
    return this.behaviour.productInfo?.() ?? Promise.reject(new Error('not asked'));
  }
}

const logsOn = (client: FakeClient) => setImmediate(() => client.emit('loggedOn'));

const publisherWith = (behaviour: Behaviour, timeoutMs = 50) => {
  const clients: FakeClient[] = [];
  const publisher = steamPublisher({
    appOf,
    timeoutMs,
    load: async () => () => {
      const client = new FakeClient(behaviour);
      clients.push(client);
      return client;
    },
  });
  return { publisher, clients };
};

describe('steamPublisher', () => {
  it('reads the build of the public branch, anonymously, then logs off', async () => {
    const { publisher, clients } = publisherWith({
      onLogOn: logsOn,
      productInfo: async () => publicBuild('25746735'),
    });

    expect(await publisher.publishedVersion('sunkenland')).toEqual({ readable: true, version: '25746735' });
    expect(clients[0].logOns).toEqual([{ anonymous: true }]);
    expect(clients[0].asked).toEqual([[[2667530], [], true]]);
    expect(clients[0].logOffs).toBe(1);
  });

  it('opens one session per read', async () => {
    const { publisher, clients } = publisherWith({
      onLogOn: logsOn,
      productInfo: async () => publicBuild('25746735'),
    });

    await publisher.publishedVersion('sunkenland');
    await publisher.publishedVersion('sunkenland');

    expect(clients).toHaveLength(2);
  });

  it('reads nothing for a game that goes through no copy', async () => {
    const load = vi.fn();
    const publisher = steamPublisher({ appOf, load });

    expect(await publisher.publishedVersion('enshrouded')).toMatchObject({ readable: false });
    expect(load).not.toHaveBeenCalled();
  });

  it('answers an unreadable version when the product info is refused', async () => {
    const { publisher, clients } = publisherWith({
      onLogOn: logsOn,
      productInfo: async () => {
        throw new Error('timed out');
      },
    });

    const answer = await publisher.publishedVersion('sunkenland');
    expect(answer).toMatchObject({ readable: false });
    expect(answer.readable === false && answer.cause).toContain('timed out');
    expect(clients[0].logOffs).toBe(1);
  });

  it('answers an unreadable version when Steam refuses the session', async () => {
    const { publisher } = publisherWith({
      onLogOn: (client) => setImmediate(() => client.emit('error', new Error('ServiceUnavailable'))),
    });

    const answer = await publisher.publishedVersion('sunkenland');
    expect(answer.readable === false && answer.cause).toContain('ServiceUnavailable');
  });

  it('answers an unreadable version when Steam does not answer within the delay', async () => {
    const { publisher, clients } = publisherWith({ onLogOn: () => undefined }, 20);

    const answer = await publisher.publishedVersion('sunkenland');
    expect(answer.readable === false && answer.cause).toContain('20 ms');
    expect(clients[0].logOffs).toBe(1);
  });

  // The listener stays until the client is gone: an error emitted after the
  // delay, with no listener, would throw out of the event loop and bring the
  // instance down.
  it('survives an error emitted after the delay, and keeps the answer it gave', async () => {
    const { publisher, clients } = publisherWith({ onLogOn: () => undefined }, 20);

    const answer = await publisher.publishedVersion('sunkenland');
    expect(() => clients[0].emit('error', new Error('LogonSessionReplaced'))).not.toThrow();
    clients[0].emit('loggedOn');
    expect(answer).toMatchObject({ readable: false });
  });

  it('answers an unreadable version for an application without a public branch', async () => {
    const { publisher } = publisherWith({
      onLogOn: logsOn,
      productInfo: async () => ({ apps: { [APP]: { appinfo: { depots: { branches: {} } } } } }),
    });

    expect(await publisher.publishedVersion('sunkenland')).toMatchObject({ readable: false });
  });

  it('answers an unreadable version for a build that is not one', async () => {
    const { publisher } = publisherWith({
      onLogOn: logsOn,
      productInfo: async () => publicBuild('latest'),
    });

    expect(await publisher.publishedVersion('sunkenland')).toMatchObject({ readable: false });
  });

  it('answers an unreadable version when the library cannot be loaded, and tries again at the next read', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('ENOENT: steam-user resources'))
      .mockResolvedValueOnce(() => new FakeClient({ onLogOn: logsOn, productInfo: async () => publicBuild('25746735') }));
    const publisher = steamPublisher({ appOf, load, timeoutMs: 50 });

    const first = await publisher.publishedVersion('sunkenland');
    expect(first.readable === false && first.cause).toContain('ENOENT');
    expect(await publisher.publishedVersion('sunkenland')).toEqual({ readable: true, version: '25746735' });
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx nx run steam-publications:test`
Expected: FAIL, `steam-publisher.js` introuvable.

- [ ] **Step 4: Write the implementation**

`libs/steam-publications/src/lib/steam-publisher.ts` :

```ts
import { gameVersionFrom, type Game, type GamePublisher, type PublishedVersion } from '@beacon/session';

/** The part of a `steam-user` client this adapter uses. Steam's model stops at this file. */
export interface SteamClient {
  on(event: 'loggedOn', listener: () => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
  logOn(details: { anonymous: true }): void;
  logOff(): void;
  getProductInfo(apps: number[], packages: number[], inclTokens: boolean): Promise<unknown>;
}

export type SteamClientFactory = () => SteamClient;

export interface SteamPublisherOptions {
  /** The Steam application a game's copy holds, or null for a game that goes through no copy. */
  readonly appOf: (game: Game) => string | null;
  /** Loads the library, at the first read. A load that fails is tried again at the next one. */
  readonly load?: () => Promise<SteamClientFactory>;
  readonly timeoutMs?: number;
}

const TIMEOUT_MS = 10_000;

export function steamPublisher(options: SteamPublisherOptions): GamePublisher {
  let factory: Promise<SteamClientFactory> | null = null;

  return {
    async publishedVersion(game): Promise<PublishedVersion> {
      const app = options.appOf(game);
      if (app === null) return unreadable(`${game} goes through no copy`);

      let create: SteamClientFactory;
      try {
        factory ??= (options.load ?? loadSteamUser)();
        create = await factory;
      } catch (error) {
        factory = null;
        return unreadable(`steam-user could not be loaded: ${String(error)}`);
      }
      return publicBuildOf(create, Number(app), options.timeoutMs ?? TIMEOUT_MS);
    },
  };
}

/**
 * Loaded at the first read and not with the bundle: `steam-user` reads a file
 * when it loads, and a failure there must leave the other Functions of the
 * bundle untouched.
 */
async function loadSteamUser(): Promise<SteamClientFactory> {
  const loaded = (await import('steam-user')) as { default?: unknown };
  const SteamUser = (loaded.default ?? loaded) as new (options: object) => SteamClient;
  return () => new SteamUser({ dataDirectory: null, autoRelogin: false });
}

/** One anonymous session per read: the build of the public branch, then log off. */
function publicBuildOf(create: SteamClientFactory, app: number, timeoutMs: number): Promise<PublishedVersion> {
  return new Promise((resolve) => {
    let client: SteamClient;
    try {
      client = create();
    } catch (error) {
      resolve(unreadable(`no Steam client: ${String(error)}`));
      return;
    }

    let settled = false;
    const settle = (answer: PublishedVersion): void => {
      if (settled) return;
      settled = true;
      clearTimeout(giveUp);
      try {
        client.logOff();
      } catch {
        // A client that cannot log off is gone already.
      }
      resolve(answer);
    };
    const giveUp = setTimeout(() => settle(unreadable(`no answer from Steam within ${timeoutMs} ms`)), timeoutMs);

    // Never removed: an error after the delay finds a listener, and settles nothing.
    client.on('error', (error) => settle(unreadable(`Steam refused: ${String(error)}`)));
    client.on('loggedOn', () => {
      client.getProductInfo([app], [], true).then(
        (info) => settle(versionIn(info, app)),
        (error: unknown) => settle(unreadable(`no product info: ${String(error)}`)),
      );
    });
    try {
      client.logOn({ anonymous: true });
    } catch (error) {
      settle(unreadable(`no Steam session: ${String(error)}`));
    }
  });
}

function versionIn(info: unknown, app: number): PublishedVersion {
  const buildid = valueAt(info, 'apps', String(app), 'appinfo', 'depots', 'branches', 'public', 'buildid');
  const version = gameVersionFrom(buildid);
  if (version === null) return unreadable(`no build on the public branch of ${app}: ${String(buildid)}`);
  return { readable: true, version };
}

function valueAt(value: unknown, ...path: string[]): unknown {
  let at = value;
  for (const key of path) {
    if (typeof at !== 'object' || at === null) return undefined;
    at = (at as Record<string, unknown>)[key];
  }
  return at;
}

function unreadable(cause: string): PublishedVersion {
  return { readable: false, cause };
}
```

`libs/steam-publications/src/index.ts` : `export * from './lib/steam-publisher.js';`

`libs/steam-publications/README.md`, en français, quelques lignes : ce que la bibliothèque implémente (le port `GamePublisher` de `libs/session`), comment elle lit (une session anonyme par lecture, le `buildid` de la branche `public`, déconnexion), le délai de dix secondes, le chargement de `steam-user` à la première lecture et pourquoi, et que la sonde `npm --prefix probe run steam:version` est le seul moyen d'atteindre Steam à la main.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx nx run steam-publications:test`
Expected: PASS.

- [ ] **Step 6: Lint, typecheck, commit**

```bash
npx nx run-many -t lint typecheck -p steam-publications
git add libs/steam-publications package.json package-lock.json tsconfig.json tsconfig.base.json
bash ~/.config/github-app/as-agent.sh git commit -m "feat(steam-publications): lit chez Steam la version qu'un éditeur publie

Co-Authored-By: Charlouze <me@charlouze.com>"
```

N'ajouter que les fichiers de configuration racine que `nx g` et `nx sync` ont réellement changés.

---

### Task 5: La Function fait échouer la vérification préalable

**Files:**
- Create: `apps/functions/src/published-version.ts`
- Create: `apps/functions/src/published-version.spec.ts`
- Modify: `apps/functions/src/provisioning.ts`
- Modify: `apps/functions/src/platform-journal.ts`
- Modify: `apps/functions/src/container.ts`
- Modify: `apps/functions/package.json`, `package-lock.json`
- Test: `apps/functions/src/provisioning.spec.ts`

**Interfaces:**
- Consumes: `GamePublisher`, `PublishedVersion`, `GameCopy`, `PreflightFailure`, `preflightOutcome`, `abandonedAtPreflight` (`@beacon/session`) ; `GameCopyStore`, `gameCopyStore`, `gameCopyRecord`, `gameCopyDocPath` (`@beacon/session-record`) ; `steamPublisher` (`@beacon/steam-publications`).
- Produces :
  - `ProvisionDeps` gagne `readonly publisher: GamePublisher` et `readonly gameCopies: GameCopyStore`
  - `FailureSource` gagne `'provisioning.preflight'` et `'provisioning.recordPublished'`
  - `readPublished(deps: { publisher: GamePublisher; gameCopies: GameCopyStore }, game: Game): Promise<PublishedRead>`, avec `interface PublishedRead { readonly published: PublishedVersion; readonly recordError: string | null }`, que le rafraîchissement de la story D4 reprendra

- [ ] **Step 1: Write the failing tests for the shared read**

`apps/functions/src/published-version.spec.ts` :

```ts
import { describe, expect, it, vi } from 'vitest';
import { gameVersionFrom, type GameVersion } from '@beacon/session';
import { readPublished } from './published-version.js';

const version = (digits: string): GameVersion => {
  const built = gameVersionFrom(digits);
  if (built === null) throw new Error(`not a version: ${digits}`);
  return built;
};

const depsAnswering = (answer: Awaited<ReturnType<typeof readPublished>>['published']) => ({
  publisher: { publishedVersion: vi.fn(async () => answer) },
  gameCopies: { read: vi.fn(async () => null), recordPublished: vi.fn(async () => undefined) },
});

describe('readPublished', () => {
  it('records what it read, and returns it', async () => {
    const deps = depsAnswering({ readable: true, version: version('25746735') });

    expect(await readPublished(deps, 'sunkenland')).toEqual({
      published: { readable: true, version: '25746735' },
      recordError: null,
    });
    expect(deps.gameCopies.recordPublished).toHaveBeenCalledWith('sunkenland', '25746735');
  });

  it('records nothing when the version is unreadable', async () => {
    const deps = depsAnswering({ readable: false, cause: 'no answer' });

    expect(await readPublished(deps, 'sunkenland')).toEqual({
      published: { readable: false, cause: 'no answer' },
      recordError: null,
    });
    expect(deps.gameCopies.recordPublished).not.toHaveBeenCalled();
  });

  it('returns what it read when recording it fails, with why', async () => {
    const deps = depsAnswering({ readable: true, version: version('25746735') });
    deps.gameCopies.recordPublished.mockRejectedValue(new Error('firestore is down'));

    expect(await readPublished(deps, 'sunkenland')).toEqual({
      published: { readable: true, version: '25746735' },
      recordError: 'Error: firestore is down',
    });
  });
});
```

- [ ] **Step 2: Write the failing tests for the Function**

Dans `apps/functions/src/provisioning.spec.ts` :

Aux imports : `gameVersionFrom`, `type GameCopy`, `type GameVersion`, `type PublishedVersion` de `@beacon/session` ; `gameCopyDocPath`, `gameCopyRecord`, `gameCopyStore` de `@beacon/session-record`.

En tête, après `WORLD_ID` :

```ts
const version = (digits: string): GameVersion => {
  const built = gameVersionFrom(digits);
  if (built === null) throw new Error(`not a version: ${digits}`);
  return built;
};
const PUBLISHED = version('25746735');
const BEHIND = version('25700000');
```

`fakeDeps` gagne deux dépendances, qui répondent par une copie à jour :

```ts
    publisher: {
      publishedVersion: vi.fn(async (): Promise<PublishedVersion> => ({ readable: true, version: PUBLISHED })),
    },
    gameCopies: {
      read: vi.fn(async (): Promise<GameCopy | null> => ({ version: PUBLISHED, depositedAt: NOW })),
      recordPublished: vi.fn(async () => undefined),
    },
```

Un nouveau `describe`, au premier niveau, après `describe('provisioning')` :

```ts
describe('the preflight check', () => {
  const failingWith = async (outcome: Partial<Pick<ProvisionDeps, 'publisher' | 'gameCopies'>>) => {
    const failing: ProvisionDeps = { ...deps, ...outcome };
    vi.mocked(failing.states.for(WORLD_ID).applyIf).mockResolvedValue(true);
    await runStateChange(failing, WORLD_ID, provisioningSunkenland());
    return failing;
  };

  const expectNothingAsked = (asked: ProvisionDeps) => {
    expect(asked.setups.for(WORLD_ID).begin).not.toHaveBeenCalled();
    expect(asked.tokens.issue).not.toHaveBeenCalled();
    expect(asked.ledger.open).not.toHaveBeenCalled();
    expect(asked.host.open).not.toHaveBeenCalled();
    expect(asked.host.close).not.toHaveBeenCalled();
  };

  it('reads nothing for a game that goes through no copy', async () => {
    await runStateChange(deps, WORLD_ID, provisioning());

    expect(deps.publisher.publishedVersion).not.toHaveBeenCalled();
    expect(deps.gameCopies.read).not.toHaveBeenCalled();
    expect(deps.host.open).toHaveBeenCalledOnce();
  });

  it('reads nothing when another delivery already claimed the session', async () => {
    vi.mocked(deps.states.for(WORLD_ID).claimProvisioning).mockResolvedValue(false);

    await runStateChange(deps, WORLD_ID, provisioningSunkenland());

    expect(deps.publisher.publishedVersion).not.toHaveBeenCalled();
  });

  it('keeps the first step and opens when the copy is at the published version, and records what it read', async () => {
    await runStateChange(deps, WORLD_ID, provisioningSunkenland());

    expect(deps.publisher.publishedVersion).toHaveBeenCalledWith('sunkenland');
    expect(deps.gameCopies.recordPublished).toHaveBeenCalledWith('sunkenland', PUBLISHED);
    expect(deps.setups.for(WORLD_ID).begin).toHaveBeenCalledOnce();
    expect(deps.host.open).toHaveBeenCalledOnce();
  });

  it('abandons with the cause, and asks nothing of anyone, when the copy is behind', async () => {
    const failing = await failingWith({
      gameCopies: { ...deps.gameCopies, read: vi.fn(async () => ({ version: BEHIND, depositedAt: NOW })) },
    });

    expect(failing.states.for(WORLD_ID).applyIf).toHaveBeenCalledWith(
      { sessionId: 's1', state: 'PROVISIONING' },
      expect.objectContaining({ state: 'IDLE', abandonedSetup: { sessionId: 's1', cause: 'copy-behind' } }),
      NOW,
    );
    expectNothingAsked(failing);
  });

  it('abandons for a copy behind when no copy is recorded', async () => {
    const failing = await failingWith({
      gameCopies: { ...deps.gameCopies, read: vi.fn(async () => null) },
    });

    expect(failing.states.for(WORLD_ID).applyIf).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ abandonedSetup: { sessionId: 's1', cause: 'copy-behind' } }),
      NOW,
    );
    expectNothingAsked(failing);
  });

  it('abandons for an unreadable version, journals why, and reads no copy', async () => {
    const failing = await failingWith({
      publisher: {
        publishedVersion: vi.fn(async (): Promise<PublishedVersion> => ({
          readable: false,
          cause: 'no answer from Steam within 10000 ms',
        })),
      },
    });

    expect(failing.states.for(WORLD_ID).applyIf).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ abandonedSetup: { sessionId: 's1', cause: 'version-unreadable' } }),
      NOW,
    );
    expect(failing.journal.failure).toHaveBeenCalledWith({
      source: 'provisioning.preflight',
      sessionId: 's1',
      error: 'no answer from Steam within 10000 ms',
    });
    expect(failing.gameCopies.read).not.toHaveBeenCalled();
    expect(failing.gameCopies.recordPublished).not.toHaveBeenCalled();
    expectNothingAsked(failing);
  });

  it('lets the check decide when recording what it read fails, and journals why', async () => {
    vi.mocked(deps.gameCopies.recordPublished).mockRejectedValue(new Error('firestore is down'));

    await runStateChange(deps, WORLD_ID, provisioningSunkenland());

    expect(deps.journal.failure).toHaveBeenCalledWith({
      source: 'provisioning.recordPublished',
      sessionId: 's1',
      error: 'Error: firestore is down',
    });
    expect(deps.host.open).toHaveBeenCalledOnce();
  });

  it('treats a copy that cannot be read as an ordinary refusal', async () => {
    vi.mocked(deps.gameCopies.read).mockRejectedValue(new Error('firestore is down'));

    await runStateChange(deps, WORLD_ID, provisioningSunkenland());

    expect(deps.states.for(WORLD_ID).apply).toHaveBeenCalledWith(
      expect.objectContaining({
        state: 'IDLE',
        lastError: 'Error: firestore is down',
        abandonedSetup: { sessionId: 's1', cause: null },
      }),
      NOW,
    );
    expect(deps.host.open).not.toHaveBeenCalled();
    expect(deps.setups.for(WORLD_ID).begin).not.toHaveBeenCalled();
  });
});
```

Dans `describe('against the emulator')`, un `describe` imbriqué pour un monde dont le jeu passe par une copie :

```ts
  describe('for a game that goes through a copy', () => {
    const sunkenlandWorld = (): World =>
      World.from({ worldId: WORLD_ID, game: 'sunkenland', name: 'Les copains', inviteCode: 'c', players: ['u1'] });

    const copies = () => db.doc(gameCopyDocPath('sunkenland'));

    const eventsOf = async (type: string) =>
      (
        await db
          .collection('events')
          .where('worldId', '==', WORLD_ID)
          .where('sessionId', '==', 's1')
          .where('type', '==', type)
          .get()
      ).docs;

    const closeMeanwhile = () => db.doc(serverDocPath(WORLD_ID)).update({ state: 'STOPPING' });

    const answering = (answer: PublishedVersion, before: () => Promise<unknown> = async () => undefined) => ({
      publishedVersion: vi.fn(async () => {
        await before();
        return answer;
      }),
    });

    let copy: ProvisionDeps;

    beforeEach(async () => {
      await clearWorld();
      await copies().delete();
      await adminWorldRecord(db).create(sunkenlandWorld(), NOW);
      await seedServer({
        state: 'PROVISIONING',
        sessionId: 's1',
        startedBy: 'u1',
        startedAt: NOW,
        deadline: new Date('2026-09-07T00:00:00Z'),
      });
      await gameCopyRecord(db).recordDeposit('sunkenland', PUBLISHED);
      copy = {
        ...live,
        worlds: { ...live.worlds, read: vi.fn(async () => sunkenlandWorld()) },
        gameCopies: gameCopyStore(db),
        publisher: answering({ readable: true, version: PUBLISHED }),
      };
    });

    afterEach(async () => {
      await copies().delete();
    });

    const expectAbandonedFor = async (cause: string) => {
      const server = (await db.doc(serverDocPath(WORLD_ID)).get()).data() ?? {};
      expect(server['state']).toBe('IDLE');
      expect(server['provisionClaimedAt']).toBeNull();
      expect(server['lastError'] ?? null).toBeNull();
      expect(server['abandonedSetup']).toEqual(expect.objectContaining({ sessionId: 's1', cause }));
      expect(await eventsOf('ProvisioningFailed')).toHaveLength(1);
      expect(copy.host.open).not.toHaveBeenCalled();
      expect(copy.host.close).not.toHaveBeenCalled();
      expect(copy.tokens.issue).not.toHaveBeenCalled();
      expect(copy.ledger.open).not.toHaveBeenCalled();
      expect(await setupStores(db).for(WORLD_ID).read()).toBeNull();
    };

    const expectEndedWithoutServer = async () => {
      const server = (await db.doc(serverDocPath(WORLD_ID)).get()).data() ?? {};
      expect(server['state']).toBe('IDLE');
      expect(server['abandonedSetup'] ?? null).toBeNull();
      expect(server['lastError'] ?? null).toBeNull();
      expect(await eventsOf('SessionStopped')).toHaveLength(1);
      expect(await eventsOf('ProvisioningFailed')).toHaveLength(0);
      expect(copy.host.open).not.toHaveBeenCalled();
    };

    it('opens when the copy is at the published version, and records what it read', async () => {
      await runStateChange(copy, WORLD_ID, provisioningSunkenland());

      expect(copy.host.open).toHaveBeenCalledOnce();
      const recorded = (await copies().get()).data() ?? {};
      expect(recorded['publishedVersion']).toBe(PUBLISHED);
      expect(recorded['publishedReadAt']).toBeDefined();
    });

    it('abandons for a copy behind, without the host', async () => {
      await gameCopyRecord(db).recordDeposit('sunkenland', BEHIND);

      await runStateChange(copy, WORLD_ID, provisioningSunkenland());

      await expectAbandonedFor('copy-behind');
    });

    it('abandons for a copy behind when no deposit is recorded', async () => {
      await copies().delete();

      await runStateChange(copy, WORLD_ID, provisioningSunkenland());

      await expectAbandonedFor('copy-behind');
    });

    it('abandons for an unreadable version, without the host', async () => {
      copy = { ...copy, publisher: answering({ readable: false, cause: 'no answer' }) };

      await runStateChange(copy, WORLD_ID, provisioningSunkenland());

      await expectAbandonedFor('version-unreadable');
    });

    it('lets the check decide when recording what it read fails', async () => {
      const real = gameCopyStore(db);
      copy = {
        ...copy,
        gameCopies: { read: real.read, recordPublished: vi.fn(async () => Promise.reject(new Error('down'))) },
      };

      await runStateChange(copy, WORLD_ID, provisioningSunkenland());

      expect(copy.host.open).toHaveBeenCalledOnce();
    });

    it('lets an opening claim after an abandon at the preflight check', async () => {
      await gameCopyRecord(db).recordDeposit('sunkenland', BEHIND);
      await runStateChange(copy, WORLD_ID, provisioningSunkenland());

      await db.doc(serverDocPath(WORLD_ID)).update({ state: 'PROVISIONING', sessionId: 's2' });

      expect(await worldStateStores(db).for(WORLD_ID).claimProvisioning('s2', NOW)).toBe(true);
    });

    describe('closed during its preflight check', () => {
      it('ends without a server when the check passes', async () => {
        copy = { ...copy, publisher: answering({ readable: true, version: PUBLISHED }, closeMeanwhile) };

        await runStateChange(copy, WORLD_ID, provisioningSunkenland());

        await expectEndedWithoutServer();
      });

      // The write of the abandon finds the session closing, and leaves it to end.
      it('ends without a server, and without the mark, when the check fails', async () => {
        copy = { ...copy, publisher: answering({ readable: false, cause: 'no answer' }, closeMeanwhile) };

        await runStateChange(copy, WORLD_ID, provisioningSunkenland());

        await expectEndedWithoutServer();
      });

      it('ends without a server, and without an error, when the check ends on an ordinary refusal', async () => {
        copy = {
          ...copy,
          gameCopies: {
            read: vi.fn(async () => {
              await closeMeanwhile();
              throw new Error('firestore is down');
            }),
            recordPublished: vi.fn(async () => undefined),
          },
        };

        await runStateChange(copy, WORLD_ID, provisioningSunkenland());

        await expectEndedWithoutServer();
      });
    });

    it('treats a copy that cannot be read as an ordinary refusal', async () => {
      copy = {
        ...copy,
        gameCopies: {
          read: vi.fn(async () => Promise.reject(new Error('firestore is down'))),
          recordPublished: vi.fn(async () => undefined),
        },
      };

      await runStateChange(copy, WORLD_ID, provisioningSunkenland());

      const server = (await db.doc(serverDocPath(WORLD_ID)).get()).data() ?? {};
      expect(server['state']).toBe('IDLE');
      expect(server['lastError']).toBe('Error: firestore is down');
      expect(server['abandonedSetup']).toEqual(expect.objectContaining({ sessionId: 's1', cause: null }));
      expect(copy.host.open).not.toHaveBeenCalled();
    });
  });
```

Les sessions remises hors service par `endIfClosed` portent l'événement dont `detail` vaut `closed before any server was created`.

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx nx run @beacon/functions:test`
Expected: FAIL — `published-version.js` manque, et `ProvisionDeps` n'a ni `publisher` ni `gameCopies`.

- [ ] **Step 4: Write the implementation**

`apps/functions/src/platform-journal.ts`, dans `FailureSource`, après `'provisioning.begin'` :

```ts
  | 'provisioning.preflight'
  | 'provisioning.recordPublished'
```

`apps/functions/src/published-version.ts` :

```ts
import type { Game, GamePublisher, PublishedVersion } from '@beacon/session';
import type { GameCopyStore } from '@beacon/session-record';

export interface PublishedVersionDeps {
  readonly publisher: GamePublisher;
  readonly gameCopies: GameCopyStore;
}

export interface PublishedRead {
  readonly published: PublishedVersion;
  /** Why recording what was read failed, or null. Nothing waits on the record. */
  readonly recordError: string | null;
}

/**
 * Reads the version a game's publisher publishes, then records it when it is
 * readable. Every caller that reads goes through here, and journals what
 * failed under its own source.
 */
export async function readPublished(deps: PublishedVersionDeps, game: Game): Promise<PublishedRead> {
  const published = await deps.publisher.publishedVersion(game);
  if (!published.readable) return { published, recordError: null };
  try {
    await deps.gameCopies.recordPublished(game, published.version);
    return { published, recordError: null };
  } catch (error) {
    return { published, recordError: String(error) };
  }
}
```

`apps/functions/src/provisioning.ts` :

Aux imports de `@beacon/session` : `abandonedAtPreflight`, `preflightOutcome`, `type GamePublisher`, `type PreflightOutcome` ; de `@beacon/session-record` : `type GameCopyStore` ; et `import { readPublished } from './published-version.js';`.

`ProvisionDeps` gagne :

```ts
  /** Asks a game's publisher which version it publishes (§ Opening a session). */
  readonly publisher: GamePublisher;
  /** `gameCopies/{game}`: the copy the last deposit put in place, and where the read version is recorded. */
  readonly gameCopies: GameCopyStore;
```

Dans `provision`, le bloc qui suit la revendication devient :

```ts
  // The preflight check. Nothing is created before it ends, and every write of
  // state that follows it holds only for this session, still preparing.
  let checked: PreflightOutcome;
  try {
    checked = await preflightCheck(deps, sessionId, game);
  } catch (cause) {
    // A copy that cannot be read is an ordinary refusal, not a failed check.
    await failed(deps, worldId, sessionId, now, cause);
    await endIfClosed(deps, worldId, sessionId);
    return true;
  }
  if (!checked.passed) {
    const abandoned = await state.applyIf(
      { sessionId, state: 'PROVISIONING' },
      abandonedAtPreflight(session, checked.failure),
      deps.clock.now(),
    );
    if (!abandoned) await endIfClosed(deps, worldId, sessionId);
    return true;
  }

  // The first step kept is the end of the check: no step, no token, no
  // intent, no server.
  const begun = await beginSetup(deps, worldId, sessionId, game);
```

le reste de `provision` ne change pas. Puis, à côté de `beginSetup` :

```ts
/**
 * Reads nothing for a game that goes through no copy. Otherwise reads and
 * records the published version, then the copy when that version is
 * readable: the decision does not depend on the copy otherwise. Rejects when
 * the copy cannot be read.
 */
async function preflightCheck(
  deps: ProvisionDeps,
  sessionId: SessionId,
  game: Game,
): Promise<PreflightOutcome> {
  if (catalogFor(game).copySteamApp === null) return preflightOutcome({ throughCopy: false });

  const { published, recordError } = await readPublished(deps, game);
  if (!published.readable) {
    deps.journal.failure({ source: 'provisioning.preflight', sessionId, error: published.cause });
  }
  if (recordError !== null) {
    deps.journal.failure({ source: 'provisioning.recordPublished', sessionId, error: recordError });
  }

  const copy = published.readable ? await deps.gameCopies.read(game) : null;
  return preflightOutcome({ throughCopy: true, published, copy });
}
```

Le commentaire de `beginSetup` dit désormais « Keeps the first step from the instant the preflight check passed, on the condition that the session is still preparing. », inchangé ; celui du bloc retiré (« It always passes for now ») disparaît.

`apps/functions/src/container.ts`, avec `gameCopyStore` ajouté à l'import de `@beacon/session-record` et `import { steamPublisher } from '@beacon/steam-publications';` : dans `buildProvisionDeps`, après `tokens` :

```ts
    // The catalogue knows which Steam application a game's copy holds; the
    // adapter only knows how to read one.
    publisher: steamPublisher({ appOf: (game) => catalogFor(game).copySteamApp }),
    gameCopies: gameCopyStore(db),
```

Dépendances :

```bash
npm install steam-user@^5.3.0 --workspace=@beacon/functions
npx nx sync
```

`apps/functions/package.json` déclare ainsi `steam-user` dans `dependencies`, ce que `prune-lockfile` recopie dans le `package.json` du bundle ; les bibliothèques du dépôt n'y sont pas déclarées, `nx sync` les relie. `steam-user` reste hors du bundle : esbuild y laisse tout paquet npm comme `require`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx nx run @beacon/functions:test`
Expected: PASS.

- [ ] **Step 6: Lint, typecheck, build, commit**

```bash
npx nx run-many -t lint typecheck build -p @beacon/functions
git add apps/functions/src apps/functions/package.json package-lock.json
bash ~/.config/github-app/as-agent.sh git commit -m "feat(functions): abandonne la mise en place quand la copie du jeu est en retard ou que sa version est illisible

Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 6: Le bundle des Functions charge la lecture de Steam sur ses dépendances déclarées

**Files:**
- Create: `apps/functions/bundle-check.mjs`
- Modify: `apps/functions/package.json` (cible `bundle-check`)
- Modify: `.github/workflows/pull-request.yml`, `.github/workflows/deploy.yml`

**Interfaces:**
- Consumes: `apps/functions/dist/main.js`, `package.json`, `package-lock.json`, que `prune-lockfile` écrit.
- Produces: la cible `@beacon/functions:bundle-check`.

- [ ] **Step 1: Write the check**

`apps/functions/bundle-check.mjs` :

```js
// Loads the built bundle the way the platform installs it: in a folder outside
// the repository, on the dependencies its package.json declares and nothing
// else. Inside the repository, Node would walk up to the root node_modules and
// find steam-user whether the bundle declares it or not.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dist = 'apps/functions/dist';
const FUNCTIONS = ['watchdog', 'onServerStateChange', 'agentReport'];

const fail = (message) => {
  console.error(`bundle-check: ${message}`);
  process.exit(1);
};

const declared = JSON.parse(readFileSync(join(dist, 'package.json'), 'utf8')).dependencies ?? {};
if (!('steam-user' in declared)) fail(`${dist}/package.json does not declare steam-user`);
if (!readFileSync(join(dist, 'main.js'), 'utf8').includes('require("steam-user")')) {
  fail('main.js does not load steam-user from its dependencies: it was bundled, or nothing reads Steam');
}

const isolated = mkdtempSync(join(tmpdir(), 'beacon-functions-'));
try {
  for (const file of ['main.js', 'package.json', 'package-lock.json']) cpSync(join(dist, file), join(isolated, file));
  execFileSync('npm', ['ci', '--omit=dev', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: isolated,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  const load = createRequire(join(isolated, 'main.js'));
  const loaded = load('./main.js');
  for (const name of FUNCTIONS) if (!(name in loaded)) fail(`the bundle exports no ${name}`);
  load('steam-user');
  console.log('bundle-check: the bundle loads, and steam-user loads from the dependencies it declares');
} finally {
  rmSync(isolated, { recursive: true, force: true });
}
```

- [ ] **Step 2: Declare the target**

Dans `apps/functions/package.json`, sous `nx.targets`, après `prune-lockfile` :

```json
      "bundle-check": {
        "dependsOn": [
          "prune-lockfile"
        ],
        "cache": false,
        "executor": "nx:run-commands",
        "options": {
          "command": "node apps/functions/bundle-check.mjs"
        }
      }
```

- [ ] **Step 3: Run it**

Run: `npx nx run @beacon/functions:bundle-check`
Expected: `bundle-check: the bundle loads, and steam-user loads from the dependencies it declares`.

Puis vérifier que la cible attrape ce qu'elle doit attraper : retirer temporairement `steam-user` de `dependencies` dans `apps/functions/package.json`, relancer, constater l'échec `does not declare steam-user`, et remettre la ligne. Ne rien commiter de cet essai.

- [ ] **Step 4: Run it in CI**

`.github/workflows/pull-request.yml` : `npx nx affected -t lint test build typecheck` devient `npx nx affected -t lint test build typecheck bundle-check`.

`.github/workflows/deploy.yml` : `npx nx run-many -t lint test build typecheck --all` devient `npx nx run-many -t lint test build typecheck bundle-check --all`.

- [ ] **Step 5: Commit**

```bash
git add apps/functions/bundle-check.mjs apps/functions/package.json .github/workflows/pull-request.yml .github/workflows/deploy.yml
bash ~/.config/github-app/as-agent.sh git commit -m "build(functions): vérifie que le bundle charge la lecture de Steam sur ses seules dépendances déclarées

Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 7: L'écran hors service dit pourquoi la vérification préalable a échoué

**Files:**
- Modify: `apps/web/src/app/format.ts`
- Modify: `apps/web/src/app/session/out-of-service.component.ts`
- Modify: `apps/functions/src/screen.ts`
- Modify: `mise.toml`
- Already written: `.impeccable/mocks/preflight/` (planche, section 4, et décision C1), commitée avec cette tâche
- Test: `apps/web/src/app/format.spec.ts`, `apps/web/src/app/session/out-of-service.component.spec.ts`, `apps/functions/src/screen.spec.ts`

**Interfaces:**
- Consumes: `ShownPreflight.failure`, `PreflightFailure` (tâche 2).
- Produces: `StoppedAt` au stade `preflight` porte `readonly failure: PreflightFailure | null` ; les écrans `preflight-behind` et `preflight-unreadable` de `mise run screen`.

Les mots viennent du tour `.impeccable/mocks/preflight/README.md`, section « Les causes d'un abandon », décision C1 :

| Cause | Ligne d'arrêt, après `Preflight check ·` | Texte sous `It didn’t start.`, après `Nothing was left running, and nothing is costing anything.` |
|---|---|---|
| aucune | `before the first step` | `Press again; if it stops at the same place twice, tell whoever runs this.` |
| `copy-behind` | `the game’s copy is out of date` | `The game had an update that the copy here doesn’t have yet. Tell whoever runs this: pressing again won’t help until they replace it.` |
| `version-unreadable` | `the game’s current version couldn’t be read` | `We couldn’t find out which version of the game is current, and nothing starts without knowing. Press again in a few minutes; if it stops here twice, tell whoever runs this.` |

Le titre `It didn’t start.` et le bouton `Try again` ne changent pas.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/app/format.spec.ts`, `describe('stoppedAt')` : le test du stade `preflight` passe `failure: null` et attend `{ stage: 'preflight', at: '20:39', failure: null }`. S'ajoute :

```ts
  it('says why the preflight check failed, when it is known', () => {
    expect(
      stoppedAt({ stage: 'preflight', since: OPENED, abandonedAt: STOPPED_AT, failure: 'copy-behind' }),
    ).toEqual({ stage: 'preflight', at: '20:39', failure: 'copy-behind' });
  });
```

`apps/web/src/app/session/out-of-service.component.spec.ts`, avec `type PreflightFailure` importé de `@beacon/session` :

```ts
  describe('after an abandon at the preflight check', () => {
    const abandonedAtPreflight = (failure: PreflightFailure | null): ShownSetup => ({
      stage: 'preflight',
      since: new Date('2026-09-12T20:14:00'),
      abandonedAt: new Date('2026-09-12T20:14:02'),
      failure,
    });

    it('says the copy of the game is out of date, and that pressing again will not help', async () => {
      const text: string = (await render(null, abandonedAtPreflight('copy-behind'))).nativeElement.textContent;
      expect(text).toContain('didn’t start');
      expect(text).toContain('Preflight check');
      expect(text).toContain('the game’s copy is out of date');
      expect(text).toContain('pressing again won’t help until they replace it');
      expect(text).not.toContain('before the first step');
    });

    it('says the current version could not be read, and to press again in a few minutes', async () => {
      const text: string = (await render(null, abandonedAtPreflight('version-unreadable'))).nativeElement
        .textContent;
      expect(text).toContain('the game’s current version couldn’t be read');
      expect(text).toContain('Press again in a few minutes');
    });

    it('says only where it stopped when the abandon carries no cause', async () => {
      const text: string = (await render(null, abandonedAtPreflight(null))).nativeElement.textContent;
      expect(text).toContain('before the first step');
      expect(text).toContain('at the same place twice');
    });

    it('still offers to try again, whatever the cause', async () => {
      for (const failure of ['copy-behind', 'version-unreadable', null] as const) {
        const button = (await render(null, abandonedAtPreflight(failure))).nativeElement.querySelector(
          '[data-action="open"]',
        );
        expect(button.textContent).toContain('Try again');
        expect(button.disabled).toBe(false);
      }
    });
  });
```

`apps/functions/src/screen.spec.ts` : la liste attendue de `SCREENS` gagne `'preflight-behind'` et `'preflight-unreadable'` après `'failed'`. S'ajoute dans `describe('screenFixture')` :

```ts
  it.each([
    ['preflight-behind', 'copy-behind'],
    ['preflight-unreadable', 'version-unreadable'],
  ] as const)('stages %s as a world out of service whose last setup stopped at its preflight check', (name, cause) => {
    const fixture = screenFixture(name, NOW);
    expect(fixture['state']).toBe('IDLE');
    expect(fixture['abandonedSetup']).toEqual({
      sessionId: fixture['sessionId'],
      at: expect.any(Date),
      cause,
    });
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx nx run web:test`, puis `npx nx run @beacon/functions:test`
Expected: FAIL.

- [ ] **Step 3: Write the implementation**

`apps/web/src/app/format.ts`, avec `type PreflightFailure` importé de `@beacon/session` :

```ts
export type StoppedAt =
  | { readonly stage: 'preflight'; readonly at: string; readonly failure: PreflightFailure | null }
  | {
      readonly stage: 'step';
      readonly at: string;
      readonly rank: number;
      readonly total: number;
      readonly name: string;
    };
```

et dans `stoppedAt` : `if (shown.stage === 'preflight') return { stage: 'preflight', at, failure: shown.failure };`.

`apps/web/src/app/session/out-of-service.component.ts`, avec `type PreflightFailure` importé de `@beacon/session` ; au niveau du module :

```ts
/** What the warning line says after `Preflight check`, by the cause of the abandon. */
const PREFLIGHT_STOPPED: Record<PreflightFailure, string> = {
  'copy-behind': 'the game’s copy is out of date',
  'version-unreadable': 'the game’s current version couldn’t be read',
};

/** What to do next, by the cause of the abandon: pressing again cannot replace a copy. */
const PREFLIGHT_ADVICE: Record<PreflightFailure, string> = {
  'copy-behind':
    'The game had an update that the copy here doesn’t have yet. Tell whoever runs this: pressing again won’t help until they replace it.',
  'version-unreadable':
    'We couldn’t find out which version of the game is current, and nothing starts without knowing. Press again in a few minutes; if it stops here twice, tell whoever runs this.',
};
```

dans la classe :

```ts
  /** What follows `Nothing was left running, and nothing is costing anything.` after an abandon. */
  readonly advice = computed(() => {
    const stopped = this.stopped();
    if (stopped === null) return '';
    if (stopped.stage === 'preflight' && stopped.failure !== null) return PREFLIGHT_ADVICE[stopped.failure];
    return `Press again; if it stops at the same ${stopped.stage === 'step' ? 'step' : 'place'} twice, tell whoever runs this.`;
  });

  /** Where a setup abandoned at its preflight check stopped, or why when the mark says it. */
  readonly preflightStopped = computed(() => {
    const stopped = this.stopped();
    return stopped?.stage === 'preflight' && stopped.failure !== null
      ? PREFLIGHT_STOPPED[stopped.failure]
      : 'before the first step';
  });
```

et dans le gabarit, la branche `@if (stopped(); as stopped)` du haut devient :

```html
          @if (stopped()) {
            <div class="big sm">It didn’t start.</div>
            <div class="sub">Nothing was left running, and nothing is costing anything. {{ advice() }}</div>
          }
```

et la ligne d'arrêt du stade `preflight` :

```html
              <b>Preflight check</b> · <span class="before">{{ preflightStopped() }}</span>
```

Le commentaire de la classe gagne une phrase : « After an abandon at the preflight check, the warning line says why when the mark says it, and the text above says what to do about it. »

`apps/functions/src/screen.ts` :

- `SCREENS` gagne `'preflight-behind'` et `'preflight-unreadable'` après `'failed'` ;
- `blank` gagne `abandonedSetup: null as { sessionId: string; at: Date; cause: string } | null` ;
- un cas, avant `'unreadable'` :

```ts
    // Out of service, the last setup abandoned at its preflight check two
    // seconds after its opening: no step was ever kept for it.
    case 'preflight-behind':
    case 'preflight-unreadable':
      return {
        ...opened,
        state: 'IDLE',
        startedAt: ago(62_000),
        stateSince: ago(60_000),
        abandonedSetup: {
          sessionId: opened.sessionId,
          at: ago(60_000),
          cause: screen === 'preflight-behind' ? 'copy-behind' : 'version-unreadable',
        },
      };
```

`mise.toml`, tâche `screen` : la liste entre parenthèses de `description` et celle de `usage` gagnent `preflight-behind, preflight-unreadable` après `failed`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx nx run web:test`, puis `npx nx run @beacon/functions:test`
Expected: PASS.

- [ ] **Step 5: Look at it**

`mise run dev`, se connecter en `dev-player`, puis `mise run screen preflight-behind` et `mise run screen preflight-unreadable`, et comparer l'écran à `.impeccable/mocks/preflight/phone.html`, section 4, cadres C1, en 390 px et en 1440 px. Lancer une fois la détection d'`impeccable` sur `apps/web/src/app/session/out-of-service.component.ts`, et corriger ce qu'elle relève.

- [ ] **Step 6: Lint, typecheck, commit**

```bash
npx nx run-many -t lint typecheck -p web @beacon/functions
git add apps/web/src apps/functions/src/screen.ts apps/functions/src/screen.spec.ts mise.toml .impeccable/mocks/preflight
bash ~/.config/github-app/as-agent.sh git commit -m "feat(web): dit pourquoi la vérification préalable a échoué

Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

## Before the merge

Cette story change `libs/session` et `package-lock.json`, que l'empreinte de l'image du compagnon couvre. `companion:test` reste rouge sur `names an image built from the sources in the tree` tant que l'image n'est pas republiée.

Une fois la revue accordée et les `fixup!` écrasés :

1. Le commanditaire pose le tag `companion-v0.16` sur la tête de la branche et le pousse. Le workflow `companion` publie l'image.
2. `npx nx run companion:pin -- 0.16` récrit `deploy/cloud-init/src/lib/companion-image.ts`.
3. Le changement est commité sous `build(cloud-init): épingle le compagnon 0.16` et poussé.
4. `npx nx run companion:test` passe.

Un commit qui touche `libs/session`, `libs/agent-protocol`, `libs/scaleway-storage`, `deploy/companion/src` ou `package-lock.json` après le tag demande un nouveau tag.

Avant la fusion, le commanditaire confirme que `gameCopies/sunkenland` porte en production la version que `game-depot:update` a annoncée après la fusion de la story de la version déposée. Sans elle, toute ouverture d'un monde de ce jeu est abandonnée pour une copie en retard.

La première lecture de Steam depuis une Function est la première ouverture d'un monde de ce jeu après la fusion. Si elle échoue, l'écran dit que la version n'a pas pu être lue, et le journal de la plateforme porte sa cause sous la source `provisioning.preflight`.

## Rulings log

Ruling: le test « leaves the deposit as it is, and the tool leaves the published version » vérifie la version et l'heure du dépôt juste après `recordPublished`, avant le second dépôt — tel que le plan l'écrivait, il passait même sans `{ merge: true }`, et l'écriture par fusion n'avait aucun test — si c'est faux, une assertion de trop.

Ruling: `immediate-pass.spec.ts`, que le plan ne nommait pas, donne à `ProvisionDeps` un `publisher` qui lève s'il est appelé et un `gameCopies` — le typecheck l'exige, et le `publisher` épingle qu'un jeu sans copie ne lit rien — si c'est faux, une aide de test à reprendre.

Ruling: la déclaration de `steam-user`, qui ne porte pas ses types, est atteinte par un `/// <reference path="./steam-user.d.ts" />` en tête de `steam-publisher.ts`, sous une exception ESLint commentée, et non par un `include` de `apps/functions/tsconfig.app.json` — cet `include` faisait entrer dans l'application un fichier de l'adapter — si c'est faux, un typecheck à recâbler.

Ruling: `bundle-check` cherche `import("steam-user")` dans `main.js`, et non `require("steam-user")` — esbuild laisse tel quel l'import dynamique d'un paquet externe, que Node 22 charge — si c'est faux, une chaîne à changer le jour où le bundler change sa sortie.

Ruling: dans le `try` de `bundle-check`, une Function absente du bundle lève une erreur au lieu d'appeler `fail()` — `process.exit` saute le `finally`, et le dossier d'installation isolé restait sur le disque — sans coût.

Ruling: `onServerStateChange` reçoit `memory: '512MiB'` — le bundle a été mesuré à 165 Mo RSS sur un poste une fois `steam-user` chargé, contre 256 MiB par défaut, et une instance qui manque de mémoire pendant la vérification laisse la session en préparation jusqu'au délai d'abandon — si c'est faux, un prix par invocation un peu plus élevé pour une Function qui tourne quelques fois par soirée.

Ruling: le commentaire de l'option `load` et le README de `libs/steam-publications` disent qu'un chargement de `steam-user` qui échoue le reste jusqu'au recyclage de l'instance ; le code remet toujours à zéro la fabrique, ce qui ne sert qu'à un chargeur injecté — Node garde en cache un `import()` qui a échoué, et le réessai promis n'existait pas en production — si c'est faux, une phrase.

Ruling: le gestionnaire `loggedOn` ne fait rien quand la lecture a déjà rendu sa réponse, et le test de l'erreur tardive vérifie que rien n'a été demandé et qu'une seule déconnexion a eu lieu — un `loggedOn` tardif lançait sinon un `getProductInfo` sur un client déconnecté, qui arme chez `steam-user` un minuteur d'une heure — sans coût.

Ruling: les tests de l'adapter qui doivent réussir prennent un délai de 1 000 ms, et `bundle-check` charge `steam-user` par `import()` depuis le dossier isolé, comme la production — un délai de 50 ms pouvait faire échouer un cas réussi sous une CI chargée — sans coût.

Ruling: la classe `before` de la ligne d'arrêt reste, même quand elle porte une cause — elle précède cette story, et aucune règle CSS ne la cible — si c'est faux, un nom de classe trompeur.

Technical design ruling: la Function ne lit la copie que lorsque la version publiée est lisible — la décision ne dépend pas de la copie dans l'autre cas, et une lecture de la copie en échec changerait une version illisible en refus ordinaire — si c'est faux, une lecture Firestore à ajouter.

Technical design ruling: `bundle-check` charge le bundle dans un Node isolé, hors du dépôt, sur ses seules dépendances déclarées, et non dans l'émulateur — l'émulateur résout les modules en remontant jusqu'aux `node_modules` du dépôt, et chargerait `steam-user` même si le bundle ne le déclarait pas — si c'est faux, une cible à remplacer par un chargement dans l'émulateur.

## Observed drift

Aucune.
