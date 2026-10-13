# L'étape affichée Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pendant la mise en place d'une session, l'écran affiche l'étape en cours, son rang sur quatre, l'heure à laquelle elle a commencé, et l'avancement et l'activité quand le serveur de jeu en déclare.

**Architecture:** `libs/session` décide de ce que l'écran montre d'une mise en place par la fonction pure `shownSetup`, et donne le rang d'une étape dans l'ordre du jeu. `libs/session-record` lit `worlds/{worldId}/server/setup` à côté de `server/current` et publie ce que `shownSetup` rend dans `ServerView`. `preparing.component.ts` prend la forme de la variante C de `.impeccable/mocks/progress/`, avec les mots des étapes et des activités dans `apps/web`.

**Tech Stack:** TypeScript, Angular, Vitest, émulateur Firestore, Nx.

**Spec:** docs/specs/session.md
**Batch:** docs/batches/03-progression-de-la-mise-en-place/README.md
**Sections:** Opening a session
**Blocks:** D2

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

`apps/functions`, `deploy/`, `firestore.rules`, `libs/agent-protocol` et `probe/` ne changent pas.

`out-of-service.component.ts` et `not-cleared.component.ts` ne changent pas : cette story ne montre rien d'une mise en place abandonnée.

`readyWindow` et `BOOT_WINDOW_MS` restent dans `apps/web/src/app/format.ts`, et la fourchette part toujours de `stateSince`.

Les mots que l'écran affiche d'une étape ou d'une activité viennent de `apps/web`, à partir d'une valeur de `SETUP_STEPS` ou de `SETUP_ACTIVITIES` : aucun texte venu d'un serveur de jeu n'atteint l'écran.

`apps/web` n'importe aucun SDK Firebase et ne nomme aucun champ de document.

Aucune tâche ne modifie `deploy/cloud-init/src/lib/companion-image.ts`, ne lance `companion:pin`, ni ne pose de tag git.

À partir de la tâche 1, `companion:test` échoue sur le seul test `names an image built from the sources in the tree` de `deploy/companion/src/pin/catalogue-pin.spec.ts`. Cet échec est attendu jusqu'à l'épinglage décrit sous `Before the merge`, et aucune tâche ne le corrige.

Aucune commande n'atteint la production : ni `firebase deploy`, ni appel à un fournisseur, ni tag git. Les tests tournent contre l'émulateur.

### Les commandes

Les tests se lancent par Nx, un projet à la fois :

```bash
npx nx run @beacon/session:test
npx nx run @beacon/session-record:test
npx nx run web:test
```

`@beacon/session-record:test` démarre l'émulateur Firestore lui-même.

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

- Un avancement de 0 s'affiche `0 %` et remplit la longueur en cours à 0 %, sans la longueur qui passe. Tâche 3.
- Un `server/setup` que les règles refusent de lire laisse le monde se publier, sur la première étape. Tâche 2.
- Un `server/setup` resté sur la session précédente, pendant qu'une nouvelle se met en place, donne la première étape depuis l'ouverture et non l'étape de l'ancienne. Tâches 1 et 2.
- Un `server/setup` dont l'ordre des étapes est mal formé donne la première étape, sans ordre. Tâche 2.
- Une étape déclarée en arrière fait redescendre le rang et les longueurs parcourues. Tâche 3.

---

### Task 1: Ce que l'écran montre d'une mise en place, dans le domaine

**Files:**
- Modify: `libs/session/src/lib/setup.ts`
- Modify: `libs/session/src/lib/setup.spec.ts`

**Interfaces:**
- Consumes: `KeptSetupStep`, `SetupStepOrder`, `firstSetupStep` de `libs/session/src/lib/setup.ts`, `Session` de `libs/session/src/lib/session-aggregate.ts`, `SessionId` de `libs/session/src/lib/session.ts`.
- Produces, exportés par `@beacon/session` :
  - `interface KeptSetup { readonly sessionId: SessionId; readonly order: SetupStepOrder; readonly step: KeptSetupStep }`
  - `interface ShownSetup { readonly step: KeptSetupStep; readonly order: SetupStepOrder | null }`
  - `shownSetup(session: Pick<Session, 'state' | 'sessionId' | 'startedAt'>, kept: KeptSetup | null): ShownSetup | null`
  - `setupStepRank(shown: ShownSetup): number`, le rang de l'étape montrée, à partir de 1

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `libs/session/src/lib/setup.spec.ts`, ajouter `setupStepRank`, `shownSetup` et `type KeptSetup` à l'import de `./setup.js`, puis ajouter à la fin du fichier :

```ts
describe('shownSetup', () => {
  const ORDER = ['waking', 'restoring-world', 'fetching-game', 'starting-game'] as const;
  const PREPARING = { state: 'PROVISIONING', sessionId: 's1', startedAt: OPENED } as const;

  const keptFor = (sessionId: string): KeptSetup => ({
    sessionId,
    order: ORDER,
    step: kept({ since: LATER, activity: 'downloading', progress: 37 }),
  });

  it('shows the kept step and the order of its game, while its own session prepares', () => {
    expect(shownSetup(PREPARING, keptFor('s1'))).toEqual({
      step: { step: 'fetching-game', since: LATER, activity: 'downloading', progress: 37 },
      order: ORDER,
    });
  });

  it('shows the first step since the opening, and no order, while nothing is kept', () => {
    expect(shownSetup(PREPARING, null)).toEqual({
      step: { step: 'waking', since: OPENED, activity: null, progress: null },
      order: null,
    });
  });

  // Nothing erases what a setup left: the next session finds the previous one
  // there until its own is begun.
  it('shows the first step when what is kept belongs to another session', () => {
    expect(shownSetup(PREPARING, keptFor('s0'))).toEqual({
      step: { step: 'waking', since: OPENED, activity: null, progress: null },
      order: null,
    });
  });

  for (const state of ['IDLE', 'RUNNING', 'STOPPING', 'FAILED'] as const) {
    it(`shows nothing of a session that is ${state}`, () => {
      expect(shownSetup({ ...PREPARING, state }, keptFor('s1'))).toBeNull();
    });
  }

  it('shows nothing of a session that names no opening', () => {
    expect(shownSetup({ ...PREPARING, startedAt: null }, keptFor('s1'))).toBeNull();
    expect(shownSetup({ ...PREPARING, sessionId: null }, null)).toBeNull();
  });
});

describe('setupStepRank', () => {
  const step = kept({ step: 'fetching-game' });

  it('reads the rank of a step in the order of its game, from one', () => {
    expect(
      setupStepRank({
        step,
        order: ['waking', 'restoring-world', 'fetching-game', 'starting-game'],
      }),
    ).toBe(3);
    expect(
      setupStepRank({
        step,
        order: ['waking', 'fetching-game', 'restoring-world', 'starting-game'],
      }),
    ).toBe(2);
  });

  it('ranks the last step fourth', () => {
    expect(
      setupStepRank({
        step: kept({ step: 'starting-game' }),
        order: ['waking', 'fetching-game', 'restoring-world', 'starting-game'],
      }),
    ).toBe(4);
  });

  it('ranks the first step first while no order is known', () => {
    expect(setupStepRank({ step: firstSetupStep(OPENED), order: null })).toBe(1);
  });
});
```

- [ ] **Step 2: Lancer les tests et les voir échouer**

Run: `npx nx run @beacon/session:test`
Expected: FAIL, `shownSetup is not a function`.

- [ ] **Step 3: Écrire l'implémentation**

Dans `libs/session/src/lib/setup.ts`, ajouter en tête du fichier :

```ts
import type { Session } from './session-aggregate.js';
import type { SessionId } from './session.js';
```

et à la fin du fichier :

```ts
/** What the control plane keeps of one session's setup: whose it is, the order of its game, and the step it is on. */
export interface KeptSetup {
  readonly sessionId: SessionId;
  readonly order: SetupStepOrder;
  readonly step: KeptSetupStep;
}

/** What the screen shows of a setup. No order until the game's own is known. */
export interface ShownSetup {
  readonly step: KeptSetupStep;
  readonly order: SetupStepOrder | null;
}

/**
 * What the screen shows of a session's setup, and null outside the
 * preparation. What is kept counts only when it belongs to this session:
 * nothing erases it, so the next session finds the previous one's there until
 * its own is begun, and shows the first step since its opening meanwhile.
 */
export function shownSetup(
  session: Pick<Session, 'state' | 'sessionId' | 'startedAt'>,
  kept: KeptSetup | null,
): ShownSetup | null {
  if (session.state !== 'PROVISIONING') return null;
  if (session.sessionId === null || session.startedAt === null) return null;
  if (kept !== null && kept.sessionId === session.sessionId) {
    return { step: kept.step, order: kept.order };
  }
  return { step: firstSetupStep(session.startedAt), order: null };
}

/** The rank of the shown step in the order of its game, from one. */
export function setupStepRank(shown: ShownSetup): number {
  // No order is shown with the first step only, whatever the game.
  return shown.order === null ? 1 : shown.order.indexOf(shown.step.step) + 1;
}
```

- [ ] **Step 4: Lancer les tests et les voir passer**

Run: `npx nx run @beacon/session:test`
Expected: PASS.

Run: `npx nx run-many -t typecheck lint -p @beacon/session`
Expected: PASS. Une cible qu'un projet ne déclare pas est ignorée par Nx.

- [ ] **Step 5: Commit**

```bash
git add libs/session/src/lib/setup.ts libs/session/src/lib/setup.spec.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(session): dit ce que l'écran montre d'une mise en place" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 2: Le record publie l'étape avec le monde

**Files:**
- Modify: `libs/session-record/src/lib/fields.ts`
- Modify: `libs/session-record/src/lib/fields.spec.ts`
- Modify: `libs/session-record/src/lib/setup-record.ts`
- Modify: `libs/session-record/src/lib/client-session.ts`
- Modify: `libs/session-record/src/lib/client-session.spec.ts`
- Modify: `libs/session-record/src/lib/client-session-resilience.spec.ts`
- Modify: les fixtures de `ServerView` dans `apps/web/src/app/session/closing.component.spec.ts`, `in-service.component.spec.ts`, `not-cleared.component.spec.ts`, `out-of-service.component.spec.ts`, `preparing.component.spec.ts`, `session.page.spec.ts`, et dans `apps/web/src/app/worlds/overview.spec.ts`, `world.route.spec.ts`, `worlds.page.spec.ts`

**Interfaces:**
- Consumes: `KeptSetup`, `ShownSetup`, `shownSetup` de `@beacon/session` (tâche 1) ; `keptSetupFrom`, `setupDocPath` de `libs/session-record/src/lib/fields.ts` ; `setupStores` de `libs/session-record/src/lib/setup-record.ts`.
- Produces :
  - `keptStepFrom(data: Record<string, unknown>): KeptSetupStep | null`, le nouveau nom de la fonction que `fields.ts` exporte aujourd'hui sous `keptSetupFrom`
  - `keptSetupFrom(data: Record<string, unknown>): KeptSetup | null`, exporté par `libs/session-record/src/lib/fields.ts`
  - `ServerView.setup: ShownSetup | null`, lu par `apps/web` depuis `@beacon/session-record/client`

`ServerView.setup` vaut `null` hors de la préparation. En préparation il porte l'étape gardée et l'ordre du jeu quand `server/setup` porte la session en cours, et la première étape depuis l'ouverture, sans ordre, dans tous les autres cas : document absent, illisible, refusé par les règles, ou resté sur une autre session.

- [ ] **Step 1: Écrire les tests qui échouent, sur la lecture du document**

Dans `libs/session-record/src/lib/fields.spec.ts`, ajouter `keptSetupFrom` à l'import de `./fields.js`, puis ajouter à la fin du fichier :

```ts
describe('keptSetupFrom', () => {
  const SINCE = new Date('2026-10-12T20:16:00Z');
  const DOCUMENT = {
    sessionId: 's1',
    stepOrder: ['waking', 'restoring-world', 'fetching-game', 'starting-game'],
    step: 'fetching-game',
    stepSince: SINCE,
    activity: 'downloading',
    progress: 37,
  };

  it('reads whose setup it is, the order of its game and the step it is on', () => {
    expect(keptSetupFrom(DOCUMENT)).toEqual({
      sessionId: 's1',
      order: ['waking', 'restoring-world', 'fetching-game', 'starting-game'],
      step: { step: 'fetching-game', since: SINCE, activity: 'downloading', progress: 37 },
    });
  });

  it('reads nothing from a document that does not exist', () => {
    expect(keptSetupFrom({})).toBeNull();
  });

  // An order the screen would rank a step in must hold the four steps: half
  // an order is refused whole, like half a join point.
  it('reads nothing from an order that is not the four steps', () => {
    expect(keptSetupFrom({ ...DOCUMENT, stepOrder: ['waking', 'starting-game'] })).toBeNull();
    expect(keptSetupFrom({ ...DOCUMENT, stepOrder: 'waking' })).toBeNull();
  });

  it('reads nothing from a step or a session it does not recognise', () => {
    expect(keptSetupFrom({ ...DOCUMENT, step: 'booting' })).toBeNull();
    expect(keptSetupFrom({ ...DOCUMENT, sessionId: 42 })).toBeNull();
  });
});
```

- [ ] **Step 2: Écrire les tests qui échouent, sur ce que le record publie**

Dans `libs/session-record/src/lib/client-session.spec.ts`, ajouter l'import :

```ts
import { setupStores } from './setup-record.js';
```

et ajouter à la fin du fichier :

```ts
describe('the setup of a session that prepares', () => {
  const OPENED = new Date('2026-10-12T20:14:00Z');
  const AT = new Date('2026-10-12T20:16:00Z');
  const ORDER = ['waking', 'restoring-world', 'fetching-game', 'starting-game'] as const;
  const FIRST_STEP = {
    step: { step: 'waking', since: OPENED, activity: null, progress: null },
    order: null,
  };

  async function preparingServer(worldId: string, sessionId: string): Promise<void> {
    await getFirestore()
      .doc(serverDocPath(worldId))
      .set(
        {
          state: 'PROVISIONING',
          stateSince: Timestamp.fromDate(OPENED),
          sessionId,
          startedBy: 'alice',
          startedAt: Timestamp.fromDate(OPENED),
          deadline: Timestamp.fromDate(new Date(OPENED.getTime() + 4 * 3_600_000)),
        },
        { merge: true },
      );
  }

  const setups = () => setupStores(getFirestore()).for('les-copains');

  const view = () =>
    firstValue<WorldSummary | null>((on) => record().watchWorld('les-copains', on));

  it('publishes the kept step and the order of the game with the world', async () => {
    await seedWorld('les-copains', { players: ['alice'] });
    await preparingServer('les-copains', 's1');
    await setups().begin('s1', ORDER, OPENED);
    await setups().advance('s1', { step: 'fetching-game', activity: 'downloading', progress: 37 }, AT);

    expect((await view())?.server?.setup).toEqual({
      step: { step: 'fetching-game', since: AT, activity: 'downloading', progress: 37 },
      order: [...ORDER],
    });
  });

  it('publishes the first step since the opening while no setup is kept', async () => {
    await seedWorld('les-copains', { players: ['alice'] });
    await preparingServer('les-copains', 's1');

    expect((await view())?.server?.setup).toEqual(FIRST_STEP);
  });

  it('publishes the first step while the kept setup is still the previous session’s', async () => {
    await seedWorld('les-copains', { players: ['alice'] });
    await preparingServer('les-copains', 's0');
    await setups().begin('s0', ORDER, new Date('2026-10-11T20:00:00Z'));
    await setups().advance('s0', { step: 'starting-game' }, new Date('2026-10-11T20:05:00Z'));
    await preparingServer('les-copains', 's1');

    expect((await view())?.server?.setup).toEqual(FIRST_STEP);
  });

  it('publishes no setup for a world out of service, whatever is kept', async () => {
    await seedWorld('les-copains', { players: ['alice'] });
    await setups().begin('s0', ORDER, OPENED);

    const seen = await view();

    expect(seen?.server?.session.state).toBe('IDLE');
    expect(seen?.server?.setup).toBeNull();
  });

  // The progress lives in a document of its own: a write to it moves no field
  // of `server/current`, and must reach the screen all the same.
  it('publishes again when the step moves, without any write to the session', async () => {
    await seedWorld('les-copains', { players: ['alice'] });
    await preparingServer('les-copains', 's1');
    await setups().begin('s1', ORDER, OPENED);
    const seen: (WorldSummary | null)[] = [];
    const stop = record().watchWorld('les-copains', (summary) => seen.push(summary));
    await vi.waitFor(() => expect(seen.at(-1)?.server?.setup?.step.step).toBe('waking'), {
      timeout: 5_000,
    });

    await setups().advance('s1', { step: 'restoring-world' }, AT);

    await vi.waitFor(
      () =>
        expect(seen.at(-1)?.server?.setup?.step).toEqual({
          step: 'restoring-world',
          since: AT,
          activity: null,
          progress: null,
        }),
      { timeout: 5_000 },
    );
    stop();
  });
});
```

Dans `libs/session-record/src/lib/client-session-resilience.spec.ts`, les règles minimales du fichier ne donnent pas la lecture de `server/setup` : l'écoute de ce document y est refusée. Ajouter, juste après la ligne `await vi.waitFor(() => expect(seen.at(-1)?.server?.session.state).toBe('PROVISIONING'));` :

```ts
    // These rules open no read on `server/setup` either: its listener is
    // refused too, and the world publishes on the first step all the same.
    expect(seen.at(-1)?.server?.setup).toEqual({
      step: { step: 'waking', since: NOW, activity: null, progress: null },
      order: null,
    });
```

- [ ] **Step 3: Lancer les tests et les voir échouer**

Run: `npx nx run @beacon/session-record:test`
Expected: FAIL, `keptSetupFrom` rend une étape et non un `KeptSetup`, et `setup` vaut `undefined` dans les publications.

- [ ] **Step 4: Écrire la lecture du document**

Chaque lecteur de `fields.ts` porte le nom du type qu'il rend. La fonction `keptSetupFrom` d'aujourd'hui rend un `KeptSetupStep` : elle devient `keptStepFrom`, dans `fields.ts` et dans `libs/session-record/src/lib/setup-record.ts`, à l'import comme à l'appel. Aucun autre fichier ne la nomme.

Dans `libs/session-record/src/lib/fields.ts`, remplacer dans le commentaire de cette fonction `` `worlds/{worldId}/server/setup` as the domain reads it. `` par `` The step `worlds/{worldId}/server/setup` is on, as the domain reads it. ``, ajouter `isSetupStepOrder` et `type KeptSetup` à l'import de `@beacon/session`, puis ajouter après `keptStepFrom` :

```ts
/**
 * The whole of `worlds/{worldId}/server/setup`: whose setup it is and the
 * order of its game, with the step it is on. Null as soon as one of the three
 * is missing — the screen ranks the step in that order, and half of it would
 * be a rank out of nothing.
 */
export function keptSetupFrom(data: Record<string, unknown>): KeptSetup | null {
  const sessionId = data['sessionId'];
  const order = data['stepOrder'];
  const step = keptStepFrom(data);
  if (typeof sessionId !== 'string' || !isSetupStepOrder(order) || step === null) return null;
  return { sessionId, order, step };
}
```

- [ ] **Step 5: Écrire la publication**

Dans `libs/session-record/src/lib/client-session.ts` :

Ajouter `shownSetup` et `type ShownSetup` à l'import de `@beacon/session`, et `keptSetupFrom` et `setupDocPath` à l'import de `./fields.js`.

Ajouter à `ServerView`, après `stateSince` :

```ts
  /** What the screen shows of the setup, and null outside the preparation. */
  readonly setup: ShownSetup | null;
```

Dans `watchWorldSummary`, ajouter après `let playerUids: readonly string[] | undefined;` :

```ts
    let setupData: Record<string, unknown> | undefined;
```

remplacer la condition d'attente de `publish` par :

```ts
          if (
            worldData === undefined ||
            serverData === undefined ||
            playerUids === undefined ||
            setupData === undefined
          ) {
            return;
          }
```

ajouter à l'objet `server` publié, après `stateSince: toDate(serverData['stateSince']),` :

```ts
                    setup: shownSetup(session, keptSetupFrom(setupData)),
```

ajouter après la déclaration de `unsubPlayers` :

```ts
    // A document of its own, so a listener of its own: a progress is written
    // several times a minute and moves no field of `server/current`. Absent or
    // refused, it reads as nothing kept, and the screen shows the first step.
    const unsubSetup = onSnapshot(
      doc(db, setupDocPath(worldId)),
      (snapshot) => {
        setupData = snapshot.data() ?? {};
        publish();
      },
      () => {
        setupData = {};
        publish();
      },
    );
```

et ajouter `unsubSetup();` après `unsubPlayers();` dans la fonction rendue.

- [ ] **Step 6: Donner `setup` aux fixtures des écrans**

`ServerView.setup` est obligatoire. Dans chacun des fichiers de `apps/web` que cette tâche nomme, chaque objet qui porte `stateSince` reçoit `setup: null` juste après ce champ. La commande suivante les liste tous, douze objets dans neuf fichiers :

```bash
grep -rn "stateSince" apps/web/src --include=*.spec.ts
```

Un objet écrit sur une ligne, comme `{ session, facts, stateSince: STARTED_AT }`, devient `{ session, facts, stateSince: STARTED_AT, setup: null }`.

- [ ] **Step 7: Lancer les tests et les voir passer**

Run: `npx nx run @beacon/session-record:test`
Expected: PASS.

Run: `npx nx run web:test`
Expected: PASS.

Run: `npx nx run-many -t typecheck lint -p @beacon/session-record web`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add libs/session-record/src/lib apps/web/src
bash ~/.config/github-app/as-agent.sh git commit -m "feat(session-record): publie avec le monde l'étape de sa mise en place" -m "L'étape vit dans un document à elle, donc sous une écoute à elle : un avancement n'écrit rien dans server/current." -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 3: L'écran de préparation montre l'étape

**Files:**
- Modify: `apps/web/src/app/format.ts`
- Modify: `apps/web/src/app/format.spec.ts`
- Modify: `apps/web/src/app/session/preparing.component.ts`
- Create: `apps/web/src/app/session/preparing.component.css`
- Modify: `apps/web/src/app/session/preparing.component.spec.ts`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/world.spec.ts`

**Interfaces:**
- Consumes: `ServerView.setup` (tâche 2) ; `SETUP_STEPS`, `setupStepRank`, `ShownSetup`, `SetupStep`, `SetupActivity` de `@beacon/session` (tâche 1).
- Produces :
  - `stepLabel(step: SetupStep): string` et `activityLabel(activity: SetupActivity): string`, exportés par `apps/web/src/app/format.ts`
  - le jeton `--held` de `apps/web/src/styles.css`

La forme est la variante C de `.impeccable/mocks/progress/desktop.html` et de `phone.html`, décidée au tour du 2026-10-12. Cette tâche la transcrit et n'ouvre aucun tour de direction.

- [ ] **Step 1: Invoquer la skill de l'interface**

Invoquer `impeccable:impeccable` avant de modifier un fichier de `apps/web`, lire `.impeccable/DIRECTION.md`, `.impeccable/mocks/decision/README.md` et `.impeccable/mocks/progress/README.md`, et suivre ce que la skill demande pour un raffinement d'un écran existant.

- [ ] **Step 2: Écrire les tests qui échouent, sur les mots**

Dans `apps/web/src/app/format.spec.ts`, remplacer la première ligne par :

```ts
import { SETUP_ACTIVITIES, SETUP_STEPS, World } from '@beacon/session';
```

ajouter `activityLabel` et `stepLabel` à l'import de `./format`, puis ajouter à la fin du fichier :

```ts
describe('stepLabel', () => {
  it('names each of the four steps the way the board says them', () => {
    expect(SETUP_STEPS.map(stepLabel)).toEqual([
      'Waking the server',
      'Getting the game',
      'Bringing your world back',
      'Starting the game',
    ]);
  });
});

describe('activityLabel', () => {
  it('names each activity a game server can declare', () => {
    expect(SETUP_ACTIVITIES.map(activityLabel)).toEqual(['Downloading', 'Unpacking']);
  });
});
```

- [ ] **Step 3: Écrire les tests qui échouent, sur le mouvement**

Dans `apps/web/src/world.spec.ts`, remplacer le commentaire et le test `animates nothing, anywhere, which is what the contract asks of everything but the second` par :

```ts
  /**
   * "What moves says something — the falling second, a length that passes
   * during a wait with no progress — and nothing moves to decorate." The
   * second is a signal being set, not a keyframe, so the one declared
   * animation of the whole surface is that length. A hover transition on a
   * control is not an animation.
   */
  it('animates one thing only: the length that passes on a step with no progress', () => {
    const animated = sources()
      .filter(([, source]) => {
        // Comments dropped first: a file is allowed to say why it does not
        // animate, and a prose sentence ending in "not an animation:" would
        // otherwise read as a declaration.
        const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        return code.includes('@keyframes') || /\banimation(-name)?\s*:/.test(code);
      })
      .map(([file]) => file.replaceAll('\\', '/'));

    expect(animated).toEqual(['apps/web/src/app/session/preparing.component.css']);
  });

  it('stops that length for whoever asked their system for less motion', () => {
    const sheet = readFileSync('apps/web/src/app/session/preparing.component.css', 'utf8');
    expect(sheet.match(/@keyframes/g)).toHaveLength(1);
    expect(sheet).toContain('@media (prefers-reduced-motion: reduce)');
  });
```

- [ ] **Step 4: Écrire les tests qui échouent, sur l'écran**

Remplacer le contenu de `apps/web/src/app/session/preparing.component.spec.ts` par :

```ts
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { DEFAULT_SETTINGS, Deadline, Session, type ShownSetup } from '@beacon/session';
import { CLOCK } from '../clock';
import { PreparingComponent } from './preparing.component';

describe('PreparingComponent', () => {
  const startedAt = new Date('2026-09-12T20:14:00');
  const stepSince = new Date('2026-09-12T20:16:00');
  const clock = { now: () => new Date('2026-09-12T20:17:30') };

  /** The game is brought back from the depot before its world is. */
  const DEPOT_FIRST = ['waking', 'fetching-game', 'restoring-world', 'starting-game'] as const;
  /** The world is brought back before the game's own container fetches the game. */
  const WORLD_FIRST = ['waking', 'restoring-world', 'fetching-game', 'starting-game'] as const;

  const FIRST_STEP: ShownSetup = {
    step: { step: 'waking', since: startedAt, activity: null, progress: null },
    order: null,
  };

  const fetching = (parts: Partial<ShownSetup['step']> = {}): ShownSetup => ({
    step: { step: 'fetching-game', since: stepSince, activity: null, progress: null, ...parts },
    order: DEPOT_FIRST,
  });

  const render = async (
    setup: ShownSetup | null = FIRST_STEP,
    stateSince: Date | null = startedAt,
  ) => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: CLOCK, useValue: clock }] });
    const fixture = TestBed.createComponent(PreparingComponent);
    const session = Session.from({
      state: 'PROVISIONING',
      sessionId: 'sess1',
      worldId: 'les-bras-casses',
      game: 'sunkenland',
      startedBy: 'u-9f3c2a',
      startedAt,
      deadline: Deadline.at(new Date('2026-09-13T00:14:00')),
      instanceSize: 'DEV1-L',
      hasJoinInfo: false,
    });
    fixture.componentRef.setInput('view', {
      session,
      facts: { ip: null, joinInfo: null, lastError: null },
      stateSince,
      setup,
    });
    fixture.componentRef.setInput('settings', DEFAULT_SETTINGS);
    await fixture.whenStable();
    return fixture;
  };

  const field = (fixture: ComponentFixture<PreparingComponent>, name: string): string | null =>
    fixture.nativeElement.querySelector(`[data-field="${name}"]`)?.textContent.trim() ?? null;

  const lengths = (fixture: ComponentFixture<PreparingComponent>): HTMLElement[] => [
    ...fixture.nativeElement.querySelectorAll('.track > div'),
  ];

  const states = (fixture: ComponentFixture<PreparingComponent>): (string | null)[] =>
    lengths(fixture).map((length) => length.getAttribute('data-length'));

  describe('the step under way', () => {
    it('names the step, its rank out of four and the hour it began', async () => {
      const fixture = await render(fetching());

      expect(field(fixture, 'step-name')).toBe('Getting the game');
      expect(field(fixture, 'step-rank')).toBe('2/4');
      expect(field(fixture, 'step-said')).toBe('since 20:16');
    });

    it('ranks the same step where the order of the game puts it', async () => {
      const fixture = await render({ ...fetching(), order: WORLD_FIRST });

      expect(field(fixture, 'step-rank')).toBe('3/4');
      expect(states(fixture)).toEqual(['done', 'done', 'cur', 'todo']);
    });

    it('shows the progress and the activity the game server declares', async () => {
      const fixture = await render(fetching({ activity: 'downloading', progress: 37 }));

      expect(field(fixture, 'step-progress')).toBe('37 %');
      expect(field(fixture, 'step-said')).toBe('Downloading · since 20:16');
    });

    it('shows an activity that comes with no progress', async () => {
      const fixture = await render(fetching({ activity: 'unpacking' }));

      expect(field(fixture, 'step-progress')).toBeNull();
      expect(field(fixture, 'step-said')).toBe('Unpacking · since 20:16');
    });

    /** Never a progress no measure carries: no figure, no percentage, no zero. */
    it('shows no progress when the game server declares none', async () => {
      const fixture = await render(fetching());

      expect(field(fixture, 'step-progress')).toBeNull();
      expect(fixture.nativeElement.textContent).not.toContain('%');
    });

    // Zero is a measure: the download began and nothing has arrived yet.
    it('shows a progress of zero as a figure, not as no progress', async () => {
      const fixture = await render(fetching({ activity: 'downloading', progress: 0 }));

      expect(field(fixture, 'step-progress')).toBe('0 %');
      const current = lengths(fixture)[1];
      expect(current.classList.contains('wait')).toBe(false);
      expect(current.querySelector('i')?.style.getPropertyValue('--at')).toBe('0%');
    });

    it('shows the first step since the opening while the order of the game is not known', async () => {
      const fixture = await render(FIRST_STEP);

      expect(field(fixture, 'step-name')).toBe('Waking the server');
      expect(field(fixture, 'step-rank')).toBe('1/4');
      expect(field(fixture, 'step-said')).toBe('since 20:14');
    });

    // Nothing checks what a game server declares: the screen follows it back.
    it('follows a step declared backwards', async () => {
      const fixture = await render({
        step: { step: 'waking', since: stepSince, activity: null, progress: null },
        order: DEPOT_FIRST,
      });

      expect(field(fixture, 'step-rank')).toBe('1/4');
      expect(states(fixture)).toEqual(['cur', 'todo', 'todo', 'todo']);
    });
  });

  describe('the rule in four lengths', () => {
    it('marks the lengths travelled, the one under way and those to come', async () => {
      const fixture = await render({
        step: { step: 'restoring-world', since: stepSince, activity: null, progress: null },
        order: DEPOT_FIRST,
      });

      expect(states(fixture)).toEqual(['done', 'done', 'cur', 'todo']);
    });

    it('names the four lengths in the order of the game', async () => {
      const fixture = await render({ ...fetching(), order: WORLD_FIRST });

      expect(lengths(fixture).map((length) => length.textContent?.trim())).toEqual([
        'Waking the server',
        'Bringing your world back',
        'Getting the game',
        'Starting the game',
      ]);
    });

    it('leaves the lengths to come unnamed while the order of the game is not known', async () => {
      const fixture = await render(FIRST_STEP);

      expect(lengths(fixture).map((length) => length.textContent?.trim())).toEqual([
        'Waking the server',
        '',
        '',
        '',
      ]);
    });

    it('fills the length under way as far as the declared progress', async () => {
      const current = lengths(await render(fetching({ progress: 37 })))[1];

      expect(current.querySelector('i')?.style.getPropertyValue('--at')).toBe('37%');
      expect(current.classList.contains('wait')).toBe(false);
    });

    it('lets a length pass over a step that has no progress, and over that one only', async () => {
      const fixture = await render(fetching());

      expect(lengths(fixture).map((length) => length.classList.contains('wait'))).toEqual([
        false,
        true,
        false,
        false,
      ]);
    });

    it('says the step, its rank and its progress to whoever cannot see the rule', async () => {
      const track = (await render(fetching({ progress: 37 }))).nativeElement.querySelector('.track');

      expect(track.getAttribute('role')).toBe('img');
      expect(track.getAttribute('aria-label')).toBe('Step 2 of 4, Getting the game, 37 percent');
    });

    it('says no progress to them either when there is none', async () => {
      const track = (await render(fetching())).nativeElement.querySelector('.track');

      expect(track.getAttribute('aria-label')).toBe('Step 2 of 4, Getting the game');
    });
  });

  /**
   * probe/RESULTS.md §S: 4 min 49 s then 7 min 58 s on the same size in the
   * same zone. A single hour would be three minutes wrong one time in two, and
   * an hour contradicted releases nobody.
   */
  it('announces a window and never a single hour', async () => {
    const fixture = await render();

    expect(fixture.nativeElement.textContent).toContain('Ready between');
    expect(field(fixture, 'ready-window')).toBe('20:19 – 20:22');
    expect(fixture.nativeElement.textContent).not.toContain('Ready around');
  });

  it('announces no window when it has no instant to open one from', async () => {
    const fixture = await render(FIRST_STEP, null);

    expect(fixture.nativeElement.textContent).not.toContain('Ready between');
    expect(field(fixture, 'step-name')).toBe('Waking the server');
  });

  it('hands the evening back, in as many words', async () => {
    const text: string = (await render()).nativeElement.textContent;
    expect(text).toContain('No need to stay.');
    expect(text.toLowerCase()).toMatch(/close the tab|put the phone down/);
  });

  it('runs no countdown, there being nothing to count', async () => {
    expect((await render()).nativeElement.querySelector('[data-field="countdown"]')).toBeNull();
  });

  it('still says when the evening closes, which is the promise of the product', async () => {
    const fixture = await render();
    expect(fixture.nativeElement.textContent).toContain('Closes at');
    expect(field(fixture, 'closes-at')).toBe('00:14');
    expect(field(fixture, 'opened-at')).toBe('20:14');
  });

  it('still says when the evening closes when it is given no setup to show', async () => {
    const fixture = await render(null);

    expect(field(fixture, 'closes-at')).toBe('00:14');
    expect(fixture.nativeElement.querySelector('.track')).toBeNull();
  });

  /** §11: the started hour is due whatever happens next, and saying so is honest. */
  it('offers to close now, and says the first hour is charged either way', async () => {
    const fixture = await render();
    expect(fixture.nativeElement.querySelector('[data-action="close"]').disabled).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('first hour is charged');
  });
});
```

- [ ] **Step 5: Lancer les tests et les voir échouer**

Run: `npx nx run web:test`
Expected: FAIL, `stepLabel` n'est pas exporté, `preparing.component.css` n'existe pas, et l'écran ne porte aucun `data-field="step-name"`.

- [ ] **Step 6: Écrire les mots**

Dans `apps/web/src/app/format.ts`, remplacer la première ligne par :

```ts
import type { Game, SessionState, SetupActivity, SetupStep, World } from '@beacon/session';
```

et ajouter après `readyWindow` :

```ts
/**
 * The four steps of a setup, in the board's own words. A record and not a
 * switch: a step added to the domain without its words here does not compile.
 */
export function stepLabel(step: SetupStep): string {
  const steps: Record<SetupStep, string> = {
    waking: 'Waking the server',
    'fetching-game': 'Getting the game',
    'restoring-world': 'Bringing your world back',
    'starting-game': 'Starting the game',
  };
  return steps[step];
}

export function activityLabel(activity: SetupActivity): string {
  const activities: Record<SetupActivity, string> = {
    downloading: 'Downloading',
    unpacking: 'Unpacking',
  };
  return activities[activity];
}
```

- [ ] **Step 7: Écrire le jeton et corriger deux commentaires**

Dans `apps/web/src/styles.css`, ajouter après `--off-ink: #b3aea3;` :

```css

  /* What a step under way has not travelled yet: darker than the hairline of a
     length to come, lighter than the ink of one travelled. */
  --held: #8d8a82;
```

remplacer le commentaire qui précède `.status .dot` par :

```css
/* The pip stays, its beat does not. The comp animated it; the contract lets
   nothing move to decorate, and the contract wins. */
```

et le commentaire qui précède `.clock` par :

```css
/** The one figure entitled to the display scale. */
```

- [ ] **Step 8: Écrire la feuille de l'écran**

`apps/web/src/app/session/preparing.component.css` :

```css
:host {
  flex: 1;
  display: flex;
  flex-direction: column;
}

/* The step leads and the hours stand beside it; the rule runs under both, cut
   in four lengths. One markup for both widths: on the phone the lengths come
   straight under the step, before the hours. */
.hero {
  display: grid;
  grid-template-columns: 1fr auto;
  grid-template-areas:
    'step hours'
    'track track';
  align-items: end;
  gap: 44px 60px;
  padding: 40px 0 0;
}

.stephero {
  grid-area: step;
  display: grid;
  grid-template-columns: auto 1fr;
  grid-template-areas:
    'key .'
    'rank what';
  align-items: end;
  column-gap: 48px;
}

.stephero > .k {
  grid-area: key;
}

.stephero > .clock {
  grid-area: rank;
}

.clock .of,
.right .v .to {
  color: var(--mute);
}

.what {
  grid-area: what;
  padding-bottom: 6px;
}

.name {
  font:
    800 52px/1.02 var(--font-display);
  letter-spacing: -0.03em;
  max-width: 16ch;
}

.meta {
  font-size: 19px;
  color: var(--mute);
  margin-top: 16px;
}

.meta b {
  color: var(--ink);
  font-weight: 800;
  font-size: 26px;
  letter-spacing: -0.01em;
  margin-right: 14px;
}

.right {
  grid-area: hours;
}

/* The world's own rule, in four lengths. A length travelled is ink, the one
   under way is ink as far as the game server has got, the rest is the
   hairline. */
.track {
  grid-area: track;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.track i {
  display: block;
  height: var(--rule-heavy);
  background: linear-gradient(var(--rule), var(--rule)) left bottom / 100% 1px no-repeat;
}

.track [data-length='done'] i {
  background: var(--ink);
}

.track [data-length='cur'] i {
  background: linear-gradient(to right, var(--ink) var(--at, 0%), var(--held) var(--at, 0%));
}

.track .k {
  margin-top: 12px;
}

.track [data-length='done'] .k,
.track [data-length='cur'] .k {
  color: var(--ink);
}

.track [data-length='todo'] .k {
  font-weight: 600;
}

/* A step with no figure to give: a short ink length crosses the one under
   way. It is the one thing the whole surface animates, and it says the wait
   is alive without inventing how far it has got. */
.track .wait i {
  background: var(--held);
  position: relative;
  overflow: hidden;
}

.track .wait i::after {
  content: '';
  position: absolute;
  inset: 0 auto 0 0;
  width: 28%;
  background: var(--ink);
  animation: pass 2.4s cubic-bezier(0.45, 0, 0.55, 1) infinite;
}

@keyframes pass {
  from {
    transform: translateX(-100%);
  }

  to {
    transform: translateX(358%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .track .wait i::after {
    display: none;
  }
}

@media (max-width: 640px) {
  .hero {
    grid-template-columns: 1fr;
    grid-template-areas:
      'step'
      'track'
      'hours';
    gap: 16px;
    padding: 22px 0 4px;
  }

  /* The name stands beside the rank and what is said of the step runs under
     both: the wrapper that holds them side by side on wide steps aside. */
  .stephero {
    grid-template-areas:
      'key key'
      'rank name'
      'meta meta';
    column-gap: 18px;
  }

  .what {
    display: contents;
  }

  .name {
    grid-area: name;
    font-size: 24px;
    line-height: 1.08;
    letter-spacing: -0.015em;
    max-width: none;
    padding-bottom: 4px;
  }

  .meta {
    grid-area: meta;
    font-size: 14px;
    margin-top: 14px;
  }

  .meta b {
    font-size: 20px;
    margin-right: 10px;
  }

  .track {
    gap: 6px;
  }

  .track i {
    height: var(--rule-mid);
  }

  /* Four names do not share 342 px: the step under way is named above. */
  .track .k {
    display: none;
  }
}
```

- [ ] **Step 9: Écrire l'écran**

Remplacer le contenu de `apps/web/src/app/session/preparing.component.ts` par :

```ts
import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import {
  SETUP_STEPS,
  setupStepRank,
  type SessionSettings,
  type ShownSetup,
} from '@beacon/session';
import type { ServerView } from '@beacon/session-record/client';
import { CLOCK } from '../clock';
import { activityLabel, euroLabel, hourLabel, readyWindow, stepLabel } from '../format';

/** One of the four lengths the rule under the step is cut in. */
interface Length {
  readonly state: 'done' | 'cur' | 'todo';
  /** Null for a length to come while the order of the game is not known. */
  readonly name: string | null;
  /** How far the length under way is filled, when the game server measures it. */
  readonly at: string | null;
  readonly waiting: boolean;
}

function lengthsOf(shown: ShownSetup, rank: number): Length[] {
  const { step, progress } = shown.step;
  return SETUP_STEPS.map((_, index) => {
    const position = index + 1;
    if (position !== rank) {
      const named = shown.order?.[index] ?? null;
      return {
        state: position < rank ? 'done' : 'todo',
        // Without the order of the game, only the step under way has a name.
        name: named === null ? null : stepLabel(named),
        at: null,
        waiting: false,
      };
    }
    return {
      state: 'cur',
      name: stepLabel(step),
      at: progress === null ? null : `${progress}%`,
      waiting: progress === null,
    };
  });
}

/**
 * The screen that releases. It says where the setup is — the step under way,
 * its rank, the hour it began, and how far it has got when the game server
 * measures it — and hands the user back to their evening. It never draws a
 * progress no measure carries: a step with no figure gets a length that
 * passes, and no percentage.
 *
 * A window and never an hour, and it is the probe that imposes it: 4 min 49 s
 * then 7 min 58 s on the same size in the same zone. What earned the right to
 * come back with the measurement is a figure; not its precision.
 *
 * The window opens from `stateSince` and not from `startedAt`: the same
 * instant today, a different one the day a state precedes another.
 */
@Component({
  selector: 'beacon-preparing',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="hero">
      @if (step(); as step) {
        <div class="stephero">
          <span class="k">Step</span>
          <div class="clock" data-field="step-rank">{{ step.rank }}<span class="of">/{{ total }}</span></div>
          <div class="what">
            <div class="name" data-field="step-name">{{ step.name }}</div>
            <div class="meta tabular">
              @if (step.progress !== null) {
                <b data-field="step-progress">{{ step.progress }} %</b>
              }
              <span data-field="step-said">{{ step.said }}</span>
            </div>
          </div>
        </div>
      }
      <div class="right">
        @if (window(); as window) {
          <div>
            <span class="k">Ready between</span>
            <div class="v tabular" data-field="ready-window">{{ window.from }}<span
                class="to"> – </span>{{ window.to }}</div>
          </div>
        }
        <div>
          <span class="k">Closes at</span>
          <div class="v tabular" [class.sm]="window() !== null" data-field="closes-at">{{ closesAt() }}</div>
        </div>
      </div>
      @if (step(); as step) {
        <div class="track" role="img" [attr.aria-label]="step.spoken">
          @for (length of step.lengths; track $index) {
            <div [attr.data-length]="length.state" [class.wait]="length.waiting">
              <i [style.--at]="length.at"></i>
              @if (length.name !== null) {
                <span class="k">{{ length.name }}</span>
              }
            </div>
          }
        </div>
      }
    </div>

    <div class="mid">
      <div class="release">
        <div class="big">No need to stay.</div>
        <div class="sub">
          Close the tab and go back to your evening. The server will be up, and it will close
          itself at {{ closesAt() }} whether anyone comes back to this page or not.
        </div>
      </div>
    </div>

    <div class="rule-thin"></div>

    <div class="foot">
      <div class="money">
        <div>
          <span class="k">This session</span>
          <div class="v tabular" data-field="cost">{{ cost() }}</div>
        </div>
        <div>
          <span class="k">Opened at</span>
          <div class="v tabular" data-field="opened-at">{{ openedAt() }}</div>
        </div>
      </div>
      <div class="btncol">
        <div class="acts">
          <button type="button" class="btn ghost" data-action="close" (click)="closed.emit()">
            Close it now
          </button>
        </div>
        <div class="hint">The first hour is charged either way.</div>
      </div>
    </div>
  `,
  styleUrl: './preparing.component.css',
})
export class PreparingComponent {
  readonly view = input.required<ServerView>();
  readonly settings = input.required<SessionSettings>();

  readonly closed = output<void>();

  private readonly clock = inject(CLOCK);

  readonly total = SETUP_STEPS.length;

  /** Everything the screen says of the step under way, or null when it is given no setup. */
  readonly step = computed(() => {
    const shown = this.view().setup;
    if (shown === null) return null;

    const rank = setupStepRank(shown);
    const { step, since, activity, progress } = shown.step;
    const name = stepLabel(step);
    const begun = `since ${hourLabel(since)}`;

    return {
      rank,
      name,
      progress,
      said: activity === null ? begun : `${activityLabel(activity)} · ${begun}`,
      spoken: [
        `Step ${rank} of ${this.total}`,
        name,
        ...(progress === null ? [] : [`${progress} percent`]),
      ].join(', '),
      lengths: lengthsOf(shown, rank),
    };
  });

  readonly window = computed(() => {
    const since = this.view().stateSince;
    return since === null ? null : readyWindow(since);
  });

  readonly closesAt = computed(() =>
    hourLabel(this.view().session.displayedDeadline(this.clock, this.settings()).at),
  );

  readonly openedAt = computed(() => {
    const at = this.view().session.startedAt;
    return at === null ? '' : hourLabel(at);
  });

  readonly cost = computed(() =>
    euroLabel(this.view().session.estimatedCost(this.clock, this.settings())),
  );
}
```

- [ ] **Step 10: Lancer les tests et les voir passer**

Run: `npx nx run web:test`
Expected: PASS.

Run: `npx nx run-many -t typecheck lint build -p web`
Expected: PASS.

- [ ] **Step 11: Regarder l'écran contre les planches**

Suivre la passe d'inspection bornée de `impeccable:impeccable`, une fois à 1440 px et une fois à 390 px, contre la variante C de `.impeccable/mocks/progress/desktop.html` et de `phone.html`, dans ces quatre cas : une étape avec avancement et activité, une étape sans avancement, la première étape sans ordre connu, et l'écran sans fourchette. Corriger en un lot ce que la passe montre, dans les fichiers que cette tâche nomme, et relancer `npx nx run web:test`.

Un écart que la passe laisse entre l'écran et la planche se dit dans le rapport de la tâche.

- [ ] **Step 12: Commit**

```bash
git add apps/web/src
bash ~/.config/github-app/as-agent.sh git commit -m "feat(web): montre l'étape en cours pendant la mise en place" -m "La longueur qui passe sur une étape sans avancement est la seule animation de l'application, et elle s'arrête pour qui a demandé moins de mouvement." -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

## Before the merge

Cette story change `libs/session`, que l'image du compagnon embarque. `companion:test` reste rouge sur `names an image built from the sources in the tree` tant que l'image n'est pas republiée.

Une fois la revue accordée et les `fixup!` écrasés :

1. Le commanditaire pose le tag `companion-v0.11` sur la tête de la branche et le pousse. Le workflow `companion` publie l'image.
2. `npx nx run companion:pin -- 0.11` récrit `deploy/cloud-init/src/lib/companion-image.ts`.
3. Le changement est commité sous `build(cloud-init): épingle le compagnon 0.11` et poussé.
4. `npx nx run companion:test` passe.

Un commit qui touche `libs/session` après le tag demande un nouveau tag.

## Rulings log

## Observed drift
