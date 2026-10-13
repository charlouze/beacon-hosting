# La fourchette de disponibilité Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pendant la mise en place d'une session, l'écran annonce une fourchette de disponibilité tirée des cinq dernières mises en place abouties du jeu de la session, et n'en annonce aucune tant que ce jeu en compte moins de deux.

**Architecture:** `libs/session` porte la fourchette : une fonction pure la tire de l'ouverture de la session et des durées gardées, et une autre dit ce qu'on garde quand une mise en place aboutit. `libs/session-record` garde ces mises en place dans `launches/{game}`, que `agentReport` complète quand une session passe en service, et publie la fourchette dans `ServerView` avec le monde. `apps/web` ne calcule plus rien : `preparing.component.ts` et la liste des mondes mettent en forme les deux heures qu'ils reçoivent.

**Tech Stack:** TypeScript, Angular, Vitest, émulateur Firestore, règles Firestore, Nx.

**Spec:** docs/specs/session.md
**Batch:** docs/batches/03-progression-de-la-mise-en-place/README.md
**Sections:** Opening a session
**Blocks:** D3

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

`libs/agent-protocol`, `libs/scaleway-storage`, `deploy/`, `probe/` et `docs/specs/session.gaps.md` ne changent pas.

Les mises en place abouties d'un jeu vivent dans le document `launches/{game}`, sous le champ `setups` : une liste, de la plus ancienne à la plus récente, d'objets qui portent `sessionId` et `durationMs`.

Seules les Functions écrivent `launches/{game}`.

Le document garde cinq mises en place abouties au plus.

La durée d'une mise en place aboutie va de `startedAt` à l'heure à laquelle le plan de contrôle reçoit le rapport `ready`.

La fourchette part de `startedAt`, jamais de `stateSince`.

`apps/web` ne calcule aucune des deux heures de la fourchette : il met en forme celles que `ServerView` porte.

`apps/web` n'importe aucun SDK Firebase et ne nomme aucun champ de document.

L'écran sans fourchette ne gagne aucun mot : la ligne `Ready between` disparaît, et rien ne la remplace.

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

Chaque tâche finit par le typecheck et le lint des projets qu'elle touche, que son dernier pas nomme.

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

- Deux mises en place abouties de même durée donnent une fourchette de deux minutes différentes, jamais une heure unique. Tâche 1.
- Un document `launches/{game}` mal formé se lit comme aucune mise en place gardée : pas de fourchette, pas d'erreur, et l'écriture suivante le récrit. Tâche 2.
- Deux rapports `ready` de la même session ne gardent sa mise en place qu'une fois. Tâches 2 et 4.
- Un monde dont la lecture de `launches/{game}` est refusée se publie quand même, sans fourchette. Tâche 5.
- Une sixième mise en place aboutie sort la plus ancienne : la fourchette ne suit que les cinq dernières. Tâches 1 et 2.

---

### Task 1: La fourchette de disponibilité, dans le domaine

**Files:**
- Create: `libs/session/src/lib/ready-window.ts`
- Create: `libs/session/src/lib/ready-window.spec.ts`
- Modify: `libs/session/src/index.ts`

**Interfaces:**
- Consumes: `SessionId` de `libs/session/src/lib/session.ts` ; `LastOpening` de `libs/session/src/lib/setup.ts`, soit `{ readonly state: SessionState; readonly sessionId: SessionId | null; readonly startedAt: Date | null }`.
- Produces, exportés par `@beacon/session` :
  - `const READY_WINDOW_SETUPS = 5`
  - `interface CompletedSetup { readonly sessionId: SessionId; readonly durationMs: number }`
  - `interface ReadyWindow { readonly from: Date; readonly to: Date }`
  - `completedSetup(sessionId: SessionId, openedAt: Date, at: Date): CompletedSetup`
  - `keepCompletedSetup(kept: readonly CompletedSetup[], completed: CompletedSetup): readonly CompletedSetup[] | null`
  - `readyWindow(opening: LastOpening, durationsMs: readonly number[]): ReadyWindow | null`

- [ ] **Step 1: Écrire les tests qui échouent**

Créer `libs/session/src/lib/ready-window.spec.ts` :

```ts
import { describe, expect, it } from 'vitest';
import {
  completedSetup,
  keepCompletedSetup,
  readyWindow,
  type CompletedSetup,
} from './ready-window.js';

const OPENED = new Date('2026-10-12T20:14:00Z');
const PREPARING = { state: 'PROVISIONING', sessionId: 's1', startedAt: OPENED } as const;

const MINUTE = 60_000;
const after = (ms: number) => new Date(OPENED.getTime() + ms);

describe('completedSetup', () => {
  it('lasts from the opening of its session to its coming into service', () => {
    expect(completedSetup('s1', OPENED, after(7 * MINUTE))).toEqual({
      sessionId: 's1',
      durationMs: 7 * MINUTE,
    });
  });
});

describe('keepCompletedSetup', () => {
  const past = (count: number): CompletedSetup[] =>
    Array.from({ length: count }, (_, index) => ({
      sessionId: `past-${index}`,
      durationMs: (index + 1) * MINUTE,
    }));

  it('keeps a completed setup after the ones already kept', () => {
    expect(keepCompletedSetup(past(2), { sessionId: 's1', durationMs: 9 * MINUTE })).toEqual([
      ...past(2),
      { sessionId: 's1', durationMs: 9 * MINUTE },
    ]);
  });

  it('keeps the first one of a game', () => {
    expect(keepCompletedSetup([], { sessionId: 's1', durationMs: 9 * MINUTE })).toEqual([
      { sessionId: 's1', durationMs: 9 * MINUTE },
    ]);
  });

  it('lets the oldest go once five are kept', () => {
    const kept = keepCompletedSetup(past(5), { sessionId: 's1', durationMs: 9 * MINUTE });

    expect(kept?.map((setup) => setup.sessionId)).toEqual([
      'past-1',
      'past-2',
      'past-3',
      'past-4',
      's1',
    ]);
  });

  // Two `ready` reports of the same session must not count its setup twice.
  it('answers null for a session that is already kept', () => {
    expect(keepCompletedSetup(past(3), { sessionId: 'past-1', durationMs: 9 * MINUTE })).toBeNull();
  });
});

describe('readyWindow', () => {
  it('goes from the opening plus the shortest setup to the opening plus the longest', () => {
    expect(readyWindow(PREPARING, [6 * MINUTE, 5 * MINUTE, 8 * MINUTE])).toEqual({
      from: after(5 * MINUTE),
      to: after(8 * MINUTE),
    });
  });

  it('announces nothing while the game counts no completed setup', () => {
    expect(readyWindow(PREPARING, [])).toBeNull();
  });

  it('announces nothing while the game counts a single completed setup', () => {
    expect(readyWindow(PREPARING, [5 * MINUTE])).toBeNull();
  });

  it('announces a window from two completed setups', () => {
    expect(readyWindow(PREPARING, [8 * MINUTE, 5 * MINUTE])).toEqual({
      from: after(5 * MINUTE),
      to: after(8 * MINUTE),
    });
  });

  // Oldest first: the first of six no longer counts, though it is both the
  // shortest and nothing like the others.
  it('draws from the last five only', () => {
    const durations = [1 * MINUTE, 6 * MINUTE, 7 * MINUTE, 5 * MINUTE, 9 * MINUTE, 8 * MINUTE];

    expect(readyWindow(PREPARING, durations)).toEqual({
      from: after(5 * MINUTE),
      to: after(9 * MINUTE),
    });
  });

  it('announces the next minute for the later hour when both fall in the same one', () => {
    expect(readyWindow(PREPARING, [5 * MINUTE + 10_000, 5 * MINUTE + 40_000])).toEqual({
      from: after(5 * MINUTE + 10_000),
      to: after(6 * MINUTE + 40_000),
    });
  });

  it('never announces a single hour for two setups of the same duration', () => {
    expect(readyWindow(PREPARING, [5 * MINUTE, 5 * MINUTE])).toEqual({
      from: after(5 * MINUTE),
      to: after(6 * MINUTE),
    });
  });

  // 20:19:50 and 20:20:10: twenty seconds apart, and two hours all the same.
  it('leaves alone two hours that fall in neighbouring minutes', () => {
    expect(readyWindow(PREPARING, [5 * MINUTE + 50_000, 6 * MINUTE + 10_000])).toEqual({
      from: after(5 * MINUTE + 50_000),
      to: after(6 * MINUTE + 10_000),
    });
  });

  for (const state of ['IDLE', 'RUNNING', 'STOPPING', 'FAILED'] as const) {
    it(`announces nothing for a session that is ${state}`, () => {
      expect(readyWindow({ ...PREPARING, state }, [5 * MINUTE, 8 * MINUTE])).toBeNull();
    });
  }

  it('announces nothing for a world that names no opening', () => {
    expect(
      readyWindow({ state: 'PROVISIONING', sessionId: null, startedAt: null }, [5 * MINUTE, 8 * MINUTE]),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Lancer les tests et les voir échouer**

Run: `npx nx run @beacon/session:test`
Expected: FAIL, `ready-window.js` introuvable.

- [ ] **Step 3: Écrire le code**

Créer `libs/session/src/lib/ready-window.ts` :

```ts
import type { SessionId } from './session.js';
import type { LastOpening } from './setup.js';

/** How many of a game's last completed setups the ready window is drawn from. */
export const READY_WINDOW_SETUPS = 5;

/** A setup that came into service, and how long it took since the opening of its session. */
export interface CompletedSetup {
  readonly sessionId: SessionId;
  readonly durationMs: number;
}

/** The two instants between which the server should become joinable. */
export interface ReadyWindow {
  readonly from: Date;
  readonly to: Date;
}

const MINUTE_MS = 60_000;

export function completedSetup(sessionId: SessionId, openedAt: Date, at: Date): CompletedSetup {
  return { sessionId, durationMs: at.getTime() - openedAt.getTime() };
}

/**
 * What a game keeps once one more setup completes, oldest first. Null when
 * that session is already kept: its setup completed once.
 */
export function keepCompletedSetup(
  kept: readonly CompletedSetup[],
  completed: CompletedSetup,
): readonly CompletedSetup[] | null {
  if (kept.some((setup) => setup.sessionId === completed.sessionId)) return null;
  return [...kept, completed].slice(-READY_WINDOW_SETUPS);
}

/**
 * The ready window of a session that prepares, from the durations its game
 * kept, oldest first. Null out of a setup, and while the game counts fewer
 * than two completed: one duration is an hour, not a window.
 */
export function readyWindow(
  opening: LastOpening,
  durationsMs: readonly number[],
): ReadyWindow | null {
  if (opening.state !== 'PROVISIONING' || opening.startedAt === null) return null;

  const last = durationsMs.slice(-READY_WINDOW_SETUPS);
  if (last.length < 2) return null;

  const opened = opening.startedAt.getTime();
  const from = opened + Math.min(...last);
  const to = opened + Math.max(...last);
  // Two hours written to the minute: in the same one they would read as a
  // single hour, which a window never is.
  const sameMinute = Math.floor(from / MINUTE_MS) === Math.floor(to / MINUTE_MS);
  return { from: new Date(from), to: new Date(sameMinute ? to + MINUTE_MS : to) };
}
```

Dans `libs/session/src/index.ts`, ajouter après la ligne `export * from './lib/ports.js';` :

```ts
export * from './lib/ready-window.js';
```

- [ ] **Step 4: Lancer les tests, le lint et le typecheck**

Run: `npx nx run @beacon/session:test`
Expected: PASS

Run: `npx nx run-many -t typecheck lint -p @beacon/session`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add libs/session/src/lib/ready-window.ts libs/session/src/lib/ready-window.spec.ts libs/session/src/index.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(session): tire la fourchette de disponibilité des dernières mises en place abouties" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 2: Les mises en place abouties de chaque jeu, gardées

**Files:**
- Modify: `libs/session-record/src/lib/fields.ts`
- Modify: `libs/session-record/src/lib/fields.spec.ts`
- Create: `libs/session-record/src/lib/completed-setups-record.ts`
- Create: `libs/session-record/src/lib/completed-setups-record.spec.ts`
- Modify: `libs/session-record/src/index.ts`

**Interfaces:**
- Consumes: `CompletedSetup`, `keepCompletedSetup`, `Game`, `isGame` de `@beacon/session`.
- Produces, dans `libs/session-record/src/lib/fields.ts` :
  - `const LAUNCHES = 'launches'`
  - `launchesDocPath(game: Game): string`
  - `completedSetupsFrom(data: Record<string, unknown>): readonly CompletedSetup[]`
  - `launchesDocument(setups: readonly CompletedSetup[]): Record<string, unknown>`
  - `gameFrom(data: Record<string, unknown>): Game | null`
- Produces, exportés par `@beacon/session-record` :
  - `interface CompletedSetupStore { keep(game: Game, completed: CompletedSetup): Promise<void> }`
  - `completedSetupStore(db: Firestore): CompletedSetupStore`, où `Firestore` vient de `firebase-admin/firestore`

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `libs/session-record/src/lib/fields.spec.ts`, ajouter `completedSetupsFrom`, `gameFrom` et `launchesDocPath` à l'import de `./fields.js`, puis ajouter à la fin du fichier :

```ts
describe('launchesDocPath', () => {
  it('names one document per game', () => {
    expect(launchesDocPath('enshrouded')).toBe('launches/enshrouded');
  });
});

describe('completedSetupsFrom', () => {
  it('reads the completed setups a game kept, in the order they are kept', () => {
    expect(
      completedSetupsFrom({
        setups: [
          { sessionId: 's1', durationMs: 300_000 },
          { sessionId: 's2', durationMs: 480_000 },
        ],
      }),
    ).toEqual([
      { sessionId: 's1', durationMs: 300_000 },
      { sessionId: 's2', durationMs: 480_000 },
    ]);
  });

  it('reads a document that keeps nothing as no completed setup', () => {
    expect(completedSetupsFrom({})).toEqual([]);
    expect(completedSetupsFrom({ setups: 'none' })).toEqual([]);
  });

  // A duration that is no positive number would open a window before the
  // opening itself, or none at all.
  it('leaves out an entry it cannot read, and keeps the others', () => {
    expect(
      completedSetupsFrom({
        setups: [
          null,
          'five minutes',
          { sessionId: 's1' },
          { sessionId: 7, durationMs: 300_000 },
          { sessionId: 's2', durationMs: '300000' },
          { sessionId: 's3', durationMs: 0 },
          { sessionId: 's4', durationMs: -5 },
          { sessionId: 's5', durationMs: Number.NaN },
          { sessionId: 's6', durationMs: 480_000 },
        ],
      }),
    ).toEqual([{ sessionId: 's6', durationMs: 480_000 }]);
  });
});

describe('gameFrom', () => {
  it('reads the game a world document names', () => {
    expect(gameFrom({ game: 'sunkenland' })).toBe('sunkenland');
  });

  it('reads a game this vocabulary does not know as none', () => {
    expect(gameFrom({ game: 'not-a-game' })).toBeNull();
    expect(gameFrom({})).toBeNull();
  });
});
```

Créer `libs/session-record/src/lib/completed-setups-record.spec.ts` :

```ts
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { completedSetupStore, type CompletedSetupStore } from './completed-setups-record.js';
import { launchesDocPath } from './fields.js';

process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';

const ENSHROUDED = launchesDocPath('enshrouded');
const SUNKENLAND = launchesDocPath('sunkenland');

let app: ReturnType<typeof initializeApp>;
let db: Firestore;
let store: CompletedSetupStore;

const kept = async (path: string) => (await db.doc(path).get()).data();

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-beacon' }, 'completed-setups-record-spec');
  db = getFirestore(app);
  store = completedSetupStore(db);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await db.doc(ENSHROUDED).delete();
  await db.doc(SUNKENLAND).delete();
});

describe('keep', () => {
  it('keeps the first completed setup of a game', async () => {
    await store.keep('enshrouded', { sessionId: 's1', durationMs: 300_000 });

    expect(await kept(ENSHROUDED)).toEqual({ setups: [{ sessionId: 's1', durationMs: 300_000 }] });
  });

  it('keeps the next one after it', async () => {
    await store.keep('enshrouded', { sessionId: 's1', durationMs: 300_000 });
    await store.keep('enshrouded', { sessionId: 's2', durationMs: 480_000 });

    expect(await kept(ENSHROUDED)).toEqual({
      setups: [
        { sessionId: 's1', durationMs: 300_000 },
        { sessionId: 's2', durationMs: 480_000 },
      ],
    });
  });

  it('keeps each game apart', async () => {
    await store.keep('enshrouded', { sessionId: 's1', durationMs: 300_000 });
    await store.keep('sunkenland', { sessionId: 's2', durationMs: 480_000 });

    expect(await kept(ENSHROUDED)).toEqual({ setups: [{ sessionId: 's1', durationMs: 300_000 }] });
    expect(await kept(SUNKENLAND)).toEqual({ setups: [{ sessionId: 's2', durationMs: 480_000 }] });
  });

  it('keeps a session once, whatever its second report says it took', async () => {
    await store.keep('enshrouded', { sessionId: 's1', durationMs: 300_000 });
    await store.keep('enshrouded', { sessionId: 's1', durationMs: 360_000 });

    expect(await kept(ENSHROUDED)).toEqual({ setups: [{ sessionId: 's1', durationMs: 300_000 }] });
  });

  it('keeps a session once when its two reports race', async () => {
    await Promise.all([
      store.keep('enshrouded', { sessionId: 's1', durationMs: 300_000 }),
      store.keep('enshrouded', { sessionId: 's1', durationMs: 300_000 }),
    ]);

    expect(await kept(ENSHROUDED)).toEqual({ setups: [{ sessionId: 's1', durationMs: 300_000 }] });
  });

  it('keeps the last five, and lets the oldest go', async () => {
    for (const index of [1, 2, 3, 4, 5, 6]) {
      await store.keep('enshrouded', { sessionId: `s${index}`, durationMs: index * 60_000 });
    }

    const data = await kept(ENSHROUDED);
    expect(data?.['setups'].map((setup: { sessionId: string }) => setup.sessionId)).toEqual([
      's2',
      's3',
      's4',
      's5',
      's6',
    ]);
  });

  it('rewrites a document it cannot read, and keeps what it could', async () => {
    await db.doc(ENSHROUDED).set({
      setups: [{ sessionId: 's0', durationMs: 240_000 }, { sessionId: 'broken' }, 'noise'],
      stray: 'left over',
    });

    await store.keep('enshrouded', { sessionId: 's1', durationMs: 300_000 });

    expect(await kept(ENSHROUDED)).toEqual({
      setups: [
        { sessionId: 's0', durationMs: 240_000 },
        { sessionId: 's1', durationMs: 300_000 },
      ],
    });
  });
});
```

- [ ] **Step 2: Lancer les tests et les voir échouer**

Run: `npx nx run @beacon/session-record:test`
Expected: FAIL, `completedSetupsFrom` n'est pas exporté par `./fields.js` et `completed-setups-record.js` est introuvable.

- [ ] **Step 3: Écrire les lecteurs de `fields.ts`**

Dans `libs/session-record/src/lib/fields.ts`, ajouter `type CompletedSetup` et `type Game` à l'import de `@beacon/session` s'ils n'y sont pas, puis ajouter après la fonction `keptSetupFrom` :

```ts
export const LAUNCHES = 'launches';

/** `launches/{game}` — the last setups of one game that came into service. */
export function launchesDocPath(game: Game): string {
  return `${LAUNCHES}/${game}`;
}

/**
 * The completed setups `launches/{game}` keeps, oldest first. An entry that
 * names no session, or no duration a setup can have taken, is left out: the
 * ready window is drawn from what is read here, and one wrong duration would
 * announce an hour before the opening.
 */
export function completedSetupsFrom(data: Record<string, unknown>): readonly CompletedSetup[] {
  const setups = data['setups'];
  if (!Array.isArray(setups)) return [];
  return setups.flatMap((entry: unknown): CompletedSetup[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const { sessionId, durationMs } = entry as Record<string, unknown>;
    if (typeof sessionId !== 'string') return [];
    if (typeof durationMs !== 'number' || !Number.isFinite(durationMs) || durationMs <= 0) return [];
    return [{ sessionId, durationMs }];
  });
}

/** `launches/{game}` as it is written: whole, so nothing unreadable outlives a write. */
export function launchesDocument(setups: readonly CompletedSetup[]): Record<string, unknown> {
  return {
    setups: setups.map((setup) => ({ sessionId: setup.sessionId, durationMs: setup.durationMs })),
  };
}
```

et après la fonction `worldFrom` :

```ts
/** The game `worlds/{worldId}` names, or null when it is none this vocabulary knows. */
export function gameFrom(data: Record<string, unknown>): Game | null {
  const game = data['game'];
  return isGame(game) ? game : null;
}
```

- [ ] **Step 4: Écrire le magasin**

Créer `libs/session-record/src/lib/completed-setups-record.ts` :

```ts
import { keepCompletedSetup, type CompletedSetup, type Game } from '@beacon/session';
import type { Firestore } from 'firebase-admin/firestore';
import { completedSetupsFrom, launchesDocPath, launchesDocument } from './fields.js';

export interface CompletedSetupStore {
  /**
   * Keeps a setup that came into service among the last of its game. A
   * session already kept is kept once.
   */
  keep(game: Game, completed: CompletedSetup): Promise<void>;
}

/**
 * One document per game and none per world: the ready window of a session is
 * drawn from every world of its game.
 */
export function completedSetupStore(db: Firestore): CompletedSetupStore {
  return {
    async keep(game, completed): Promise<void> {
      const launches = db.doc(launchesDocPath(game));
      // A transaction: two `ready` reports of one session can race, and the
      // second must read what the first kept.
      await db.runTransaction(async (transaction) => {
        const kept = completedSetupsFrom((await transaction.get(launches)).data() ?? {});
        const next = keepCompletedSetup(kept, completed);
        if (next === null) return;
        transaction.set(launches, launchesDocument(next));
      });
    },
  };
}
```

Dans `libs/session-record/src/index.ts`, ajouter en première ligne :

```ts
export * from './lib/completed-setups-record.js';
```

- [ ] **Step 5: Lancer les tests, le lint et le typecheck**

Run: `npx nx run @beacon/session-record:test`
Expected: PASS

Run: `npx nx run-many -t typecheck lint -p @beacon/session-record`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add libs/session-record/src/lib/fields.ts libs/session-record/src/lib/fields.spec.ts libs/session-record/src/lib/completed-setups-record.ts libs/session-record/src/lib/completed-setups-record.spec.ts libs/session-record/src/index.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(session-record): garde les dernières mises en place abouties de chaque jeu" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 3: Qui lit les mises en place abouties

**Files:**
- Modify: `firestore.rules`
- Create: `libs/rules/src/lib/launches.spec.ts`

**Interfaces:**
- Consumes: `ALICE`, `BOB`, `MALLORY`, `ROOT`, `as`, `env`, `given`, `useRulesEnvironment` de `libs/rules/src/lib/harness.ts`. `ALICE` et `BOB` sont des utilisateurs, `ROOT` un administrateur, `MALLORY` est connecté et absent de `members`.
- Produces: la règle `match /launches/{game}`, qui donne la lecture à tout utilisateur et l'écriture à personne.

Avant de modifier `firestore.rules`, invoquer la skill `firebase-firestore`, puis la skill `firebase-security-rules-auditor`, et relire la règle ajoutée avec la seconde avant le commit.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `libs/rules/src/lib/launches.spec.ts` :

```ts
import { assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { beforeEach, describe, it } from 'vitest';
import {
  ALICE,
  BOB,
  env,
  MALLORY,
  ROOT,
  as,
  given,
  useRulesEnvironment,
} from './harness.js';

useRulesEnvironment();

const launches = (uid: string | null, game = 'enshrouded') =>
  doc(as(env, uid), 'launches', game);

const KEPT = { setups: [{ sessionId: 's1', durationMs: null }] };

describe('launches/{game}', () => {
  beforeEach(async () => {
    await given(env, 'launches/enshrouded', KEPT);
  });

  // Durations and session ids, and nothing of a world: a member of any world
  // of that game announces a window drawn from all of them.
  it('is read by every member, whatever world they play in', async () => {
    await assertSucceeds(getDoc(launches(ALICE)));
    await assertSucceeds(getDoc(launches(BOB)));
    await assertSucceeds(getDoc(launches(ROOT)));
  });

  it('is read as absent by a member, for a game that kept nothing yet', async () => {
    await assertSucceeds(getDoc(launches(ALICE, 'sunkenland')));
  });

  it('is read by nobody who is not a member', async () => {
    await assertFails(getDoc(launches(MALLORY)));
    await assertFails(getDoc(launches(null)));
  });

  it('is written by no member, whatever the write', async () => {
    await assertFails(updateDoc(launches(ALICE), { setups: [] }));
    await assertFails(setDoc(launches(ALICE), { setups: [] }));
    await assertFails(deleteDoc(launches(ALICE)));
  });

  it('is written by no admin either', async () => {
    await assertFails(updateDoc(launches(ROOT), { setups: [] }));
    await assertFails(deleteDoc(launches(ROOT)));
  });

  it('is created by no member for a game that kept nothing yet', async () => {
    await assertFails(setDoc(launches(ALICE, 'sunkenland'), KEPT));
  });
});
```

- [ ] **Step 2: Lancer les tests et les voir échouer**

Run: `npx nx run @beacon/rules:test`
Expected: FAIL, les deux tests de lecture par un membre sont refusés.

- [ ] **Step 3: Écrire la règle**

Dans `firestore.rules`, ajouter juste avant le commentaire `// §4: the two fields of \`config/settings\` the deployment stamps at every` :

```
    // The last setups of each game that came into service: session ids and
    // durations, and nothing of a world. Every member reads them — the window
    // a preparing session announces is drawn from all the worlds of its game —
    // and no client writes them: a duration is a finding of the Functions.
    match /launches/{game} {
      allow read: if isMember();
    }

```

- [ ] **Step 4: Lancer les tests et le lint**

Run: `npx nx run @beacon/rules:test`
Expected: PASS

Run: `npx nx run-many -t typecheck lint -p @beacon/rules`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add firestore.rules libs/rules/src/lib/launches.spec.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(rules): ouvre à tout utilisateur la lecture des mises en place abouties" -m "Le document ne porte que des identifiants de session et des durées, tous mondes d'un jeu confondus : rien n'y distingue un monde, donc rien n'y demande l'appartenance à un monde." -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 4: La mise en place qui aboutit, gardée avec celles de son jeu

**Files:**
- Modify: `apps/functions/src/agent-report.ts`
- Modify: `apps/functions/src/agent-report.spec.ts`
- Modify: `apps/functions/src/platform-journal.ts`
- Modify: `apps/functions/src/container.ts`

**Interfaces:**
- Consumes: `completedSetup(sessionId, openedAt, at)` de `@beacon/session` (tâche 1) ; `CompletedSetupStore` et `completedSetupStore(db)` de `@beacon/session-record` (tâche 2).
- Produces:
  - `AgentReportDeps.completedSetups: CompletedSetupStore`
  - la source `'agentReport.completedSetup'` de `FailureSource`

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `apps/functions/src/agent-report.spec.ts`, ajouter dans l'objet que `fakeDeps` rend, après la ligne `setups: { for: vi.fn(() => setup) },` :

```ts
    completedSetups: { keep: vi.fn(async () => undefined) },
```

puis ajouter, dans `describe('agentReport', …)`, juste après la fermeture du bloc `describe('the setup a game server declares', …)` :

```ts
  describe('the setup that comes into service', () => {
    // Opened at 20:00, reported ready at 20:10.
    const TEN_MINUTES = 600_000;

    it('is kept with the ones of its game, with the time it took since the opening', async () => {
      await runAgentReport(deps, TOKEN, { sessionId: 's1', phase: 'ready' });

      expect(deps.completedSetups.keep).toHaveBeenCalledTimes(1);
      expect(deps.completedSetups.keep).toHaveBeenCalledWith('enshrouded', {
        sessionId: 's1',
        durationMs: TEN_MINUTES,
      });
    });

    // What is kept is a setup that completed: the join point is published first.
    it('is kept once the session is in service', async () => {
      await runAgentReport(deps, TOKEN, { sessionId: 's1', phase: 'ready' });

      expect(deps.store.publish.mock.invocationCallOrder[0]).toBeLessThan(
        deps.completedSetups.keep.mock.invocationCallOrder[0],
      );
    });

    it('is not kept again by a ready report on a session already in service', async () => {
      deps = fakeDeps({ session: runningSession('s1') });

      await runAgentReport(deps, TOKEN, { sessionId: 's1', phase: 'ready' });

      expect(deps.completedSetups.keep).not.toHaveBeenCalled();
    });

    // The doubled entry refuses every join point: the session stays in
    // preparation, and its setup did not complete.
    it('is not kept when the session does not come into service', async () => {
      deps = fakeDeps({ session: provisioningSession('s1', 'sunkenland') });

      await runAgentReport(deps, TOKEN, { sessionId: 's1', phase: 'ready' });

      expect(deps.store.publish).not.toHaveBeenCalled();
      expect(deps.completedSetups.keep).not.toHaveBeenCalled();
    });

    it('is not kept by a report that is not ready', async () => {
      await runAgentReport(deps, TOKEN, { sessionId: 's1', phase: 'alive' });

      expect(deps.completedSetups.keep).not.toHaveBeenCalled();
    });

    it('leaves the report succeed when it could not be kept, and journals why', async () => {
      deps.completedSetups.keep.mockRejectedValue(new Error('firestore is down'));

      const instructions = await runAgentReport(deps, TOKEN, { sessionId: 's1', phase: 'ready' });

      expect(instructions?.state).toBe('PROVISIONING');
      expect(deps.store.publish).toHaveBeenCalledTimes(1);
      expect(deps.journal.failure).toHaveBeenCalledWith({
        source: 'agentReport.completedSetup',
        sessionId: 's1',
        error: 'Error: firestore is down',
      });
    });
  });
```

- [ ] **Step 2: Lancer les tests et les voir échouer**

Run: `npx nx run @beacon/functions:test`
Expected: FAIL, `keep` n'est jamais appelé.

- [ ] **Step 3: Ajouter la source au journal de la plateforme**

Dans `apps/functions/src/platform-journal.ts`, remplacer la dernière ligne du type `FailureSource` :

```ts
  | 'agentReport.setup';
```

par :

```ts
  | 'agentReport.setup'
  | 'agentReport.completedSetup';
```

- [ ] **Step 4: Garder la mise en place qui aboutit**

Dans `apps/functions/src/agent-report.ts` :

Ajouter `completedSetup` à l'import de `@beacon/session`, parmi les valeurs, à côté de `Save`.

Ajouter `CompletedSetupStore` à l'import de type de `@beacon/session-record`.

Ajouter dans `AgentReportDeps`, après `readonly setups: SetupStores;` :

```ts
  readonly completedSetups: CompletedSetupStore;
```

À la fin de `becomeRunning`, après l'appel `await state.publish(…);`, ajouter :

```ts
  await rememberCompletedSetup(deps, session, now);
```

Ajouter après la fonction `becomeRunning` :

```ts
/**
 * The setup that just came into service joins the last ones of its game, from
 * which the sessions to come announce when they should be ready.
 *
 * It is only ever displayed, so a store that fails here must not cost the
 * report its phase: the session is in service already.
 */
async function rememberCompletedSetup(
  deps: AgentReportDeps,
  session: Session,
  now: Date,
): Promise<void> {
  const { sessionId, game, startedAt } = session;
  if (sessionId === null || game === null || startedAt === null) return;

  try {
    await deps.completedSetups.keep(game, completedSetup(sessionId, startedAt, now));
  } catch (error) {
    deps.journal.failure({
      source: 'agentReport.completedSetup',
      sessionId,
      error: String(error),
    });
  }
}
```

- [ ] **Step 5: Câbler le magasin**

Dans `apps/functions/src/container.ts`, ajouter `completedSetupStore` à l'import de `@beacon/session-record`, puis, dans l'objet que `buildAgentReportDeps` rend, après `setups: setupStores(db),` :

```ts
    completedSetups: completedSetupStore(db),
```

- [ ] **Step 6: Lancer les tests, le lint et le typecheck**

Run: `npx nx run @beacon/functions:test`
Expected: PASS

Run: `npx nx run-many -t typecheck lint -p @beacon/functions`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/functions/src/agent-report.ts apps/functions/src/agent-report.spec.ts apps/functions/src/platform-journal.ts apps/functions/src/container.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(functions): garde la mise en place qui aboutit avec celles de son jeu" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 5: La fourchette publiée avec le monde

**Files:**
- Modify: `libs/session-record/src/lib/client-session.ts`
- Modify: `libs/session-record/src/lib/client-session.spec.ts`
- Modify: `libs/session-record/src/lib/client-session-resilience.spec.ts`
- Modify, le champ `readyWindow: null` de leurs fixtures seulement : `apps/web/src/app/session/closing.component.spec.ts`, `apps/web/src/app/session/in-service.component.spec.ts`, `apps/web/src/app/session/not-cleared.component.spec.ts`, `apps/web/src/app/session/out-of-service.component.spec.ts`, `apps/web/src/app/session/preparing.component.spec.ts`, `apps/web/src/app/session/session.page.spec.ts`, `apps/web/src/app/worlds/overview.spec.ts`, `apps/web/src/app/worlds/world.route.spec.ts`, `apps/web/src/app/worlds/worlds.page.spec.ts`

**Interfaces:**
- Consumes: `readyWindow(opening, durationsMs)` et `ReadyWindow` de `@beacon/session` (tâche 1) ; `completedSetupsFrom`, `gameFrom` et `launchesDocPath` de `./fields.js` (tâche 2) ; `completedSetupStore` de `./completed-setups-record.js` (tâche 2), dans le test.
- Produces: `ServerView.readyWindow: ReadyWindow | null`, publié par `watchWorld` et `watchMyWorlds`. Nul hors de la préparation, et tant que le jeu du monde compte moins de deux mises en place abouties.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `libs/session-record/src/lib/client-session.spec.ts`, ajouter l'import :

```ts
import { completedSetupStore } from './completed-setups-record.js';
```

puis ajouter, à la fin du bloc `describe('the setup of a session that prepares', …)`, juste avant sa fermeture et après le bloc `describe('once it is abandoned', …)` :

```ts
  describe('the ready window it announces', () => {
    const FIVE_MINUTES = 300_000;
    const EIGHT_MINUTES = 480_000;
    const after = (ms: number) => new Date(OPENED.getTime() + ms);

    const completed = async (game: Game, ...durationsMs: number[]): Promise<void> => {
      const store = completedSetupStore(getFirestore());
      for (const [index, durationMs] of durationsMs.entries()) {
        await store.keep(game, { sessionId: `past-${index}`, durationMs });
      }
    };

    it('goes from the shortest to the longest of the last setups of the game', async () => {
      await seedWorld('les-copains', { players: ['alice'] });
      await preparingServer('les-copains', 's1');
      await completed('enshrouded', 360_000, FIVE_MINUTES, EIGHT_MINUTES);

      expect((await view())?.server?.readyWindow).toEqual({
        from: after(FIVE_MINUTES),
        to: after(EIGHT_MINUTES),
      });
    });

    it('is none while the game counts a single completed setup', async () => {
      await seedWorld('les-copains', { players: ['alice'] });
      await preparingServer('les-copains', 's1');
      await completed('enshrouded', FIVE_MINUTES);

      const seen = await view();

      expect(seen?.server?.session.state).toBe('PROVISIONING');
      expect(seen?.server?.readyWindow).toBeNull();
    });

    it('is none while the game kept nothing at all', async () => {
      await seedWorld('les-copains', { players: ['alice'] });
      await preparingServer('les-copains', 's1');

      expect((await view())?.server?.readyWindow).toBeNull();
    });

    it('is drawn from the setups of the world’s own game, and of no other', async () => {
      await seedWorld('les-copains', { players: ['alice'], game: 'sunkenland' });
      await preparingServer('les-copains', 's1');
      await completed('enshrouded', FIVE_MINUTES, EIGHT_MINUTES);

      expect((await view())?.server?.readyWindow).toBeNull();
    });

    it('is none for a world out of service, whatever its game kept', async () => {
      await seedWorld('les-copains', { players: ['alice'] });
      await completed('enshrouded', FIVE_MINUTES, EIGHT_MINUTES);

      const seen = await view();

      expect(seen?.server?.session.state).toBe('IDLE');
      expect(seen?.server?.readyWindow).toBeNull();
    });

    it('follows a setup that completes while the world is watched', async () => {
      await seedWorld('les-copains', { players: ['alice'] });
      await preparingServer('les-copains', 's1');
      await completed('enshrouded', FIVE_MINUTES);
      const seen: (WorldSummary | null)[] = [];
      const unsubscribe = record().watchWorld('les-copains', (summary) => seen.push(summary));
      await vi.waitFor(() => expect(seen.some((summary) => summary !== null)).toBe(true));

      await completedSetupStore(getFirestore()).keep('enshrouded', {
        sessionId: 'another-world',
        durationMs: EIGHT_MINUTES,
      });

      await vi.waitFor(() =>
        expect(seen.at(-1)?.server?.readyWindow).toEqual({
          from: after(FIVE_MINUTES),
          to: after(EIGHT_MINUTES),
        }),
      );
      unsubscribe();
    });
  });
```

Dans `libs/session-record/src/lib/client-session-resilience.spec.ts`, ajouter après l'attente `expect(seen.at(-1)?.server?.setup).toEqual({ … });` :

```ts
    // Nor on `launches`: the world publishes all the same, with no window.
    expect(seen.at(-1)?.server?.readyWindow).toBeNull();
```

- [ ] **Step 2: Lancer les tests et les voir échouer**

Run: `npx nx run @beacon/session-record:test`
Expected: FAIL, `readyWindow` est `undefined` sur la vue publiée.

- [ ] **Step 3: Publier la fourchette**

Dans `libs/session-record/src/lib/client-session.ts` :

Ajouter `readyWindow` et `type ReadyWindow` à l'import de `@beacon/session`.

Ajouter `completedSetupsFrom`, `gameFrom` et `launchesDocPath` à l'import de `./fields.js`.

Remplacer le commentaire et la déclaration de `ServerView` par :

```ts
/**
 * One snapshot of a world's server documents, as the screen needs it: what the
 * domain reads, the three facts §4 says are displayed, the instant the current
 * state began, and what is announced of a setup.
 *
 * `stateSince` travels with them because the aggregate does not carry it, and
 * the screens of a world out of service or not cleared say since when.
 */
export interface ServerView {
  readonly session: Session;
  readonly facts: DisplayedFacts;
  readonly stateSince: Date | null;
  /**
   * What the screen shows of the world's last setup: the step under way while
   * the session prepares, the step it stopped at once it was abandoned, and
   * null otherwise.
   */
  readonly setup: ShownSetup | null;
  /**
   * The two instants between which the server should become joinable, drawn
   * from the last setups of the world's game that came into service. Null out
   * of a setup, and while that game counts fewer than two.
   */
  readonly readyWindow: ReadyWindow | null;
}
```

Dans `watchWorldSummary`, ajouter après `let setupData: Record<string, unknown> | undefined;` :

```ts
    let completedData: Record<string, unknown> | undefined;
    let unsubCompleted: Unsubscribe | null = null;
```

Dans `publish`, remplacer tout ce qui suit le test `if (world === null) { onSummary(null); return; }` jusqu'à la fin de l'appel `onSummary({ … });` par :

```ts
          // After the world and never before: the listener it waits for only
          // opens on a world that names a game, which this one now does.
          if (completedData === undefined) return;

          const session = sessionFrom(serverData, world);
          if (session === null) {
            onSummary({ world, server: null });
            return;
          }
          const opening = lastOpeningFrom(serverData, session.state);
          onSummary({
            world,
            server: {
              session,
              facts: displayedFactsFrom(serverData),
              stateSince: toDate(serverData['stateSince']),
              setup: shownSetup(opening, abandonedSetupFrom(serverData), keptSetupFrom(setupData)),
              readyWindow: readyWindow(
                opening,
                completedSetupsFrom(completedData).map((completed) => completed.durationMs),
              ),
            },
          });
```

Ajouter après la déclaration de `publish` et avant `const unsubWorld = …` :

```ts
    // One document per game, and a world never changes game: the listener
    // opens on the first snapshot of the world that names one, and stays.
    // Absent or refused, it reads as nothing kept, and no window is announced.
    const watchCompletedSetups = (world: Record<string, unknown>): void => {
      const game = gameFrom(world);
      if (game === null || unsubCompleted !== null) return;
      unsubCompleted = onSnapshot(
        doc(db, launchesDocPath(game)),
        (snapshot) => {
          completedData = snapshot.data() ?? {};
          publish();
        },
        () => {
          completedData = {};
          publish();
        },
      );
    };
```

Dans le premier rappel de `unsubWorld`, remplacer :

```ts
        worldData = snapshot.exists() ? (snapshot.data() ?? {}) : null;
        publish();
```

par :

```ts
        worldData = snapshot.exists() ? (snapshot.data() ?? {}) : null;
        if (worldData !== null) watchCompletedSetups(worldData);
        publish();
```

Dans la fonction de désabonnement que `watchWorldSummary` rend, ajouter après `unsubSetup();` :

```ts
      unsubCompleted?.();
```

- [ ] **Step 4: Donner le champ aux fixtures de `apps/web`**

Dans chacun des neuf fichiers de test de `apps/web` que cette tâche nomme, ajouter `readyWindow: null` à chaque objet qui porte `stateSince` et qui est une vue de serveur, juste après son champ `setup` :

- `closing.component.spec.ts`, ligne 27
- `in-service.component.spec.ts`, lignes 33 et 126
- `not-cleared.component.spec.ts`, près de la ligne 29
- `out-of-service.component.spec.ts`, près de la ligne 16
- `preparing.component.spec.ts`, ligne 50
- `session.page.spec.ts`, lignes 55 et 116
- `overview.spec.ts`, ligne 36
- `world.route.spec.ts`, ligne 22
- `worlds.page.spec.ts`, lignes 39 et 45

Run: `grep -rn "stateSince" apps/web/src --include=*.spec.ts`
Expected: chaque objet listé porte `readyWindow: null`.

- [ ] **Step 5: Lancer les tests, le lint et le typecheck**

Run: `npx nx run @beacon/session-record:test`
Expected: PASS

Run: `npx nx run web:test`
Expected: PASS

Run: `npx nx run-many -t typecheck lint -p @beacon/session-record web`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add libs/session-record/src/lib/client-session.ts libs/session-record/src/lib/client-session.spec.ts libs/session-record/src/lib/client-session-resilience.spec.ts apps/web/src/app/session/closing.component.spec.ts apps/web/src/app/session/in-service.component.spec.ts apps/web/src/app/session/not-cleared.component.spec.ts apps/web/src/app/session/out-of-service.component.spec.ts apps/web/src/app/session/preparing.component.spec.ts apps/web/src/app/session/session.page.spec.ts apps/web/src/app/worlds/overview.spec.ts apps/web/src/app/worlds/world.route.spec.ts apps/web/src/app/worlds/worlds.page.spec.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(session-record): publie la fourchette de disponibilité avec le monde" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 6: L'écran annonce la fourchette qu'il reçoit

**Files:**
- Modify: `apps/web/src/app/format.ts`
- Modify: `apps/web/src/app/format.spec.ts`
- Modify: `apps/web/src/app/session/preparing.component.ts`
- Modify: `apps/web/src/app/session/preparing.component.spec.ts`
- Modify: `apps/web/src/app/worlds/worlds.page.ts`
- Modify: `apps/web/src/app/worlds/worlds.page.spec.ts`

**Interfaces:**
- Consumes: `ReadyWindow` de `@beacon/session` (tâche 1) ; `ServerView.readyWindow` de `@beacon/session-record/client` (tâche 5).
- Produces: `windowLabel(window: ReadyWindow): { from: string; to: string }` dans `apps/web/src/app/format.ts`. `readyWindow` et `BOOT_WINDOW_MS` quittent ce fichier.

`.impeccable/surfaces/apps-web-src-app-session-session-page-html.md` et `.impeccable/mocks/progress/README.md` portent la décision validée sur l'écran sans heure à annoncer : la ligne de la fourchette disparaît et rien ne la remplace. Les gabarits la tiennent déjà, et cette tâche n'y change aucun mot ni aucune règle de style.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `apps/web/src/app/format.spec.ts`, retirer `BOOT_WINDOW_MS` et `readyWindow` de l'import de `./format`, y ajouter `windowLabel`, puis remplacer le bloc `describe('readyWindow', …)` entier par :

```ts
describe('windowLabel', () => {
  it('writes the two hours of a window, to the minute', () => {
    expect(
      windowLabel({
        from: new Date('2026-09-12T20:19:10'),
        to: new Date('2026-09-12T20:22:05'),
      }),
    ).toEqual({ from: '20:19', to: '20:22' });
  });

  it('writes a window that crosses midnight', () => {
    expect(
      windowLabel({
        from: new Date('2026-09-12T23:58:40'),
        to: new Date('2026-09-13T00:03:10'),
      }),
    ).toEqual({ from: '23:58', to: '00:03' });
  });
});
```

Dans `apps/web/src/app/session/preparing.component.spec.ts` :

Remplacer l'import de `@beacon/session` par :

```ts
import {
  DEFAULT_SETTINGS,
  Deadline,
  Session,
  type ReadyWindow,
  type ShownSetup,
} from '@beacon/session';
```

Ajouter après la constante `FIRST_STEP` :

```ts
  const WINDOW: ReadyWindow = {
    from: new Date('2026-09-12T20:19:10'),
    to: new Date('2026-09-12T20:22:05'),
  };
```

Remplacer la signature de `render` et l'objet passé à `setInput('view', …)` : le second paramètre devient `readyWindow: ReadyWindow | null = WINDOW`, et la vue devient :

```ts
    fixture.componentRef.setInput('view', {
      session,
      facts: { ip: null, joinInfo: null, lastError: null },
      stateSince: startedAt,
      setup,
      readyWindow,
    });
```

Remplacer les deux tests `announces a window and never a single hour` et `announces no window when it has no instant to open one from`, avec le commentaire qui précède le premier, par :

```ts
  /** Two setups of the same game end minutes apart: an hour contradicted releases nobody. */
  it('announces the window it is given, and never a single hour', async () => {
    const fixture = await render();

    expect(fixture.nativeElement.textContent).toContain('Ready between');
    expect(field(fixture, 'ready-window')).toBe('20:19 – 20:22');
    expect(fixture.nativeElement.textContent).not.toContain('Ready around');
  });

  // The game counts too few completed setups to draw a window from: the line
  // goes, and nothing stands in for it.
  it('announces no window when it is given none, and nothing in its place', async () => {
    const fixture = await render(FIRST_STEP, null);

    expect(fixture.nativeElement.textContent).not.toContain('Ready between');
    expect(field(fixture, 'ready-window')).toBeNull();
    expect(field(fixture, 'step-name')).toBe('Waking the server');
    expect(field(fixture, 'closes-at')).toBe('00:14');
  });

  // The session opened at 20:14: the window is the one it is given, whatever
  // the fixed five to eight minutes would have made of that hour.
  it('computes no hour of the window itself', async () => {
    const fixture = await render(FIRST_STEP, {
      from: new Date('2026-09-12T20:31:00'),
      to: new Date('2026-09-12T20:47:00'),
    });

    expect(field(fixture, 'ready-window')).toBe('20:31 – 20:47');
  });
```

Dans `apps/web/src/app/worlds/worlds.page.spec.ts`, ajouter `type ReadyWindow` à l'import de `@beacon/session`, puis ajouter après la fonction `idle` :

```ts
const preparing = (
  worldId: string,
  name: string,
  readyWindow: ReadyWindow | null,
): WorldSummary => ({
  world: world(worldId, name),
  server: {
    session: Session.from({
      state: 'PROVISIONING',
      worldId,
      sessionId: `s-${worldId}`,
      game: 'enshrouded',
      startedBy: 'u1',
      startedAt: STARTED_AT,
      deadline: Deadline.at(new Date('2026-09-13T00:14:00')),
      instanceSize: 'DEV1-L',
      hasJoinInfo: false,
    }),
    facts: NO_FACTS,
    stateSince: STARTED_AT,
    setup: null,
    readyWindow,
  },
});
```

et ajouter dans `describe('WorldsPage', …)`, après le test `reads the time left and the closing hour on a world in service` :

```ts
  it('reads the window it is given on a world that prepares', async () => {
    const dom = await render([
      preparing('p', 'Le camp du lac', {
        from: new Date('2026-09-12T20:31:00'),
        to: new Date('2026-09-12T20:47:00'),
      }),
    ]);

    expect(dom.querySelector('[data-field="world-state"]')?.textContent).toContain('Preparing');
    expect(dom.querySelector('[data-field="ready-window"]')?.textContent).toBe('20:31 – 20:47');
    expect(dom.querySelector('[data-field="closes-at"]')?.textContent).toContain('00:14');
  });

  it('reads no window on a world that prepares and is given none', async () => {
    const dom = await render([preparing('p', 'Le camp du lac', null)]);

    expect(dom.querySelector('[data-field="ready-window"]')).toBeNull();
    expect(dom.textContent).not.toContain('Ready between');
    expect(dom.querySelector('[data-field="closes-at"]')?.textContent).toContain('00:14');
  });
```

- [ ] **Step 2: Lancer les tests et les voir échouer**

Run: `npx nx run web:test`
Expected: FAIL, `windowLabel` n'est pas exporté par `./format`.

- [ ] **Step 3: Mettre la fourchette en forme dans `format.ts`**

Dans `apps/web/src/app/format.ts` :

Ajouter `type ReadyWindow` à l'import de `@beacon/session`.

Supprimer la constante `BOOT_WINDOW_MS` avec tout son commentaire.

Remplacer la fonction `readyWindow` et son commentaire par :

```ts
/** The two hours of a ready window, as the board writes them. */
export function windowLabel(window: ReadyWindow): { from: string; to: string } {
  return { from: hourLabel(window.from), to: hourLabel(window.to) };
}
```

- [ ] **Step 4: Annoncer la fourchette reçue pendant la préparation**

Dans `apps/web/src/app/session/preparing.component.ts` :

Dans l'import de `../format`, remplacer `readyWindow` par `windowLabel`.

Dans le commentaire de la classe, remplacer les deux derniers paragraphes, de `A window and never an hour, and it is the probe that imposes it` jusqu'à `a different one the day a state precedes another.`, par :

```ts
 * A window and never an hour: two setups of the same game end minutes apart,
 * and an hour contradicted releases nobody. It is drawn from the last setups
 * of the game that came into service, and this screen computes neither of
 * its hours. While the game counts too few, the line goes and nothing stands
 * in for it.
```

Remplacer le champ `window` de la classe par :

```ts
  readonly window = computed(() => {
    const window = this.view().readyWindow;
    return window === null ? null : windowLabel(window);
  });
```

- [ ] **Step 5: Annoncer la fourchette reçue dans la liste des mondes**

Dans `apps/web/src/app/worlds/worlds.page.ts` :

Dans l'import de `../format`, remplacer `readyWindow` par `windowLabel`.

Dans `band`, remplacer :

```ts
      window:
        session.state === 'PROVISIONING' && server.stateSince !== null
          ? readyWindow(server.stateSince)
          : null,
```

par :

```ts
      window: server.readyWindow === null ? null : windowLabel(server.readyWindow),
```

- [ ] **Step 6: Lancer les tests, le lint et le typecheck**

Run: `npx nx run web:test`
Expected: PASS

Run: `npx nx run-many -t typecheck lint -p web`
Expected: PASS

Run: `grep -rn "BOOT_WINDOW_MS\|readyWindow(" apps/web/src`
Expected: aucune ligne.

- [ ] **Step 7: Vérifier la branche entière**

Run: `npx nx run-many -t test -p @beacon/session @beacon/session-record @beacon/rules @beacon/functions web`
Expected: PASS

Run: `npx nx run-many -t typecheck lint -p @beacon/session @beacon/session-record @beacon/rules @beacon/functions web companion`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/app/format.ts apps/web/src/app/format.spec.ts apps/web/src/app/session/preparing.component.ts apps/web/src/app/session/preparing.component.spec.ts apps/web/src/app/worlds/worlds.page.ts apps/web/src/app/worlds/worlds.page.spec.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(web): annonce la fourchette tirée des mises en place abouties du jeu" -m "Les deux durées fixes quittent l'écran : tant qu'un jeu compte moins de deux mises en place abouties, la ligne de la fourchette disparaît." -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

## Before the merge

Cette story change `libs/session`, que l'image du compagnon embarque. `companion:test` reste rouge sur `names an image built from the sources in the tree` tant que l'image n'est pas republiée.

Une fois la revue accordée et les `fixup!` écrasés :

1. Le commanditaire pose le tag `companion-v0.13` sur la tête de la branche et le pousse. Le workflow `companion` publie l'image.
2. `npx nx run companion:pin -- 0.13` récrit `deploy/cloud-init/src/lib/companion-image.ts`.
3. Le changement est commité sous `build(cloud-init): épingle le compagnon 0.13` et poussé.
4. `npx nx run companion:test` passe.

Un commit qui touche `libs/session`, `libs/agent-protocol`, `libs/scaleway-storage` ou `deploy/companion/src` après le tag demande un nouveau tag.

## Rulings log

Ruling: la tâche 6 est acceptée sans exécution rouge de ses tests — son implémenteur a écrit tests et code avant le premier lancement, et rejouer le rouge demande de défaire son commit — si c'est faux, un test de cette tâche passerait aussi sans le code ; sa revue en relève un seul, `announces the window it is given, and never a single hour`, dont les heures sont celles de l'ancienne fourchette fixe.

Ruling: le commentaire du test `computes no hour of the window itself` ne cite plus les « five to eight minutes » que le plan lui donnait — le plan interdit par ailleurs tout reste de la fourchette fixe dans `apps/web` — si c'est faux, un commentaire de test s'écarte du texte du plan.

Ruling: la revue de chaque tâche a tourné pendant l'implémentation de la suivante — les deux touchent des fichiers disjoints, et la revue ne lit que le diff commité — si c'est faux, une correction de revue arrive après le commit suivant, en `fixup!`.

Ruling: la skill `impeccable` n'a pas été invoquée pour la tâche des écrans — cette story ne change ni gabarit, ni feuille de style, ni mot visible, et l'écran sans fourchette suit la décision déjà validée de `.impeccable/mocks/progress/README.md` — si c'est faux, un écart de mise en page sur l'écran sans fourchette n'est vu qu'à la revue.

Ruling: la vague de corrections de la revue de la branche prend l'import collé et le commentaire de l'attente dans `client-session`, l'ordre d'import de `format.spec.ts`, la durée nulle de la fixture des règles, et le semis des mises en place abouties par l'outil d'écrans de développement — la revue de la branche les relève, et le commanditaire demande de prendre dans la pull request ce qui tient en quelques lignes — si c'est faux, un commit de plus touche `apps/functions/src/screen.ts` et son test, hors des fichiers que les tâches nomment.

Ruling: dans l'outil d'écrans de développement, la session de l'écran de préparation s'ouvre quarante secondes avant l'instant donné, et non quatre-vingt-dix minutes — la fourchette part de l'ouverture, et une ouverture ancienne l'annoncerait dans le passé — si c'est faux, l'écran de préparation de développement montre une heure d'ouverture et un coût qui ne sont plus ceux des autres écrans.

Ruling: restent en l'état une durée négative que `completedSetup` accepte, le test du plafond qui parcourt un `setups` non typé, la garde `game === null` inatteignable de `rememberCompletedSetup`, l'absence de test sur un monde absent ou de jeu inconnu passé la nouvelle attente, et le premier test de fourchette de `preparing.component.spec.ts` — la revue de la branche les juge sans effet : le lecteur écarte toute durée négative ou nulle, et deux autres tests échouent sur l'ancien calcul — si c'est faux, un test de régression manque sur la porte de publication de `watchWorldSummary`.

Ruling: la collection se nomme `completedSetups`, et ses deux fonctions `completedSetupsDocPath` et `completedSetupsDocument`, là où le design du lot et le plan de cette story écrivent `launches` — le commanditaire le tranche à la revue : « launch » n'est pas un terme du glossaire, et la spec, le domaine, le magasin et le champ disent « mise en place aboutie », `CompletedSetup`, `CompletedSetupStore` et `setups` — si c'est faux, le nom de la collection s'écarte de celui que le document du lot porte, et le renommer après son premier déploiement demande une migration.

Technical design ruling: `readyWindow` reçoit la dernière session ouverte, `LastOpening`, et non la seule heure d'ouverture, et ne rend rien hors de la préparation — « pendant la mise en place » est une règle de la spec, que le domaine tient ainsi et teste sans émulateur — si c'est faux, le record lit l'état de la session pour la fourchette comme il le lit déjà pour `shownSetup`.

Technical design ruling: `completedSetups/{game}` garde cinq mises en place abouties, et non cinq au moins — la fourchette n'en lit jamais plus, et un plafond égal à ce qu'elle lit tient en une constante — si c'est faux, changer le nombre de mises en place dont la fourchette se tire demande d'attendre que le document se remplisse.

Technical design ruling: le domaine porte aussi ce qu'un jeu garde quand une mise en place aboutit, `keepCompletedSetup`, et la durée d'une mise en place aboutie, `completedSetup` — le design ne nomme que la fonction de la fourchette, et la transaction du magasin n'a plus qu'à lire et écrire — si c'est faux, deux fonctions pures de plus dans `libs/session`, donc dans l'image du compagnon.

Technical design ruling: un échec de l'écriture dans `completedSetups` va au journal de la plateforme sous une source nouvelle, `agentReport.completedSetup` — le design dit que cet échec y va sans nommer de source — si c'est faux, une source de trop dans `FailureSource`.

Technical design ruling: l'écoute de `completedSetups/{game}` s'ouvre au premier instantané du monde qui nomme un jeu, une par monde suivi — le record ne connaît le jeu d'un monde qu'après l'avoir lu, et un monde ne change jamais de jeu — si c'est faux, la liste des mondes tient une écoute par monde sur le même document, que le SDK ne lit qu'une fois.

## Observed drift

Aucune.
