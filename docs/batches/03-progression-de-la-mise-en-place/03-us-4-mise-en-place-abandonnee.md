# La mise en place abandonnée Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un serveur de jeu qui déclare ne pas pouvoir finir sa mise en place la fait abandonner aussitôt, et après tout abandon l'écran affiche l'étape à laquelle la mise en place s'est arrêtée et l'heure de l'abandon, aux membres du monde et aux administrateurs.

**Architecture:** `libs/session` fait donner à `StateCorrection` la session dont la mise en place est abandonnée, et `shownSetup` reçoit la marque d'abandon. `libs/session-record` écrit cette marque dans `server/current` avec le changement d'état, l'efface à `claimProvisioning`, et la publie dans `ServerView`. Dans `apps/functions`, un fichier `abandon-setup.ts` porte le chemin d'abandon que `provisioning.ts` et `agent-report.ts` appellent tous deux ; `agentReport` abandonne sur un rapport `failed` reçu en préparation et écrit la cause entière au journal de la plateforme. `out-of-service.component.ts` et `not-cleared.component.ts` montrent l'étape et l'heure sous `Where it stopped`.

**Tech Stack:** TypeScript, Angular, Vitest, émulateur Firestore, Nx.

**Spec:** docs/specs/session.md
**Batch:** docs/batches/03-progression-de-la-mise-en-place/README.md
**Sections:** Opening a session, Seeing a session
**Blocks:** D4, D5

## Global Constraints

### Ce que le lot impose

Les quatre étapes se nomment `waking`, `fetching-game`, `restoring-world` et
`starting-game`.

Le rapport porte l'étape sous `setup`, et le plan de contrôle la garde dans
`worlds/{worldId}/server/setup`.

L'image du compagnon embarque `libs/session`, `libs/agent-protocol` et
`libs/scaleway-storage`, et la vérification refuse un arbre dont ces sources
diffèrent de l'image épinglée. Toute story qui en change une demande donc une
image publiée et épinglée avant sa fusion. Le commanditaire la publie.

L'image du compagnon qui déclare les étapes est épinglée dans le catalogue
avant que la story qui change l'écran de préparation atteigne `main`.

La story qui garde l'étape déclarée atteint `main` avant celle qui transcrit
D2 et avant celle qui transcrit D4.

Un serveur de jeu démarré sur une image du compagnon d'avant ce lot se met en
service et se ferme comme aujourd'hui.

Ce lot n'ajoute à aucun document qu'un membre lit, ni à aucun événement, un
texte venu d'un serveur de jeu.

### Le périmètre de cette story

Cette story ne modifie que les fichiers que ses tâches nomment, et ce document.

`firestore.rules`, `deploy/cloud-init`, `libs/agent-protocol`, `libs/scaleway-storage` et `probe/` ne changent pas.

`preparing.component.ts` ne change pas, et son test ne gagne que le champ `abandonedAt` de ses fixtures.

`readyWindow` et `BOOT_WINDOW_MS` restent dans `apps/web/src/app/format.ts`, et la fourchette part toujours de `stateSince`.

Le champ de `server/current` qui marque l'abandon se nomme `abandonedSetup`, et porte `sessionId` et `at`.

Seules les Functions écrivent `abandonedSetup`. Il reste hors de `RESERVED_FACTS` et hors de `demandedFields()`.

L'événement `ProvisioningFailed` d'un abandon déclaré a pour détail la phrase fixe `the game server said it could not finish its setup`.

Rien de `report.detail` ni de `report.gameLog` d'un rapport `failed` reçu en préparation n'est écrit ailleurs que dans le journal de la plateforme.

Les mots que l'écran affiche d'une étape viennent de `stepLabel`, dans `apps/web/src/app/format.ts`.

`apps/web` n'importe aucun SDK Firebase et ne nomme aucun champ de document.

Aucune tâche ne modifie `deploy/cloud-init/src/lib/companion-image.ts`, ne lance `companion:pin`, ni ne pose de tag git.

À partir de la tâche 1, `companion:test` échoue sur le seul test `names an image built from the sources in the tree` de `deploy/companion/src/pin/catalogue-pin.spec.ts`. Cet échec est attendu jusqu'à l'épinglage décrit sous `Before the merge`, et aucune tâche ne le corrige.

Aucune commande n'atteint la production : ni `firebase deploy`, ni appel à un fournisseur, ni tag git. Les tests tournent contre l'émulateur.

### Les commandes

Les tests se lancent par Nx, un projet à la fois :

```bash
npx nx run @beacon/session:test
npx nx run @beacon/session-record:test
npx nx run @beacon/rules:test
npx nx run @beacon/functions:test
npx nx run web:test
npx nx run companion:test
```

`@beacon/session-record:test`, `@beacon/rules:test` et `@beacon/functions:test` démarrent l'émulateur Firestore eux-mêmes.

Chaque tâche finit par le typecheck des projets qu'elle touche, que son dernier pas nomme.

### Les commits

Chaque commit passe par `bash ~/.config/github-app/as-agent.sh git commit`, et son message finit par `Co-Authored-By: Charlouze <me@charlouze.com>`.

Aucun commit, commentaire ni document ne mentionne un assistant ou un outil d'IA.

Le sujet d'un commit suit Conventional Commits, en français, à l'impératif, en minuscule, sans point final.

Le code, ses commentaires et les mots de l'interface sont en anglais. Ce document est en français.

Un commentaire dit ce que le code ne peut pas dire. Aucun commentaire ne cite ce document, ce lot ni un numéro de tâche.

Aucune tâche ne lance Prettier sur un fichier entier.

### Le gel de la spec

> Between the first commit of the branch and the opening of the pull request, no
> task modifies the spec file. A story that discovers the spec must change stops.

### L'autorité

When the batch and the spec contradict each other, the spec wins — without
exception and without deliberation. Implement what the spec says, record a
`Ruling:`, and carry on. Correcting a spec mid-batch is a human act, never an
agent's.

### La concision

> These rules hold for every document, pull request body and commit message
> this story writes.
>
> Every sentence says one exact thing, once, and stands on its own.
>
> Every paragraph carries one rule.
>
> A rule says how far it holds, and an exception presents itself as one.
>
> A text says what it delivers or decides, without telling how it got there or
> why. Exception: a reason that is explicitly asked for, such as the why of a
> ruling.
>
> No sentence is set in relief: no bold that ranks one sentence above its
> neighbours.

### Les conditions d'arrêt

> If, while conducting a story, you discover that a constraint of its batch or an ADR cannot be held, stop and put it to your human partner.
>
> A constraint the spec contradicts does not fall under this condition: the spec wins.

### Les ADR

> The code this story writes holds these ADRs.

- `docs/adr/aucun-code-ne-supprime-une-sauvegarde.md`
- `docs/adr/chaque-geste-sur-une-session-laisse-un-evenement-dans-un-journal.md`
- `docs/adr/chaque-jeu-apporte-sa-propre-forme-de-point-de-jonction.md`
- `docs/adr/chaque-sauvegarde-a-sa-cle-et-l-origine-vient-en-tete.md`
- `docs/adr/il-n-existe-qu-un-environnement.md`
- `docs/adr/l-identifiant-d-un-monde-sert-de-cle-de-rangement-et-de-sous-domaine.md`
- `docs/adr/la-mise-en-place-du-compte-est-un-outil-sans-etat.md`
- `docs/adr/le-compte-qui-possede-un-jeu-ne-monte-jamais-sur-un-serveur-de-jeu.md`
- `docs/adr/le-role-d-administrateur-vit-dans-l-enregistrement-de-l-utilisateur.md`
- `docs/adr/le-semis-ne-cree-aucun-administrateur.md`
- `docs/adr/le-systeme-possede-la-session-et-tout-le-reste-est-le-compte.md`
- `docs/adr/les-ecrans-n-accedent-au-stockage-que-par-un-record.md`
- `docs/adr/les-identifiants-d-hebergeur-vivent-dans-secret-manager.md`
- `docs/adr/les-regles-d-acces-verifient-l-entree-dans-un-monde.md`
- `docs/adr/toute-image-de-conteneur-est-designee-par-une-reference-immuable.md`
- `docs/adr/un-outil-en-ligne-de-commande-cree-les-mondes-et-deplace-leurs-sauvegardes.md`
- `docs/adr/un-serveur-de-jeu-met-fin-a-sa-propre-mise-en-place.md`
- `docs/adr/un-serveur-de-jeu-n-atteint-que-les-sauvegardes-de-son-monde-et-le-depot-des-jeux.md`

> A technical decision is recorded as an ADR only if it meets these conditions:
>
> - undoing it is expensive;
> - it surprises whoever does not know its context;
> - it settles between real alternatives.
>
> When you take a technical decision that meets them, say so in your report: it
> is recorded as an `Open ruling:`, which asks your human partner whether they
> want it as an ADR. Write nothing in `docs/adr/`.

## Review Focus

- Un second rapport `failed` reçu après l'abandon reçoit l'ordre de s'arrêter, sans fermer ni écrire une seconde fois. Tâche 6.
- Un membre qui ferme la session pendant que l'abandon ferme le serveur garde sa fermeture : l'abandon n'écrit rien. Tâches 5 et 6.
- Une ouverture écrite par un membre passe les règles sur un `server/current` qui porte la marque d'abandon. Tâche 4.
- Une session ouverte puis arrêtée avant d'être acquise laisse la marque de la session d'avant : l'écran hors service ne montre rien d'une mise en place abandonnée. Tâches 1 et 3.
- Un abandon dont `server/setup` porte une autre session montre la première étape, au rang 1, sans ordre. Tâches 1 et 7.

---

### Task 1: Ce que l'écran montre d'une mise en place abandonnée, dans le domaine

**Files:**
- Modify: `libs/session/src/lib/setup.ts`
- Modify: `libs/session/src/lib/setup.spec.ts`
- Modify: `libs/session-record/src/lib/client-session.ts` (l'appel de `shownSetup` seulement)
- Modify: `libs/session-record/src/lib/client-session.spec.ts` (les attentes sur `setup`)
- Modify: `libs/session-record/src/lib/client-session-resilience.spec.ts` (l'attente sur `setup`)
- Modify: `apps/web/src/app/session/preparing.component.spec.ts` (les deux fixtures `ShownSetup`)

**Interfaces:**
- Consumes: `KeptSetup`, `KeptSetupStep`, `SetupStepOrder`, `firstSetupStep` de `libs/session/src/lib/setup.ts` ; `SessionId`, `SessionState` de `libs/session/src/lib/session.ts`.
- Produces, exportés par `@beacon/session` :
  - `interface LastOpening { readonly state: SessionState; readonly sessionId: SessionId | null; readonly startedAt: Date | null }`
  - `interface AbandonedSetup { readonly sessionId: SessionId; readonly at: Date }`
  - `interface ShownSetup { readonly step: KeptSetupStep; readonly order: SetupStepOrder | null; readonly abandonedAt: Date | null }`
  - `shownSetup(opening: LastOpening, abandoned: AbandonedSetup | null, kept: KeptSetup | null): ShownSetup | null`

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `libs/session/src/lib/setup.spec.ts`, ajouter `type AbandonedSetup` à l'import de `./setup.js`, puis remplacer le bloc `describe('shownSetup', …)` entier par :

```ts
describe('shownSetup', () => {
  const ORDER = ['waking', 'restoring-world', 'fetching-game', 'starting-game'] as const;
  const ABANDONED = new Date('2026-10-12T20:05:00Z');
  const PREPARING = { state: 'PROVISIONING', sessionId: 's1', startedAt: OPENED } as const;
  const OUT_OF_SERVICE = { ...PREPARING, state: 'IDLE' } as const;

  const keptFor = (sessionId: string): KeptSetup => ({
    sessionId,
    order: ORDER,
    step: kept({ since: LATER, activity: 'downloading', progress: 37 }),
  });

  const markOf = (sessionId: string): AbandonedSetup => ({ sessionId, at: ABANDONED });

  it('shows the kept step and the order of its game, while its own session prepares', () => {
    expect(shownSetup(PREPARING, null, keptFor('s1'))).toEqual({
      step: { step: 'fetching-game', since: LATER, activity: 'downloading', progress: 37 },
      order: ORDER,
      abandonedAt: null,
    });
  });

  it('shows the first step since the opening, and no order, while nothing is kept', () => {
    expect(shownSetup(PREPARING, null, null)).toEqual({
      step: { step: 'waking', since: OPENED, activity: null, progress: null },
      order: null,
      abandonedAt: null,
    });
  });

  // Nothing erases what a setup left: the next session finds the previous one
  // there until its own is begun.
  it('shows the first step when what is kept belongs to another session', () => {
    expect(shownSetup(PREPARING, null, keptFor('s0'))).toEqual({
      step: { step: 'waking', since: OPENED, activity: null, progress: null },
      order: null,
      abandonedAt: null,
    });
  });

  // The mark of the setup before is erased when the next one is claimed, not
  // when it is opened: a session that prepares is never shown as abandoned.
  it('shows a session that prepares as under way, whatever mark is left', () => {
    expect(shownSetup(PREPARING, markOf('s0'), keptFor('s1'))?.abandonedAt).toBeNull();
    expect(shownSetup(PREPARING, markOf('s1'), keptFor('s1'))?.abandonedAt).toBeNull();
  });

  for (const state of ['IDLE', 'RUNNING', 'STOPPING', 'FAILED'] as const) {
    it(`shows nothing of a session that is ${state} and abandoned no setup`, () => {
      expect(shownSetup({ ...PREPARING, state }, null, keptFor('s1'))).toBeNull();
    });
  }

  it('shows the step an abandoned setup stopped at, and the instant it was abandoned', () => {
    expect(shownSetup(OUT_OF_SERVICE, markOf('s1'), keptFor('s1'))).toEqual({
      step: { step: 'fetching-game', since: LATER, activity: 'downloading', progress: 37 },
      order: ORDER,
      abandonedAt: ABANDONED,
    });
  });

  it('shows it too while what is left of the session is not cleared', () => {
    expect(
      shownSetup({ ...PREPARING, state: 'FAILED' }, markOf('s1'), keptFor('s1'))?.abandonedAt,
    ).toEqual(ABANDONED);
  });

  it('shows the first step of an abandoned setup whose kept step belongs to another session', () => {
    expect(shownSetup(OUT_OF_SERVICE, markOf('s1'), keptFor('s0'))).toEqual({
      step: { step: 'waking', since: OPENED, activity: null, progress: null },
      order: null,
      abandonedAt: ABANDONED,
    });
    expect(shownSetup(OUT_OF_SERVICE, markOf('s1'), null)?.step.step).toBe('waking');
  });

  // A session opened then stopped before it was claimed leaves the mark of
  // the session before it: that mark no longer names the last one opened.
  it('shows nothing when the mark names another session than the last one opened', () => {
    expect(shownSetup(OUT_OF_SERVICE, markOf('s0'), keptFor('s0'))).toBeNull();
    expect(shownSetup(OUT_OF_SERVICE, markOf('s0'), keptFor('s1'))).toBeNull();
  });

  it('shows nothing of a world that names no opening', () => {
    expect(shownSetup({ ...PREPARING, startedAt: null }, null, keptFor('s1'))).toBeNull();
    expect(shownSetup({ ...PREPARING, sessionId: null }, null, null)).toBeNull();
    expect(shownSetup({ ...OUT_OF_SERVICE, sessionId: null }, markOf('s1'), null)).toBeNull();
  });
});
```

Dans le bloc `describe('setupStepRank', …)` du même fichier, ajouter `abandonedAt: null` à chacun des quatre objets passés à `setupStepRank`. Le dernier devient :

```ts
    expect(setupStepRank({ step: firstSetupStep(OPENED), order: null, abandonedAt: null })).toBe(1);
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npx nx run @beacon/session:test`
Expected: FAIL, les tests de `shownSetup` échouent sur le troisième argument ignoré et sur `abandonedAt` absent.

- [ ] **Step 3: Écrire l'implémentation**

Dans `libs/session/src/lib/setup.ts`, remplacer la première ligne d'import :

```ts
import type { SessionId, SessionState } from './session.js';
```

et supprimer l'import de `Session`. Remplacer ensuite tout ce qui va de l'interface `ShownSetup` à la fin de `shownSetup` par :

```ts
/**
 * The last session a world opened, whatever became of it: a world out of
 * service still names the session it last opened.
 */
export interface LastOpening {
  readonly state: SessionState;
  readonly sessionId: SessionId | null;
  readonly startedAt: Date | null;
}

/** The mark an abandoned setup leaves: whose it was, and the instant it was abandoned. */
export interface AbandonedSetup {
  readonly sessionId: SessionId;
  readonly at: Date;
}

/** What the screen shows of a setup. No order until the game's own is known. */
export interface ShownSetup {
  readonly step: KeptSetupStep;
  readonly order: SetupStepOrder | null;
  /** The instant the setup was abandoned, and null while it is under way. */
  readonly abandonedAt: Date | null;
}

/**
 * What the screen shows of a world's last setup: the step it is on while its
 * session prepares, the step it stopped at once it was abandoned, and null
 * otherwise.
 *
 * What is kept counts only when it belongs to that session: nothing erases
 * it, so the next session finds the previous one's there until its own is
 * begun, and shows the first step since its opening meanwhile. The mark
 * counts on the same condition: a session stopped before it was claimed
 * leaves the mark of the session before it.
 */
export function shownSetup(
  opening: LastOpening,
  abandoned: AbandonedSetup | null,
  kept: KeptSetup | null,
): ShownSetup | null {
  if (opening.sessionId === null || opening.startedAt === null) return null;

  const abandonedAt = abandonedAtOf(opening, abandoned);
  if (opening.state !== 'PROVISIONING' && abandonedAt === null) return null;

  if (kept !== null && kept.sessionId === opening.sessionId) {
    return { step: kept.step, order: kept.order, abandonedAt };
  }
  return { step: firstSetupStep(opening.startedAt), order: null, abandonedAt };
}

function abandonedAtOf(opening: LastOpening, abandoned: AbandonedSetup | null): Date | null {
  if (opening.state === 'PROVISIONING') return null;
  return abandoned !== null && abandoned.sessionId === opening.sessionId ? abandoned.at : null;
}
```

- [ ] **Step 4: Suivre la signature chez ses appelants**

Dans `libs/session-record/src/lib/client-session.ts`, l'appel devient, sans autre changement dans ce fichier :

```ts
                    setup: shownSetup(session, null, keptSetupFrom(setupData)),
```

Dans `libs/session-record/src/lib/client-session.spec.ts`, ajouter `abandonedAt: null` à `FIRST_STEP` et à l'attente du test `publishes the kept step and the order of the game with the world` :

```ts
  const FIRST_STEP = {
    step: { step: 'waking', since: OPENED, activity: null, progress: null },
    order: null,
    abandonedAt: null,
  };
```

```ts
    expect((await view())?.server?.setup).toEqual({
      step: { step: 'fetching-game', since: AT, activity: 'downloading', progress: 37 },
      order: [...ORDER],
      abandonedAt: null,
    });
```

Dans `libs/session-record/src/lib/client-session-resilience.spec.ts`, l'attente finale devient :

```ts
    expect(seen.at(-1)?.server?.setup).toEqual({
      step: { step: 'waking', since: NOW, activity: null, progress: null },
      order: null,
      abandonedAt: null,
    });
```

Dans `apps/web/src/app/session/preparing.component.spec.ts`, les deux fixtures deviennent :

```ts
  const FIRST_STEP: ShownSetup = {
    step: { step: 'waking', since: startedAt, activity: null, progress: null },
    order: null,
    abandonedAt: null,
  };

  const fetching = (parts: Partial<ShownSetup['step']> = {}): ShownSetup => ({
    step: { step: 'fetching-game', since: stepSince, activity: null, progress: null, ...parts },
    order: DEPOT_FIRST,
    abandonedAt: null,
  });
```

- [ ] **Step 5: Lancer les tests et le typecheck**

Run: `npx nx run @beacon/session:test`
Expected: PASS

Run: `npx nx run @beacon/session-record:test`
Expected: PASS

Run: `npx nx run web:test`
Expected: PASS

Run: `npx nx run-many -t typecheck -p @beacon/session @beacon/session-record web`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add libs/session/src/lib/setup.ts libs/session/src/lib/setup.spec.ts libs/session-record/src/lib/client-session.ts libs/session-record/src/lib/client-session.spec.ts libs/session-record/src/lib/client-session-resilience.spec.ts apps/web/src/app/session/preparing.component.spec.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(session): dit ce que l'écran montre d'une mise en place abandonnée" -m "La marque d'abandon ne compte que si elle porte la dernière session ouverte : une session arrêtée avant d'être acquise laisse celle de la session d'avant." -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 2: La correction donne la session dont la mise en place est abandonnée

**Files:**
- Modify: `libs/session/src/lib/watchdog/reconcile.ts`
- Modify: `libs/session/src/lib/watchdog/reconcile.spec.ts`
- Modify: `libs/session-record/src/lib/server-state.spec.ts` (les deux corrections littérales)
- Modify: `libs/session-record/src/lib/world-state.spec.ts` (la correction littérale)
- Modify: `apps/functions/src/provisioning.ts` (les deux corrections littérales)
- Modify: `apps/functions/src/agent-report.ts` (les trois corrections littérales)

**Interfaces:**
- Consumes: `Reclamation` de `libs/session/src/lib/watchdog/reclamations.ts`.
- Produces: `StateCorrection` gagne `readonly abandonedSetup: SessionId | null`, obligatoire. `reconcileWorld` le donne pour un abandon au délai, que la fermeture aboutisse ou non, et `null` dans tous les autres cas.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `libs/session/src/lib/watchdog/reconcile.spec.ts`, ajouter dans `describe('reconcileWorld', …)`, après le test `sends a PROVISIONING whose cleanup failed to FAILED, keeping the facts` :

```ts
  it('gives the session whose setup the delay abandons, once it is closed', () => {
    const v = view({ worlds: [singleWorld(record('PROVISIONING', 's1', true))], hosted: [hosted('s1')] });
    const correction = reconcileWorld(v, v.worlds[0], [outcome('s1', 'provisioning-timeout', true)], []);
    expect(correction.state).toBe('IDLE');
    expect(correction.abandonedSetup).toBe('s1');
  });

  it('gives it too when the close is refused', () => {
    const v = view({ worlds: [singleWorld(record('PROVISIONING', 's1', true))], hosted: [hosted('s1')] });
    const correction = reconcileWorld(v, v.worlds[0], [outcome('s1', 'provisioning-timeout', false)], []);
    expect(correction.state).toBe('FAILED');
    expect(correction.abandonedSetup).toBe('s1');
  });

  // Only a setup is abandoned. A session that stops late, or whose cleanup is
  // tried again, leaves whatever mark the record already carries.
  it('abandons no setup for any other reason, nor when nothing happened', () => {
    const stopping = view({ worlds: [singleWorld(record('STOPPING', 's1', true))], hosted: [hosted('s1')] });
    expect(
      reconcileWorld(stopping, stopping.worlds[0], [outcome('s1', 'stopping-timeout', true)], [])
        .abandonedSetup,
    ).toBeNull();

    const failed = view({ worlds: [singleWorld(record('FAILED', 's1', true))], hosted: [hosted('s1')] });
    expect(
      reconcileWorld(failed, failed.worlds[0], [outcome('s1', 'failed-retry', true)], [])
        .abandonedSetup,
    ).toBeNull();
    expect(
      reconcileWorld(failed, failed.worlds[0], [outcome('s1', 'failed-retry', false)], [])
        .abandonedSetup,
    ).toBeNull();

    const quietView = view();
    expect(reconcileWorld(quietView, quietView.worlds[0], [], []).abandonedSetup).toBeNull();
  });
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npx nx run @beacon/session:test`
Expected: FAIL, `abandonedSetup` vaut `undefined`.

- [ ] **Step 3: Écrire l'implémentation**

Dans `libs/session/src/lib/watchdog/reconcile.ts`, ajouter à `StateCorrection`, après `deadline` :

```ts
  /**
   * The session whose setup this correction abandons, or null. Null leaves
   * whatever mark the record already carries: the mark of an abandoned setup
   * outlives the corrections that follow it, until the next setup is claimed.
   */
  readonly abandonedSetup: SessionId | null;
```

Ajouter `abandonedSetup: null,` à `NOTHING`, et à chacune des trois corrections littérales qui ne partent pas de `NOTHING` et ne viennent pas d'un `own` : celle du `FAILED` sans session, celle du `RUNNING` disparu chez l'hébergeur, et celle de l'expiration.

Les deux corrections du `own` deviennent :

```ts
    return {
      state: 'FAILED',
      lastError: own.error,
      clearFacts: false,
      closeIntents,
      events,
      deadline: null,
      abandonedSetup: abandonedBy(own.reclamation),
    };
  }

  if (own !== undefined) {
    return {
      state: 'IDLE',
      lastError: CLOSED[own.reclamation.reason].idleReason,
      clearFacts: true,
      closeIntents,
      events,
      deadline: null,
      abandonedSetup: abandonedBy(own.reclamation),
    };
  }
```

Ajouter, au-dessus de `isStillHeld` :

```ts
/**
 * The delay only runs out on a session still preparing, so this reason alone
 * abandons a setup — whether its server could be closed or not.
 */
const abandonedBy = (reclamation: Reclamation): SessionId | null =>
  reclamation.reason === 'provisioning-timeout' ? reclamation.sessionId : null;
```

- [ ] **Step 4: Donner le champ aux corrections écrites ailleurs**

Ajouter `abandonedSetup: null,` à chaque correction littérale de ces fichiers, sans rien y changer d'autre :

- `apps/functions/src/provisioning.ts` : les deux `state.apply` de `failed` ;
- `apps/functions/src/agent-report.ts` : les deux `state.apply` de `destroy`, et celui de `fileEvent` ;
- `libs/session-record/src/lib/server-state.spec.ts` : l'aide `correction`, et la correction du test `writes a clamped deadline and its audit line in one commit` ;
- `libs/session-record/src/lib/world-state.spec.ts` : la correction du test `stamps the world on every event it files`.

L'aide de `server-state.spec.ts` devient :

```ts
const correction = (parts: Partial<StateCorrection> = {}): StateCorrection => ({
  state: null,
  lastError: null,
  clearFacts: false,
  deadline: null,
  closeIntents: [],
  events: [],
  abandonedSetup: null,
  ...parts,
});
```

- [ ] **Step 5: Lancer les tests et le typecheck**

Run: `npx nx run @beacon/session:test`
Expected: PASS

Run: `npx nx run-many -t typecheck -p @beacon/session @beacon/session-record @beacon/functions`
Expected: PASS. Une erreur `Property 'abandonedSetup' is missing` nomme une correction littérale oubliée : lui ajouter `abandonedSetup: null`.

Run: `npx nx run @beacon/functions:test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add libs/session/src/lib/watchdog/reconcile.ts libs/session/src/lib/watchdog/reconcile.spec.ts libs/session-record/src/lib/server-state.spec.ts libs/session-record/src/lib/world-state.spec.ts apps/functions/src/provisioning.ts apps/functions/src/agent-report.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(session): donne dans la correction la session dont la mise en place est abandonnée" -m "L'abandon au délai la donne que la fermeture aboutisse ou non ; une correction qui n'abandonne rien laisse la marque en place." -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 3: Le record garde la marque d'abandon et la publie avec le monde

**Files:**
- Modify: `libs/session-record/src/lib/fields.ts`
- Modify: `libs/session-record/src/lib/fields.spec.ts`
- Modify: `libs/session-record/src/lib/server-state.ts`
- Modify: `libs/session-record/src/lib/server-state.spec.ts`
- Modify: `libs/session-record/src/lib/reserved-fields.spec.ts`
- Modify: `libs/session-record/src/lib/client-session.ts`
- Modify: `libs/session-record/src/lib/client-session.spec.ts`

**Interfaces:**
- Consumes: `AbandonedSetup`, `LastOpening`, `shownSetup(opening, abandoned, kept)` de `@beacon/session` (tâche 1) ; `StateCorrection.abandonedSetup` (tâche 2).
- Produces, exportés par `libs/session-record/src/lib/fields.ts` :
  - `const ABANDONED_SETUP = 'abandonedSetup'`
  - `abandonedSetupFrom(data: Record<string, unknown>): AbandonedSetup | null`
  - `lastOpeningFrom(data: Record<string, unknown>, state: SessionState): LastOpening`
- Produces: `ServerStateStore.apply` écrit `abandonedSetup: { sessionId, at }` quand la correction donne une session ; `claimProvisioning` l'écrit à `null` ; `idleServerDocument` le sème à `null` ; `ServerView.setup` porte l'étape d'une mise en place abandonnée.

- [ ] **Step 1: Écrire les tests qui échouent, sur les champs**

Dans `libs/session-record/src/lib/fields.spec.ts`, ajouter `abandonedSetupFrom` et `lastOpeningFrom` à l'import de `./fields.js`, ajouter `'abandonedSetup',` après `'lastError',` dans la liste du test `seeds a server document with every field present and null`, puis ajouter à la fin du fichier :

```ts
describe('abandonedSetupFrom', () => {
  const AT = new Date('2026-10-12T20:19:00Z');

  it('reads whose setup was abandoned, and when', () => {
    expect(abandonedSetupFrom({ abandonedSetup: { sessionId: 's1', at: AT } })).toEqual({
      sessionId: 's1',
      at: AT,
    });
  });

  it('reads nothing from a document that carries no mark', () => {
    expect(abandonedSetupFrom({})).toBeNull();
    expect(abandonedSetupFrom({ abandonedSetup: null })).toBeNull();
  });

  it('refuses half a mark, rather than an abandon with no session or no hour', () => {
    expect(abandonedSetupFrom({ abandonedSetup: { sessionId: 's1' } })).toBeNull();
    expect(abandonedSetupFrom({ abandonedSetup: { at: AT } })).toBeNull();
    expect(abandonedSetupFrom({ abandonedSetup: 's1' })).toBeNull();
  });
});

describe('lastOpeningFrom', () => {
  const OPENED = new Date('2026-10-12T20:14:00Z');

  // What a return to out of service leaves: the session and its opening stay
  // on the document until the next opening rewrites them.
  it('reads the session a world last opened, on a world out of service too', () => {
    expect(lastOpeningFrom({ state: 'IDLE', sessionId: 's1', startedAt: OPENED }, 'IDLE')).toEqual({
      state: 'IDLE',
      sessionId: 's1',
      startedAt: OPENED,
    });
  });

  it('reads no opening from a world that never opened a session', () => {
    expect(lastOpeningFrom({ sessionId: null, startedAt: null }, 'IDLE')).toEqual({
      state: 'IDLE',
      sessionId: null,
      startedAt: null,
    });
  });
});
```

Dans `libs/session-record/src/lib/reserved-fields.spec.ts`, remplacer le test `demands no field the functions reserve` et son commentaire par :

```ts
  // The other direction, and the one that leaks rather than breaks. `lastError`
  // and `abandonedSetup` are reserved but deliberately absent from
  // RESERVED_FACTS — the cleanup of an abandon must not empty them — so they
  // are named here, or nothing would guard them.
  it('demands no field the functions reserve', () => {
    for (const field of [...RESERVED_FACTS, 'lastError', ABANDONED_SETUP]) {
      expect(demandedByRules()).not.toContain(field);
    }
  });

  it('keeps what a failed attempt left out of the facts a cleanup empties', () => {
    expect(RESERVED_FACTS).not.toContain('lastError');
    expect(RESERVED_FACTS).not.toContain(ABANDONED_SETUP);
  });
```

et ajouter `ABANDONED_SETUP` à l'import de `./fields.js` de ce fichier.

- [ ] **Step 2: Écrire les tests qui échouent, sur le magasin**

Dans `libs/session-record/src/lib/server-state.spec.ts`, ajouter `abandonedSetupFrom` à l'import de `./fields.js`, puis ajouter à la fin du fichier :

```ts
describe('the mark of an abandoned setup', () => {
  const MARK = { sessionId: 's1', at: AT };
  const current = async () => (await db.doc(SERVER_DOC).get()).data() ?? {};

  it('is written with the state, in the same write, at the instant of the pass', async () => {
    await seedServer({ state: 'PROVISIONING', sessionId: 's1', ip: '51.15.42.7' });

    await apply({ state: 'IDLE', clearFacts: true, abandonedSetup: 's1' });

    const after = await current();
    expect(after['state']).toBe('IDLE');
    expect(abandonedSetupFrom(after)).toEqual({ sessionId: 's1', at: NOW });
  });

  // The retry that clears a blocked session abandons nothing: the mark it
  // finds is the one thing that still says where the setup stopped.
  it('is left alone by a correction that abandons nothing, even one that empties the facts', async () => {
    await seedServer({ state: 'FAILED', sessionId: 's1', abandonedSetup: MARK });

    await apply({ state: 'IDLE', clearFacts: true });

    expect(abandonedSetupFrom(await current())).toEqual(MARK);
  });

  it('is erased by the claim of the next setup, since that one answers for itself', async () => {
    await seedServer({ state: 'PROVISIONING', sessionId: 's2', abandonedSetup: MARK });

    expect(await store.claimProvisioning('s2', AT)).toBe(true);

    expect((await current())['abandonedSetup']).toBeNull();
  });

  it('is left alone by a claim that is refused', async () => {
    await seedServer({ state: 'IDLE', sessionId: 's2', abandonedSetup: MARK });

    expect(await store.claimProvisioning('s2', AT)).toBe(false);

    expect(abandonedSetupFrom(await current())).toEqual(MARK);
  });
});
```

- [ ] **Step 3: Écrire les tests qui échouent, sur ce que le navigateur reçoit**

Dans `libs/session-record/src/lib/client-session.spec.ts`, ajouter dans `describe('the setup of a session that prepares', …)`, après le test `publishes no setup for a world out of service, whatever is kept` :

```ts
  describe('once it is abandoned', () => {
    const ABANDONED = new Date('2026-10-12T20:19:00Z');

    /** What an abandon leaves: out of service, the session still named, and the mark. */
    async function abandonedServer(sessionId: string, markedSession = sessionId): Promise<void> {
      await getFirestore()
        .doc(serverDocPath('les-copains'))
        .set(
          {
            state: 'IDLE',
            stateSince: Timestamp.fromDate(ABANDONED),
            sessionId,
            abandonedSetup: { sessionId: markedSession, at: Timestamp.fromDate(ABANDONED) },
          },
          { merge: true },
        );
    }

    it('publishes the step the setup stopped at, and the instant it was abandoned', async () => {
      await seedWorld('les-copains', { players: ['alice'] });
      await preparingServer('les-copains', 's1');
      await setups().begin('s1', ORDER, OPENED);
      await setups().advance('s1', { step: 'fetching-game' }, AT);
      await abandonedServer('s1');

      const seen = await view();

      expect(seen?.server?.session.state).toBe('IDLE');
      expect(seen?.server?.setup).toEqual({
        step: { step: 'fetching-game', since: AT, activity: null, progress: null },
        order: [...ORDER],
        abandonedAt: ABANDONED,
      });
    });

    it('publishes the first step when the setup it kept is another session’s', async () => {
      await seedWorld('les-copains', { players: ['alice'] });
      await preparingServer('les-copains', 's1');
      await setups().begin('s0', ORDER, OPENED);
      await abandonedServer('s1');

      expect((await view())?.server?.setup).toEqual({ ...FIRST_STEP, abandonedAt: ABANDONED });
    });

    // A session opened and stopped before it was claimed: the mark is still
    // the one of the session before it.
    it('publishes nothing when the mark names another session than the last one opened', async () => {
      await seedWorld('les-copains', { players: ['alice'] });
      await preparingServer('les-copains', 's2');
      await abandonedServer('s2', 's1');

      expect((await view())?.server?.setup).toBeNull();
    });
  });
```

- [ ] **Step 4: Lancer les tests pour les voir échouer**

Run: `npx nx run @beacon/session-record:test`
Expected: FAIL, `abandonedSetupFrom`, `lastOpeningFrom` et `ABANDONED_SETUP` n'existent pas.

- [ ] **Step 5: Écrire l'implémentation, dans les champs**

Dans `libs/session-record/src/lib/fields.ts`, ajouter `type AbandonedSetup` et `type LastOpening` à l'import de `@beacon/session`, puis ajouter après `keptSetupFrom` :

```ts
/**
 * The field of `server/current` that marks an abandoned setup: whose it was,
 * and when. Only the Functions write it, in the write that changes the state.
 * It stays out of `RESERVED_FACTS` like `lastError`, and for the same reason:
 * the cleanup of an abandon empties those, and this is what it must leave.
 */
export const ABANDONED_SETUP = 'abandonedSetup';

/** The mark as the domain reads it. Half a mark reads as none. */
export function abandonedSetupFrom(data: Record<string, unknown>): AbandonedSetup | null {
  const mark = data[ABANDONED_SETUP];
  if (typeof mark !== 'object' || mark === null) return null;
  const { sessionId, at } = mark as Record<string, unknown>;
  const abandonedAt = toDate(at);
  if (typeof sessionId !== 'string' || abandonedAt === null) return null;
  return { sessionId, at: abandonedAt };
}

/**
 * The session `server/current` last opened. A return to out of service leaves
 * it on the document, which is why this reads the document and not the
 * session: an idle `Session` names none.
 */
export function lastOpeningFrom(data: Record<string, unknown>, state: SessionState): LastOpening {
  const sessionId = data['sessionId'];
  return {
    state,
    sessionId: typeof sessionId === 'string' ? sessionId : null,
    startedAt: toDate(data['startedAt']),
  };
}
```

Dans `idleServerDocument`, ajouter `[ABANDONED_SETUP]: null,` après `lastError: null,`.

- [ ] **Step 6: Écrire l'implémentation, dans le magasin**

Dans `libs/session-record/src/lib/server-state.ts`, ajouter `ABANDONED_SETUP` à l'import de `./fields.js`.

Dans `claimProvisioning`, la mise à jour devient :

```ts
        transaction.update(serverDoc(), {
          provisionClaimedAt: Timestamp.fromDate(at),
          // The one instant where the recorded failure stops being true. Every
          // other write leaves it, deliberately — "the last attempt failed" has
          // to stay readable until a next attempt answers for itself, and this
          // call *is* that next attempt. Not at publish: `announce()` may have
          // just filed a dns incident on this very session.
          lastError: null,
          // Where the setup before stopped goes with it, for the same reason.
          [ABANDONED_SETUP]: null,
        });
```

Dans `apply`, ajouter après le bloc de `correction.deadline` :

```ts
      if (correction.abandonedSetup !== null) {
        // With the state, in the same write: a screen never reads an abandon
        // without where it stopped. Null leaves the recorded mark, like
        // `lastError`.
        patch[ABANDONED_SETUP] = {
          sessionId: correction.abandonedSetup,
          at: Timestamp.fromDate(at),
        };
      }
```

- [ ] **Step 7: Écrire l'implémentation, dans ce que le navigateur reçoit**

Dans `libs/session-record/src/lib/client-session.ts`, ajouter `abandonedSetupFrom` et `lastOpeningFrom` à l'import de `./fields.js`. Le commentaire du champ `setup` de `ServerView` et l'appel deviennent :

```ts
  /**
   * What the screen shows of the world's last setup: the step under way while
   * the session prepares, the step it stopped at once it was abandoned, and
   * null otherwise.
   */
  readonly setup: ShownSetup | null;
```

```ts
                    setup: shownSetup(
                      lastOpeningFrom(serverData, session.state),
                      abandonedSetupFrom(serverData),
                      keptSetupFrom(setupData),
                    ),
```

- [ ] **Step 8: Lancer les tests et le typecheck**

Run: `npx nx run @beacon/session-record:test`
Expected: PASS

Run: `npx nx run-many -t typecheck -p @beacon/session-record`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add libs/session-record/src/lib
bash ~/.config/github-app/as-agent.sh git commit -m "feat(session-record): garde la marque d'une mise en place abandonnée et la publie avec le monde" -m "La marque s'écrit avec le changement d'état et s'efface à l'acquisition de la mise en place suivante. Elle reste hors des faits réservés, pour que le nettoyage d'un abandon ne l'efface pas." -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 4: Les règles refusent la marque d'abandon à un membre

**Files:**
- Modify: `libs/rules/src/lib/server-current.spec.ts`
- Modify: `libs/rules/src/lib/harness.ts`

**Interfaces:**
- Consumes: le nom de champ `abandonedSetup` (tâche 3). `firestore.rules` ne change pas : un membre n'écrit dans `server/current` que les champs de `demandedFields()`.
- Produces: rien.

- [ ] **Step 1: Écrire les tests**

Dans `libs/rules/src/lib/harness.ts`, ajouter `abandonedSetup: null,` après `lastError: null,` dans les deux documents `worlds/w1/server/current` et `worlds/w2/server/current`.

Dans `libs/rules/src/lib/server-current.spec.ts`, la liste devient :

```ts
const RESERVED = [
  'instanceId',
  'ipId',
  'ip',
  'joinInfo',
  'provisionClaimedAt',
  'lastError',
  'abandonedSetup',
];
```

Ajouter dans `describe('server/current', …)`, après le test `sinks a legitimate write that smuggles a reserved field` :

```ts
  // The mark is erased by the claim of the next setup, not by its opening: a
  // member opens over it, and must be neither refused nor able to touch it.
  it('accepts an opening on a world that still carries the mark of an abandoned setup', async () => {
    await given(env, 'worlds/w1/server/current', {
      state: 'IDLE',
      stateSince: null,
      sessionId: 's0',
      startedBy: ALICE,
      startedAt: null,
      deadline: null,
      lastError: null,
      abandonedSetup: { sessionId: 's0', at: Timestamp.fromMillis(1_790_000_000_000) },
    });

    await assertSucceeds(opening(ALICE));
  });

  it('refuses a member who erases or rewrites that mark', async () => {
    await given(env, 'worlds/w1/server/current', {
      state: 'IDLE',
      stateSince: null,
      sessionId: 's0',
      startedBy: ALICE,
      startedAt: null,
      deadline: null,
      lastError: null,
      abandonedSetup: { sessionId: 's0', at: Timestamp.fromMillis(1_790_000_000_000) },
    });

    await assertFails(updateDoc(server(ALICE), { abandonedSetup: null }));
    await assertFails(opening(ALICE, { abandonedSetup: null }));
  });
```

- [ ] **Step 2: Lancer les tests**

Run: `npx nx run @beacon/rules:test`
Expected: PASS. Les règles tiennent déjà ces refus ; ces tests les épinglent. Un échec du test `accepts an opening on a world that still carries the mark` est une contrainte du lot qui ne tient pas : s'arrêter et le rapporter, sans modifier `firestore.rules`.

- [ ] **Step 3: Commit**

```bash
git add libs/rules/src/lib/server-current.spec.ts libs/rules/src/lib/harness.ts
bash ~/.config/github-app/as-agent.sh git commit -m "test(rules): refuse à un membre la marque d'une mise en place abandonnée" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 5: Le chemin d'abandon sort de `provisioning.ts`

**Files:**
- Create: `apps/functions/src/abandon-setup.ts`
- Modify: `apps/functions/src/provisioning.ts`
- Modify: `apps/functions/src/provisioning.spec.ts`

**Interfaces:**
- Consumes: `StateCorrection.abandonedSetup` (tâche 2) ; `expunged`, `FailureSource`, `PlatformJournal` de `apps/functions/src/platform-journal.ts` ; `ProvisioningLedger` ; `WorldStateStores` de `@beacon/session-record`.
- Produces, exportés par `apps/functions/src/abandon-setup.ts` :
  - `interface AbandonDeps { readonly host: ServerHost; readonly states: WorldStateStores; readonly ledger: ProvisioningLedger; readonly journal: PlatformJournal }`
  - `interface Abandonment { readonly worldId: WorldId; readonly sessionId: SessionId; readonly detail: string; readonly hostRefusal: string | null; readonly cleanupSource: FailureSource }`
  - `abandonSetup(deps: AbandonDeps, abandonment: Abandonment, now: Date): Promise<void>`

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `apps/functions/src/provisioning.spec.ts`, le faux magasin d'état relit par défaut la session en préparation, parce que l'abandon relit l'enregistrement avant d'écrire :

```ts
  const state = {
    claimProvisioning: vi.fn(async () => true),
    publish: vi.fn(async () => undefined),
    apply: vi.fn(async () => undefined),
    read: vi.fn(async () => null),
    readSession: vi.fn(async (): Promise<Session | null> => provisioning()),
  };
```

Ajouter dans `describe('provisioning', …)`, après le test `goes to FAILED when the cleanup itself fails` :

```ts
  it('gives the session whose setup the refusal abandons', async () => {
    deps.host.open = vi.fn(async () => {
      throw new Error('no capacity');
    });
    await runStateChange(deps, WORLD_ID, provisioning());
    expect(deps.states.for(WORLD_ID).apply).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'IDLE', abandonedSetup: 's1' }),
      NOW,
    );
  });

  it('gives it too when the cleanup fails', async () => {
    deps.host.open = vi.fn(async () => {
      throw new Error('no capacity');
    });
    deps.host.close = vi.fn(async () => {
      throw new Error('api unreachable');
    });
    await runStateChange(deps, WORLD_ID, provisioning());
    expect(deps.states.for(WORLD_ID).apply).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'FAILED', abandonedSetup: 's1' }),
      NOW,
    );
  });

  // The cleanup can last half a minute, and the world does not wait for it.
  it('writes nothing when the world moved on to another session during the cleanup', async () => {
    deps.host.open = vi.fn(async () => {
      throw new Error('no capacity');
    });
    deps.states.for(WORLD_ID).readSession = vi.fn(async () =>
      provisioningSession('s2', WORLD_ID, 'enshrouded'),
    );
    await runStateChange(deps, WORLD_ID, provisioning());
    expect(deps.host.close).toHaveBeenCalledWith('s1');
    expect(deps.states.for(WORLD_ID).apply).not.toHaveBeenCalled();
    expect(deps.ledger.close).not.toHaveBeenCalled();
  });

  it('writes nothing when a member closed the session during the cleanup', async () => {
    deps.host.open = vi.fn(async () => {
      throw new Error('no capacity');
    });
    deps.states.for(WORLD_ID).readSession = vi.fn(async () => stopping());
    await runStateChange(deps, WORLD_ID, provisioning());
    expect(deps.states.for(WORLD_ID).apply).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Lancer les tests pour les voir échouer**

Run: `npx nx run @beacon/functions:test`
Expected: FAIL, `abandonedSetup` vaut `null` dans les deux premières attentes, et `apply` est appelé dans les deux dernières.

- [ ] **Step 3: Écrire le chemin d'abandon**

Créer `apps/functions/src/abandon-setup.ts` :

```ts
import type { DomainEvent, ServerHost, SessionId, WorldId } from '@beacon/session';
import type { WorldStateStores } from '@beacon/session-record';
import { expunged, type FailureSource, type PlatformJournal } from './platform-journal.js';
import type { ProvisioningLedger } from './provisioning-ledger.js';

export interface AbandonDeps {
  readonly host: ServerHost;
  readonly states: WorldStateStores;
  readonly ledger: ProvisioningLedger;
  readonly journal: PlatformJournal;
}

export interface Abandonment {
  readonly worldId: WorldId;
  readonly sessionId: SessionId;
  /** What the `ProvisioningFailed` event says. Every user reads it. */
  readonly detail: string;
  /**
   * What the host answered when the abandon is its own refusal of the opening,
   * already expunged, and null otherwise. It is what `lastError` then keeps.
   */
  readonly hostRefusal: string | null;
  /** Where a refused close is journalled from. */
  readonly cleanupSource: FailureSource;
}

/**
 * A setup that will not finish: close its server, then out of service — or
 * blocked, the one case that state exists for, when the close is refused.
 *
 * The close can last half a minute, so the record is read again after it and
 * nothing is written unless the session is still this one and still
 * preparing. A member who closed it meanwhile, or the delay that ran out,
 * already said what the world becomes.
 */
export async function abandonSetup(
  deps: AbandonDeps,
  abandonment: Abandonment,
  now: Date,
): Promise<void> {
  const { worldId, sessionId, detail, hostRefusal } = abandonment;
  const state = deps.states.for(worldId);

  let closeRefusal: string | null = null;
  try {
    await deps.host.close(sessionId);
  } catch (error) {
    closeRefusal = expunged(deps.journal, abandonment.cleanupSource, sessionId, error);
  }

  const current = await state.readSession();
  if (current === null || current.sessionId !== sessionId || current.state !== 'PROVISIONING') {
    return;
  }

  const failed: DomainEvent = { type: 'ProvisioningFailed', sessionId, detail };

  if (closeRefusal !== null) {
    await state.apply(
      {
        state: 'FAILED',
        lastError: hostRefusal ?? closeRefusal,
        clearFacts: false,
        deadline: null,
        closeIntents: [],
        abandonedSetup: sessionId,
        events: [failed, { type: 'CleanupFailed', sessionId, detail: closeRefusal }],
      },
      now,
    );
    // The intent stays open on purpose: something may still be billed, and a
    // closed intent is exactly what makes the reconciliation stop looking.
    return;
  }

  await state.apply(
    {
      state: 'IDLE',
      lastError: hostRefusal,
      clearFacts: true,
      deadline: null,
      closeIntents: [],
      abandonedSetup: sessionId,
      events: [failed],
    },
    now,
  );
  await deps.ledger.close(sessionId, now);
}
```

- [ ] **Step 4: Faire passer le refus de l'hébergeur par ce chemin**

Dans `apps/functions/src/provisioning.ts`, ajouter l'import :

```ts
import { abandonSetup } from './abandon-setup.js';
```

et remplacer la fonction `failed` entière, commentaire compris, par :

```ts
/**
 * An ordinary refusal is not FAILED (§5): clean up, say why, and the button is
 * clickable again. FAILED is kept for the one case it exists for — a cleanup
 * that could not be guaranteed.
 */
async function failed(
  deps: ProvisionDeps,
  worldId: WorldId,
  sessionId: string,
  now: Date,
  cause: unknown,
): Promise<void> {
  const detail = expunged(deps.journal, 'provisioning.setup', sessionId, cause);
  await abandonSetup(
    deps,
    { worldId, sessionId, detail, hostRefusal: detail, cleanupSource: 'provisioning.cleanup' },
    now,
  );
}
```

- [ ] **Step 5: Lancer les tests et le typecheck**

Run: `npx nx run @beacon/functions:test`
Expected: PASS, les tests d'avant compris : `cleans up and returns to IDLE when the provider refuses`, `goes to FAILED when the cleanup itself fails` et ceux de `what reaches the client-readable field`.

Run: `npx nx run-many -t typecheck -p @beacon/functions`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/functions/src/abandon-setup.ts apps/functions/src/provisioning.ts apps/functions/src/provisioning.spec.ts
bash ~/.config/github-app/as-agent.sh git commit -m "refactor(functions): sort de provisioning le chemin qui abandonne une mise en place" -m "Le chemin relit l'enregistrement après la fermeture et n'écrit que si la session est encore celle-là et encore en préparation : le refus de l'hébergeur n'écrase plus une fermeture demandée entre-temps. Il donne la session abandonnée dans sa correction." -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 6: `agentReport` abandonne sur un échec déclaré

**Files:**
- Modify: `libs/session-record/src/lib/setup-record.ts`
- Modify: `libs/session-record/src/lib/setup-record.spec.ts`
- Modify: `apps/functions/src/platform-journal.ts`
- Modify: `apps/functions/src/agent-report.ts`
- Modify: `apps/functions/src/agent-report.spec.ts`
- Modify: `apps/functions/src/provisioning.spec.ts` (le faux magasin de la mise en place)
- Modify: `deploy/companion/src/lib/restore.ts` (un commentaire)
- Modify: `deploy/companion/src/lib/agent-loop.ts` (un commentaire)

**Interfaces:**
- Consumes: `abandonSetup(deps, abandonment, now)` et `Abandonment` de `apps/functions/src/abandon-setup.ts` (tâche 5) ; `keptSetupFrom` de `libs/session-record/src/lib/fields.ts` ; `KeptSetup`, `SetupStep` de `@beacon/session`.
- Produces:
  - `SetupStore` gagne `read(): Promise<KeptSetup | null>`.
  - `JournalledFailure` gagne `readonly step?: SetupStep | null` et `readonly gameLog?: string`.
  - `runAgentReport`, sur un rapport `failed` reçu pendant qu'une session est en préparation, abandonne la mise en place et répond `{ state: 'IDLE', deadlineIso: null }`.

- [ ] **Step 1: Écrire le test qui échoue, sur le magasin**

Dans `libs/session-record/src/lib/setup-record.spec.ts`, ajouter à la fin du fichier :

```ts
describe('read', () => {
  it('reads whose setup is kept, the order of its game and the step it is on', async () => {
    await preparing('s1');
    await store.begin('s1', ORDER, OPENED);
    await store.advance('s1', { step: 'fetching-game' }, AT);

    expect(await store.read()).toEqual({
      sessionId: 's1',
      order: [...ORDER],
      step: { step: 'fetching-game', since: AT, activity: null, progress: null },
    });
  });

  it('reads nothing where no setup was ever begun', async () => {
    expect(await store.read()).toBeNull();
  });
});
```

- [ ] **Step 2: Écrire les tests qui échouent, sur le rapport**

Dans `apps/functions/src/agent-report.spec.ts`, ajouter `type KeptSetup` à l'import de `@beacon/session`, et `read` au faux magasin de la mise en place de `fakeDeps` :

```ts
  const setup = {
    begin: vi.fn(async () => undefined),
    advance: vi.fn(async (): Promise<SetupAdvance | null> => null),
    read: vi.fn(async (): Promise<KeptSetup | null> => null),
  };
```

Typer le retour de `readSession` dans le même `fakeDeps`, pour qu'un test puisse enchaîner deux lectures :

```ts
    readSession: vi.fn(async (): Promise<Session | null> => options.session ?? null),
```

Supprimer ces trois tests, que le bloc ci-dessous remplace :

- `keeps what a game server reports of its own failure out of the event` ;
- `journals nothing when the game server says nothing of its failure` ;
- `files what the machine says went wrong, while it is still provisioning`, avec le commentaire de deux lignes qui le précède.

Ajouter dans `describe('agentReport', …)`, après le bloc `describe('the fields the frontier discarded', …)` :

```ts
  // The default session in `deps` is PROVISIONING: a game server that says it
  // cannot finish is believed, and its setup is abandoned at once.
  describe('a game server that says it cannot finish its setup', () => {
    const FAILED = {
      sessionId: 's1',
      phase: 'failed',
      detail: 'restore refused: the bucket did not answer',
    } as const;
    const STAND_DOWN = { state: 'IDLE', deadlineIso: null };

    const corrections = () =>
      (deps.store.apply as ReturnType<typeof vi.fn>).mock.calls.map((call) => call[0]);

    it('closes the server, goes out of service and gives the abandoned session', async () => {
      await runAgentReport(deps, TOKEN, FAILED);

      expect(deps.host.close).toHaveBeenCalledWith('s1');
      expect(corrections()).toHaveLength(1);
      expect(corrections()[0]).toMatchObject({
        state: 'IDLE',
        clearFacts: true,
        lastError: null,
        abandonedSetup: 's1',
      });
      expect(deps.ledger.close).toHaveBeenCalledWith('s1', NOW);
    });

    it('files one event, whose detail is a fixed sentence', async () => {
      await runAgentReport(deps, TOKEN, FAILED);

      expect(filed(deps)).toEqual([
        {
          type: 'ProvisioningFailed',
          sessionId: 's1',
          detail: 'the game server said it could not finish its setup',
        },
      ]);
    });

    it('is blocked when the close is refused, and keeps what the host answered to it', async () => {
      deps.host.close = vi.fn(async () => {
        throw new Error('api unreachable');
      });

      await runAgentReport(deps, TOKEN, FAILED);

      expect(corrections()[0]).toMatchObject({
        state: 'FAILED',
        clearFacts: false,
        abandonedSetup: 's1',
      });
      expect(corrections()[0].lastError).toContain('api unreachable');
      expect(filed(deps).map((event) => event.type)).toEqual([
        'ProvisioningFailed',
        'CleanupFailed',
      ]);
      expect(deps.ledger.close).not.toHaveBeenCalled();
      expect(deps.journal.failure).toHaveBeenCalledWith({
        source: 'agentReport.cleanup',
        sessionId: 's1',
        error: 'Error: api unreachable',
      });
    });

    it('tells the game server to stand down, whatever came of the close', async () => {
      expect(await runAgentReport(deps, TOKEN, FAILED)).toEqual(STAND_DOWN);

      deps = fakeDeps({ session: provisioningSession('s1') });
      deps.host.close = vi.fn(async () => {
        throw new Error('api unreachable');
      });
      expect(await runAgentReport(deps, TOKEN, FAILED)).toEqual(STAND_DOWN);
    });

    // The close can last half a minute, and the world does not wait for it.
    it('writes nothing when the world moved on to another session during the close', async () => {
      deps.store.readSession
        .mockResolvedValueOnce(provisioningSession('s1'))
        .mockResolvedValueOnce(provisioningSession('s2'));

      expect(await runAgentReport(deps, TOKEN, FAILED)).toEqual(STAND_DOWN);

      expect(deps.host.close).toHaveBeenCalledWith('s1');
      expect(deps.store.apply).not.toHaveBeenCalled();
      expect(deps.ledger.close).not.toHaveBeenCalled();
    });

    it('writes nothing when a member closed the session during the close', async () => {
      deps.store.readSession
        .mockResolvedValueOnce(provisioningSession('s1'))
        .mockResolvedValueOnce(stoppingSession('s1'));

      await runAgentReport(deps, TOKEN, FAILED);

      expect(deps.store.apply).not.toHaveBeenCalled();
    });

    // What an abandon leaves is a world out of service, which names no session.
    it('stands a second report down once the setup is abandoned, and does nothing more', async () => {
      deps = fakeDeps({ session: Session.idle() });

      expect(await runAgentReport(deps, TOKEN, FAILED)).toEqual(STAND_DOWN);

      expect(deps.host.close).not.toHaveBeenCalled();
      expect(deps.store.apply).not.toHaveBeenCalled();
    });

    describe('what it leaves in the platform journal', () => {
      const KEPT: KeptSetup = {
        sessionId: 's1',
        order: ['waking', 'restoring-world', 'fetching-game', 'starting-game'],
        step: { step: 'fetching-game', since: NOW, activity: null, progress: null },
      };

      it('is the whole cause, the step reached and the end of the game output', async () => {
        deps.setup.read.mockResolvedValue(KEPT);

        await runAgentReport(deps, TOKEN, { ...FAILED, gameLog: 'line 1\nline 2' });

        expect(deps.journal.failure).toHaveBeenCalledWith({
          source: 'agentReport.machine',
          sessionId: 's1',
          error: 'restore refused: the bucket did not answer',
          step: 'fetching-game',
          gameLog: 'line 1\nline 2',
        });
      });

      it('names no step when what is kept belongs to another session', async () => {
        deps.setup.read.mockResolvedValue({ ...KEPT, sessionId: 's0' });

        await runAgentReport(deps, TOKEN, FAILED);

        expect(deps.journal.failure).toHaveBeenCalledWith({
          source: 'agentReport.machine',
          sessionId: 's1',
          error: 'restore refused: the bucket did not answer',
          step: null,
        });
      });

      it('names no step, and abandons all the same, when the kept setup cannot be read', async () => {
        deps.setup.read.mockRejectedValue(new Error('firestore unavailable'));

        await runAgentReport(deps, TOKEN, FAILED);

        expect(deps.journal.failure).toHaveBeenCalledWith(
          expect.objectContaining({ source: 'agentReport.machine', step: null }),
        );
        expect(corrections()[0]).toMatchObject({ state: 'IDLE', abandonedSetup: 's1' });
      });

      it('says so when the game server said nothing of its failure', async () => {
        await runAgentReport(deps, TOKEN, { sessionId: 's1', phase: 'failed' });

        expect(deps.journal.failure).toHaveBeenCalledWith({
          source: 'agentReport.machine',
          sessionId: 's1',
          error: 'the machine reported a failure without saying which',
          step: null,
        });
      });
    });

    // An event and `lastError` are read by members, and the output of a game
    // carries what the system entrusted to its server.
    it('keeps everything the game server wrote out of every write', async () => {
      const secret = 'a'.repeat(64);

      await runAgentReport(deps, TOKEN, {
        sessionId: 's1',
        phase: 'failed',
        detail: `restore refused: AWS_SECRET_ACCESS_KEY=${secret}`,
        gameLog: `server password ${secret}`,
      });

      const written = JSON.stringify((deps.store.apply as ReturnType<typeof vi.fn>).mock.calls);
      expect(written).not.toContain(secret);
      expect(written).not.toContain('restore refused');
      expect(written).not.toContain('server password');
      expect(deps.journal.failure).toHaveBeenCalledWith(
        expect.objectContaining({
          error: `restore refused: AWS_SECRET_ACCESS_KEY=${secret}`,
          gameLog: `server password ${secret}`,
        }),
      );
    });

    it('keeps the step the failed report declares before it abandons', async () => {
      await runAgentReport(deps, TOKEN, { ...FAILED, setup: { step: 'starting-game' } });

      expect(deps.setup.advance).toHaveBeenCalledWith('s1', { step: 'starting-game' }, NOW);
      expect(deps.setup.advance.mock.invocationCallOrder[0]).toBeLessThan(
        deps.setup.read.mock.invocationCallOrder[0],
      );
    });
  });
```

Dans `apps/functions/src/provisioning.spec.ts`, le faux magasin de la mise en place gagne `read` :

```ts
  const setup = {
    begin: vi.fn(async () => undefined),
    advance: vi.fn(async () => null),
    read: vi.fn(async () => null),
  };
```

- [ ] **Step 3: Lancer les tests pour les voir échouer**

Run: `npx nx run @beacon/session-record:test`
Expected: FAIL, `store.read is not a function`.

Run: `npx nx run @beacon/functions:test`
Expected: FAIL, les tests du nouveau bloc échouent : `host.close` n'est pas appelé et la correction porte `state: null`.

- [ ] **Step 4: Écrire la lecture du magasin**

Dans `libs/session-record/src/lib/setup-record.ts`, ajouter `type KeptSetup` à l'import de `@beacon/session` et `keptSetupFrom` à celui de `./fields.js`. Ajouter à `SetupStore`, après `advance` :

```ts
  /** What is kept, whichever session it belongs to. Null when no setup reads from it. */
  read(): Promise<KeptSetup | null>;
```

et à l'objet que `for` rend, après `advance` :

```ts
        async read(): Promise<KeptSetup | null> {
          return keptSetupFrom((await setupDoc().get()).data() ?? {});
        },
```

- [ ] **Step 5: Écrire l'entrée du journal de la plateforme**

Dans `apps/functions/src/platform-journal.ts`, `JournalledFailure` devient :

```ts
export interface JournalledFailure {
  readonly source: FailureSource;
  /** Null when no session explains the failure, as in a sweep. */
  readonly sessionId: SessionId | null;
  /** The failure as it was received: nothing bounded, nothing masked. */
  readonly error: string;
  /**
   * The step a setup had reached when its game server declared it could not
   * finish, and null when none is kept for its session. Absent on every other
   * failure.
   */
  readonly step?: SetupStep | null;
  /** The last lines the game printed, as the game server sent them. This journal is the one place they are written. */
  readonly gameLog?: string;
}
```

- [ ] **Step 6: Écrire l'abandon déclaré**

Dans `apps/functions/src/agent-report.ts`, ajouter `type SetupStep` à l'import de `@beacon/session`, et l'import :

```ts
import { abandonSetup } from './abandon-setup.js';
```

Dans `runAgentReport`, la ligne de la phase `failed` devient :

```ts
  if (report.phase === 'failed') {
    if (session.state === 'PROVISIONING') {
      await abandonDeclaredSetup(deps, worldId, report, now);
      // Whatever came of the close: this server has nothing left to do, and
      // an agent told to stand down stops reporting.
      return STAND_DOWN;
    }
    await fileFailure(deps, state, report, now);
  }
```

Ajouter, au-dessus de `fileFailure` :

```ts
/** What every user reads of a declared abandon: a fixed sentence, and nothing a game server wrote. */
const DECLARED_ABANDON = 'the game server said it could not finish its setup';

const UNEXPLAINED_FAILURE = 'the machine reported a failure without saying which';

/**
 * A game server that says it cannot finish its setup is believed, and nothing
 * else is checked: it is the only one that knows why it fails. The world is
 * the one the function recorded at the opening, never one the report names.
 *
 * What it wrote — its cause, the end of the game's output — goes whole to the
 * platform journal and nowhere else: neither the event nor `lastError` keeps
 * any of it.
 */
async function abandonDeclaredSetup(
  deps: AgentReportDeps,
  worldId: WorldId,
  report: AgentReport,
  now: Date,
): Promise<void> {
  const sessionId = report.sessionId;
  deps.journal.failure({
    source: 'agentReport.machine',
    sessionId,
    error: report.detail ?? UNEXPLAINED_FAILURE,
    step: await reachedStep(deps, worldId, sessionId),
    ...(report.gameLog === undefined ? {} : { gameLog: report.gameLog }),
  });
  await abandonSetup(
    deps,
    {
      worldId,
      sessionId,
      detail: DECLARED_ABANDON,
      hostRefusal: null,
      cleanupSource: 'agentReport.cleanup',
    },
    now,
  );
}

/** Only ever journalled, so a store that fails here must not cost the abandon. */
async function reachedStep(
  deps: AgentReportDeps,
  worldId: WorldId,
  sessionId: SessionId,
): Promise<SetupStep | null> {
  try {
    const kept = await deps.setups.for(worldId).read();
    return kept !== null && kept.sessionId === sessionId ? kept.step.step : null;
  } catch {
    return null;
  }
}
```

Remplacer `fileFailure` entière, commentaire compris, par :

```ts
/**
 * A failure reported outside the preparation — a crashed game process, a
 * failed push. It did not fail to *provision*, whatever else it failed at, and
 * it ends nothing: one audit line, and the session goes on.
 */
async function fileFailure(
  deps: AgentReportDeps,
  state: ServerStateStore,
  report: AgentReport,
  now: Date,
): Promise<void> {
  const sessionId = report.sessionId;
  const detail =
    report.detail === undefined
      ? UNEXPLAINED_FAILURE
      : expunged(deps.journal, 'agentReport.machine', sessionId, report.detail);
  await fileEvent(state, now, { type: 'AgentReportedFailure', sessionId, detail });
}
```

- [ ] **Step 7: Récrire les deux commentaires du compagnon que ce changement rend faux**

Dans `deploy/companion/src/lib/restore.ts`, le commentaire de `tell` devient :

```ts
/**
 * Best effort, and deliberately swallowed: the control plane not hearing why is
 * bad, and this process staying alive to say so would be worse. A report that
 * arrives makes the control plane abandon the setup at once; one that is lost
 * leaves the session to the provisioning delay.
 */
```

Dans `deploy/companion/src/lib/agent-loop.ts`, dans le commentaire de `readyOutcome`, la phrase `No match, no publish — the session then dies of the provisioning deadline instead, with a legible reason.` devient, recoupée à la largeur du commentaire :

```ts
 * machine* restored. No match, no publish — the report makes the control
 * plane abandon the setup instead, with a legible reason.
```

- [ ] **Step 8: Lancer les tests et le typecheck**

Run: `npx nx run @beacon/session-record:test`
Expected: PASS

Run: `npx nx run @beacon/functions:test`
Expected: PASS, dont `files an operational failure, not a provisioning one, once the machine is running` et `keeps what a running game server reports out of the event too`, inchangés.

Run: `npx nx run companion:test`
Expected: un seul échec, `names an image built from the sources in the tree`.

Run: `npx nx run-many -t typecheck lint -p @beacon/session-record @beacon/functions companion`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add libs/session-record/src/lib/setup-record.ts libs/session-record/src/lib/setup-record.spec.ts apps/functions/src/platform-journal.ts apps/functions/src/agent-report.ts apps/functions/src/agent-report.spec.ts apps/functions/src/provisioning.spec.ts deploy/companion/src/lib/restore.ts deploy/companion/src/lib/agent-loop.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(functions): abandonne la mise en place dès que le serveur de jeu déclare ne pas pouvoir la finir" -m "La cause entière, l'étape atteinte et la fin de la sortie du jeu vont au journal de la plateforme, et nulle part ailleurs : l'événement porte une phrase fixe. Le serveur reçoit l'ordre de s'arrêter quelle que soit l'issue de la fermeture." -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 7: Les écrans hors service et bloqué montrent où la mise en place s'est arrêtée

**Files:**
- Modify: `apps/web/src/app/format.ts`
- Modify: `apps/web/src/app/format.spec.ts`
- Modify: `apps/web/src/app/session/out-of-service.component.ts`
- Modify: `apps/web/src/app/session/out-of-service.component.spec.ts`
- Modify: `apps/web/src/app/session/not-cleared.component.ts`
- Modify: `apps/web/src/app/session/not-cleared.component.spec.ts`
- Modify: `apps/web/src/styles.css`

**Interfaces:**
- Consumes: `ShownSetup.abandonedAt` et `setupStepRank` de `@beacon/session` (tâche 1) ; `ServerView.setup` (tâche 3) ; `stepLabel` et `hourLabel` de `apps/web/src/app/format.ts`.
- Produces, exportés par `apps/web/src/app/format.ts` :
  - `interface StoppedAt { readonly at: string; readonly rank: number; readonly total: number; readonly name: string }`
  - `stoppedAt(shown: ShownSetup | null): StoppedAt | null`

Avant de modifier un fichier de `apps/web`, invoquer la skill `impeccable:impeccable` et lire sa référence `craft-floor`. La planche à transcrire est « Après un échec déclaré par la machine », dans `.impeccable/mocks/progress/desktop.html` et `.impeccable/mocks/progress/phone.html`. Cette tâche ne dessine rien que la planche ne porte.

- [ ] **Step 1: Écrire les tests qui échouent, sur la mise en forme**

Dans `apps/web/src/app/format.spec.ts`, ajouter `stoppedAt` à l'import de `./format`, puis ajouter à la fin du fichier :

```ts
describe('stoppedAt', () => {
  const step = (name: 'waking' | 'fetching-game') => ({
    step: name,
    since: new Date('2026-09-12T20:16:00'),
    activity: null,
    progress: null,
  });

  it('says the hour, the rank in the order of the game and the name of the step', () => {
    expect(
      stoppedAt({
        step: step('fetching-game'),
        order: ['waking', 'restoring-world', 'fetching-game', 'starting-game'],
        abandonedAt: new Date('2026-09-12T20:19:00'),
      }),
    ).toEqual({ at: '20:19', rank: 3, total: 4, name: 'Getting the game' });
  });

  it('ranks the first step first when no order is known', () => {
    expect(
      stoppedAt({
        step: step('waking'),
        order: null,
        abandonedAt: new Date('2026-09-12T20:19:00'),
      }),
    ).toEqual({ at: '20:19', rank: 1, total: 4, name: 'Waking the server' });
  });

  it('says nothing of a setup under way, nor of none', () => {
    expect(stoppedAt({ step: step('waking'), order: null, abandonedAt: null })).toBeNull();
    expect(stoppedAt(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Écrire les tests qui échouent, sur l'écran hors service**

Dans `apps/web/src/app/session/out-of-service.component.spec.ts`, l'import de `@beacon/session` et `render` deviennent :

```ts
import { DEFAULT_SETTINGS, Session, type ShownSetup } from '@beacon/session';
```

```ts
  const render = async (lastError: string | null = null, setup: ShownSetup | null = null) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: CLOCK, useValue: clock }] });
    const fixture = TestBed.createComponent(OutOfServiceComponent);
    fixture.componentRef.setInput('view', {
      session: Session.idle(),
      facts: { ip: null, joinInfo: null, lastError },
      stateSince: null,
      setup,
    });
    fixture.componentRef.setInput('settings', DEFAULT_SETTINGS);
    await fixture.whenStable();
    return fixture;
  };
```

Ajouter dans `describe('OutOfServiceComponent', …)`, après le bloc `describe('after a refusal', …)` :

```ts
  describe('after an abandoned setup', () => {
    const STOPPED: ShownSetup = {
      step: {
        step: 'fetching-game',
        since: new Date('2026-09-12T20:16:00'),
        activity: 'downloading',
        progress: 37,
      },
      order: ['waking', 'restoring-world', 'fetching-game', 'starting-game'],
      abandonedAt: new Date('2026-09-12T20:19:00'),
    };

    const stopped = (fixture: Awaited<ReturnType<typeof render>>): HTMLElement | null =>
      fixture.nativeElement.querySelector('[data-field="stopped-at"]');

    it('says where the setup stopped, and at what hour', async () => {
      const text = stopped(await render(null, STOPPED))?.textContent ?? '';
      expect(text).toContain('Where it stopped, at 20:19');
      expect(text).toContain('Step 3 of 4');
      expect(text).toContain('Getting the game');
    });

    // What the step was doing when it stopped is not where it stopped.
    it('says neither the activity nor the progress the step had reached', async () => {
      const text: string = (await render(null, STOPPED)).nativeElement.textContent;
      expect(text).not.toContain('Downloading');
      expect(text).not.toContain('37');
    });

    it('takes the title and the button of a start that failed, with no host to quote', async () => {
      const fixture = await render(null, STOPPED);
      expect(fixture.nativeElement.textContent).toContain('didn’t start');
      expect(fixture.nativeElement.textContent).toContain('nothing is costing');
      expect(fixture.nativeElement.querySelector('[data-action="open"]').textContent).toContain(
        'Try again',
      );
      expect(fixture.nativeElement.querySelector('[data-field="host-said"]')).toBeNull();
    });

    it('still quotes the host when there is something to quote', async () => {
      const fixture = await render('provisioning did not finish in time', STOPPED);
      expect(stopped(fixture)).not.toBeNull();
      expect(
        fixture.nativeElement.querySelector('[data-field="host-said"]').textContent,
      ).toContain('provisioning did not finish in time');
    });

    it('shows the first step, ranked first, when no order of the game is known', async () => {
      const text =
        stopped(
          await render(null, {
            step: {
              step: 'waking',
              since: new Date('2026-09-12T20:14:00'),
              activity: null,
              progress: null,
            },
            order: null,
            abandonedAt: new Date('2026-09-12T20:19:00'),
          }),
        )?.textContent ?? '';
      expect(text).toContain('Step 1 of 4');
      expect(text).toContain('Waking the server');
    });

    it('says nothing of it on a world that abandoned no setup', async () => {
      expect(stopped(await render())).toBeNull();
      expect(stopped(await render('no capacity left'))).toBeNull();
    });
  });
```

- [ ] **Step 3: Écrire les tests qui échouent, sur l'écran bloqué**

Dans `apps/web/src/app/session/not-cleared.component.spec.ts`, l'import de `@beacon/session` et la signature de `render` deviennent :

```ts
import { DEFAULT_SETTINGS, Deadline, Session, type ShownSetup } from '@beacon/session';
```

```ts
  const render = async (
    lastError: string | null = 'the machine will not delete',
    setup: ShownSetup | null = null,
  ) => {
```

et, dans le corps de `render`, `setup: null,` devient `setup,`. Ajouter à la fin de `describe('NotClearedComponent', …)` :

```ts
  it('says where an abandoned setup stopped, and at what hour', async () => {
    const fixture = await render('api unreachable', {
      step: {
        step: 'restoring-world',
        since: new Date('2026-09-12T20:16:00'),
        activity: null,
        progress: null,
      },
      order: ['waking', 'fetching-game', 'restoring-world', 'starting-game'],
      abandonedAt: new Date('2026-09-12T20:19:00'),
    });
    const text = fixture.nativeElement.querySelector('[data-field="stopped-at"]').textContent;
    expect(text).toContain('Where it stopped, at 20:19');
    expect(text).toContain('Step 3 of 4');
    expect(text).toContain('Bringing your world back');
    expect(fixture.nativeElement.textContent).toContain('api unreachable');
  });

  it('says nothing of it when what was left behind is not an abandoned setup', async () => {
    expect((await render()).nativeElement.querySelector('[data-field="stopped-at"]')).toBeNull();
  });
```

- [ ] **Step 4: Lancer les tests pour les voir échouer**

Run: `npx nx run web:test`
Expected: FAIL, `stoppedAt` n'existe pas et aucun élément ne porte `data-field="stopped-at"`.

- [ ] **Step 5: Écrire la mise en forme**

Dans `apps/web/src/app/format.ts`, l'import de `@beacon/session` devient :

```ts
import {
  SETUP_STEPS,
  setupStepRank,
  type Game,
  type SessionState,
  type SetupActivity,
  type SetupStep,
  type ShownSetup,
  type World,
} from '@beacon/session';
```

Ajouter après `activityLabel` :

```ts
/** Where an abandoned setup stopped, in the board's own words. */
export interface StoppedAt {
  readonly at: string;
  readonly rank: number;
  readonly total: number;
  readonly name: string;
}

/**
 * Null for a setup under way and for none at all. The step alone: what it was
 * doing when it stopped, and how far it had got, is not where it stopped.
 */
export function stoppedAt(shown: ShownSetup | null): StoppedAt | null {
  if (shown === null || shown.abandonedAt === null) return null;
  return {
    at: hourLabel(shown.abandonedAt),
    rank: setupStepRank(shown),
    total: SETUP_STEPS.length,
    name: stepLabel(shown.step.step),
  };
}
```

- [ ] **Step 6: Écrire l'écran hors service**

Dans `apps/web/src/app/session/out-of-service.component.ts`, l'import de `../format` devient :

```ts
import { euroLabel, hourLabel, stoppedAt } from '../format';
```

Le commentaire de la classe devient :

```ts
/**
 * The screen most often seen, and the one a start that failed comes back to.
 * A creation the provider refuses, or a setup that is abandoned, is cleaned up
 * and returns to `IDLE`, the button clickable at once. That is not a sixth
 * state — it is this screen with a warning, and one word different on the
 * button.
 *
 * Where the setup stopped is a step and an hour, and nothing a game server
 * wrote. What the host said is quoted only when the host said something.
 */
```

Dans le gabarit, le premier bloc `@if (refusal(); as refusal) { … } @else { … }`, celui du titre, devient :

```html
          @if (stopped() !== null) {
            <div class="big sm">It didn’t start.</div>
            <div class="sub">
              Nothing was left running, and nothing is costing anything. Press again; if it stops
              at the same step twice, tell whoever runs this.
            </div>
          } @else if (refusal() !== null) {
            <div class="big sm">It didn’t start.</div>
            <div class="sub">
              Nothing was left running, and nothing is costing anything. Press again — a refusal
              one minute is usually gone the next.
            </div>
          } @else {
            <div class="big">Nothing is running.</div>
            <div class="sub">It closed itself, which is the whole idea.</div>
          }
```

Ajouter, juste avant le bloc `@if (refusal(); as refusal) { <div class="warn"> …` :

```html
      @if (stopped(); as stopped) {
        <div class="warn" data-field="stopped-at">
          <span class="k" data-warn>Where it stopped, at {{ stopped.at }}</span>
          <div class="said">
            <b>Step {{ stopped.rank }} of {{ stopped.total }}</b> · {{ stopped.name }}
          </div>
        </div>
      }
```

Le libellé du bouton devient :

```html
            {{ didNotStart() ? 'Try again' : 'Open the service' }}
```

Dans la classe, ajouter après `refusal` :

```ts
  readonly stopped = computed(() => stoppedAt(this.view().setup));

  readonly didNotStart = computed(() => this.refusal() !== null || this.stopped() !== null);
```

- [ ] **Step 7: Écrire l'écran bloqué**

Dans `apps/web/src/app/session/not-cleared.component.ts`, l'import de `../format` devient :

```ts
import { euroLabel, hourLabel, stoppedAt } from '../format';
```

Ajouter dans le gabarit, juste avant le bloc `@if (refusal(); as refusal) {` :

```html
      @if (stopped(); as stopped) {
        <div class="warn" data-field="stopped-at">
          <span class="k" data-warn>Where it stopped, at {{ stopped.at }}</span>
          <div class="said">
            <b>Step {{ stopped.rank }} of {{ stopped.total }}</b> · {{ stopped.name }}
          </div>
        </div>
      }
```

et dans la classe, après `refusal` :

```ts
  readonly stopped = computed(() => stoppedAt(this.view().setup));
```

- [ ] **Step 8: Donner au rang la graisse de la planche**

Dans `apps/web/src/styles.css`, ajouter après la règle `.warn .said { … }` :

```css
.warn .said b {
  font-weight: 700;
}
```

- [ ] **Step 9: Lancer les tests, le lint et le typecheck**

Run: `npx nx run web:test`
Expected: PASS

Run: `npx nx run-many -t typecheck lint -p web`
Expected: PASS

- [ ] **Step 10: Inspecter une fois contre la planche**

Rendre l'écran hors service après un abandon à 1440 px et à 390 px, et le comparer à la planche « Après un échec déclaré par la machine » de `.impeccable/mocks/progress/desktop.html` et de `phone.html`. Corriger en un lot ce que la comparaison montre, puis confirmer par une seconde comparaison au plus. Un écart qui demande un choix que la planche ne porte pas se rapporte, et ne se tranche pas ici.

- [ ] **Step 11: Vérifier la branche entière**

Run: `npx nx run-many -t test -p @beacon/session @beacon/session-record @beacon/rules @beacon/functions web`
Expected: PASS

Run: `npx nx run-many -t typecheck lint -p @beacon/session @beacon/session-record @beacon/rules @beacon/functions web companion`
Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add apps/web/src/app/format.ts apps/web/src/app/format.spec.ts apps/web/src/app/session/out-of-service.component.ts apps/web/src/app/session/out-of-service.component.spec.ts apps/web/src/app/session/not-cleared.component.ts apps/web/src/app/session/not-cleared.component.spec.ts apps/web/src/styles.css
bash ~/.config/github-app/as-agent.sh git commit -m "feat(web): montre l'étape et l'heure auxquelles une mise en place s'est arrêtée" -m "L'écran dit l'étape et son rang, jamais l'activité ni l'avancement qu'elle avait atteints, ni rien qu'un serveur de jeu a écrit." -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

## Before the merge

Cette story change `libs/session` et `deploy/companion/src`, que l'image du compagnon embarque. `companion:test` reste rouge sur `names an image built from the sources in the tree` tant que l'image n'est pas republiée.

Une fois la revue accordée et les `fixup!` écrasés :

1. Le commanditaire pose le tag `companion-v0.12` sur la tête de la branche et le pousse. Le workflow `companion` publie l'image.
2. `npx nx run companion:pin -- 0.12` récrit `deploy/cloud-init/src/lib/companion-image.ts`.
3. Le changement est commité sous `build(cloud-init): épingle le compagnon 0.12` et poussé.
4. `npx nx run companion:test` passe.

Un commit qui touche `libs/session`, `libs/agent-protocol`, `libs/scaleway-storage` ou `deploy/companion/src` après le tag demande un nouveau tag.

## Rulings log

Ruling: cette story prend l'abandon avant la fourchette tirée des mises en place abouties — le compagnon envoie déjà la fin de la sortie du jeu sans que rien la lise, et le lot n'ordonne pas ces deux blocs — si c'est faux, la fourchette fixe reste à l'écran une story de plus.

Ruling: deux fixtures `ShownSetup` de plus reçoivent `abandonedAt: null` dans `preparing.component.spec.ts` — le plan n'en nommait que deux, et `web:test` ne compilait pas sans — si c'est faux, deux lignes de test hors de la liste de la tâche.

Ruling: les tâches 6 et 7 sont acceptées sans exécution rouge de leurs tests — leurs implémenteurs ont écrit tests et code avant le premier lancement, et rejouer le rouge demande de défaire leur commit — si c'est faux, un test de ces deux tâches passerait aussi sans le code, ce que leurs revues et celle de la branche n'ont pas relevé.

Ruling: `reachedStep` écrit au journal de la plateforme, sous la source `agentReport.setup`, l'échec de lecture du magasin — le plan mandatait un `catch` nu, et une étape nulle ne distinguait plus une lecture en panne d'une mise en place absente — si c'est faux, une entrée de journal de trop à chaque abandon dont la lecture échoue.

Ruling: deux rapports `failed` reçus pendant la fermeture peuvent classer deux fois `ProvisioningFailed` — l'abandon relit l'enregistrement puis écrit sans transaction, comme la fermeture d'une session en service — si c'est faux, un événement en double dans le journal pour un seul abandon.

Ruling: un rapport `failed` reçu en préparation après un rapport `ready` que le plan de contrôle n'a pas publié abandonne sous la phrase d'un abandon déclaré — le lot prend déjà le risque que tout rapport `failed` reçu en préparation abandonne — si c'est faux, le journal des événements dit qu'un serveur n'a pas pu finir sa mise en place alors qu'il l'avait finie.

Ruling: `shownSetup` montre une mise en place abandonnée dans tout état hors de la préparation, `RUNNING` et `STOPPING` compris, quand la marque porte la dernière session ouverte — le design ne restreint pas les états, et les écrans de ces deux états ne lisent pas ce champ — si c'est faux, un écran qui se mettrait à le lire montrerait un abandon sur une session en service née d'une course entre le délai et un rapport `ready`.

Ruling: l'écran hors service après un abandon garde ce que l'écran d'un refus porte déjà, et non ce que la planche montre : le titre en `big sm`, la phrase sous le bouton, et sur téléphone le bloc d'avertissement après la plaque — la planche dessine un écran entier, et cette story n'y ajoute qu'un bloc — si c'est faux, trois réglages de mise en page à reprendre sur cet écran.

Ruling: un abandon au délai dont la fermeture est refusée classe `ProvisioningFailed` puis `CleanupFailed`, comme l'abandon déclaré et le refus de l'hébergeur, là où `main` ne classait que `CleanupFailed` — le commanditaire demande à la revue de prendre dans cette story ce qui peut l'être — si c'est faux, un événement de trop par abandon bloqué.

Ruling: les mots que la planche pose entrent tels quels à l'écran, `Where it stopped, at HH:MM`, `Step N of 4` suivi du nom de l'étape, et `Press again; if it stops at the same step twice, tell whoever runs this.` — le commanditaire les valide à la revue, alors que `.impeccable/mocks/progress/README.md` les range encore sous ce qui reste à valider — si c'est faux, trois libellés à changer dans les deux gabarits.

Open ruling: un rendu statique de l'écran hors service, à 1440 et à 390 px, sans l'enveloppe de l'application, tient lieu de passe d'inspection contre la planche — l'application ne se sert pas sans émulateur ni connexion — si c'est faux, un écart que seul le gabarit Angular produit n'est vu qu'à la revue — reste à trancher : à 390 px la valeur de la plaque paraît rognée dans ce rendu, à regarder dans l'application. Le commanditaire le laisse ouvert à la revue : à regarder ensemble, sans doute dans un lot de tests d'intégration sur l'émulateur.

Technical design ruling: le magasin de la mise en place gagne un troisième geste, lire — le design n'en nomme que deux, et l'étape atteinte doit se lire quand le rapport `failed` ne porte pas `setup`, comme celui de la restauration — si c'est faux, un geste de lecture de trop sur ce magasin.

Technical design ruling: `shownSetup` reçoit la dernière session ouverte lue du document, `LastOpening`, et non la session — une session hors service ne nomme ni identifiant ni heure d'ouverture — si c'est faux, le record lit deux fois les mêmes champs de `server/current`.

Technical design ruling: le chemin d'abandon reçoit la réponse de l'hébergeur au refus de l'ouverture, ou rien, au lieu de deux valeurs de `lastError` — les deux appelants ne diffèrent que par là, et une fermeture refusée garde alors ce que l'hébergeur lui a répondu — si c'est faux, un troisième appelant qui veut un autre `lastError` change la signature.

Technical design ruling: `ShownSetup` porte l'heure de l'abandon dans un champ `abandonedAt`, nul pendant la préparation — le design dit que `ServerView` gagne ce que `shownSetup` rend, sans en donner la forme — si c'est faux, un écran distingue les deux cas par un champ nul plutôt que par un type.

Technical design ruling: les deux écrans répètent le bloc `Where it stopped` de leur gabarit, et ne partagent que `stoppedAt` dans `format.ts` — ils répètent déjà ainsi le bloc `What the host said` — si c'est faux, un changement de ce bloc se fait deux fois.

Technical design ruling: le commentaire de `preparing.component.ts` sur l'ancienne contrainte d'interface, et ceux de `client-session.ts` sur `stateSince`, ne changent pas — la story de l'étape affichée a récrit le premier, et les seconds vont avec la fourchette — si c'est faux, deux commentaires restent à récrire avec la fourchette.

## Observed drift

Le watchdog applique sa correction sans relire l'enregistrement : un abandon déclaré qui arrive entre sa lecture et son écriture, sur une session passée le délai, reçoit un second `ProvisioningFailed`, une heure d'abandon plus tardive et la phrase du délai. Le corriger demande de dire ce qu'une correction périmée garde de ses événements, donc une règle du watchdog : à proposer au registre à la clôture du lot.
