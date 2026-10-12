# L'étape gardée Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Le plan de contrôle reçoit l'étape qu'un serveur de jeu déclare pendant sa mise en place, la garde dans `worlds/{worldId}/server/setup` et écrit chaque changement d'étape ou d'activité au journal de la plateforme, sans rien changer à l'écran.

**Architecture:** `libs/session` déclare les étapes, les activités, l'avancement et la fonction pure `advanceSetup`, qui décide de ce qu'une déclaration fait de l'étape gardée. `libs/agent-protocol` porte la déclaration sous `setup`, que `parseReport` écarte sans refuser le rapport quand elle est mal formée. `libs/session-record` garde l'étape dans un document à elle, avec deux gestes, commencer et avancer ; `provision` commence avec l'ordre que le catalogue donne pour le jeu, et `agentReport` avance pendant la préparation.

**Tech Stack:** TypeScript, Vitest, émulateur Firestore, règles Firestore, Nx.

**Spec:** docs/specs/session.md
**Batch:** docs/batches/03-progression-de-la-mise-en-place/README.md
**Sections:** Ubiquitous language
**Blocks:** D1

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

`deploy/companion`, `apps/web` et `probe/` ne changent pas.

Aucune tâche ne modifie `deploy/cloud-init/src/lib/companion-image.ts`, ne lance `companion:pin`, ni ne pose de tag git.

À partir de la tâche 1, `companion:test` échoue sur le seul test `names an image built from the sources in the tree` de `deploy/companion/src/pin/catalogue-pin.spec.ts`. Cet échec est attendu jusqu'à l'épinglage décrit sous `Before the merge`, et aucune tâche ne le corrige.

Le rapport ne gagne ni `gameLog` ni seconde cadence.

`AgentReport.setup` ne porte que des valeurs de `SETUP_STEPS`, de `SETUP_ACTIVITIES` et un entier de 0 à 100 : aucune chaîne libre venue du serveur de jeu n'atteint `server/setup`.

Aucune commande n'atteint la production : ni `firebase deploy`, ni appel à un fournisseur, ni tag git. Les tests tournent contre l'émulateur.

### Les commandes

Les tests se lancent par Nx, un projet à la fois :

```bash
npx nx run @beacon/session:test
npx nx run agent-protocol:test
npx nx run cloud-init:test
npx nx run @beacon/session-record:test
npx nx run @beacon/rules:test
npx nx run @beacon/functions:test
```

`@beacon/session-record:test`, `@beacon/rules:test` et `@beacon/functions:test` démarrent l'émulateur Firestore eux-mêmes.

### Les commits

Chaque commit passe par `bash ~/.config/github-app/as-agent.sh git commit`, et son message finit par `Co-Authored-By: Charlouze <me@charlouze.com>`.

Aucun commit, commentaire ni document ne mentionne un assistant ou un outil d'IA.

Le sujet d'un commit suit Conventional Commits, en français, à l'impératif, en minuscule, sans point final.

Le code et ses commentaires sont en anglais. Ce document est en français.

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

- Un rapport `ready` dont `setup` est mal formé met la session en service, et le nom du champ écarté va au journal de la plateforme. Tâches 2 et 7.
- Un rapport sans `setup`, celui d'un compagnon d'avant ce lot, est traité comme aujourd'hui et n'appelle pas le magasin de la mise en place. Tâche 7.
- Une déclaration reçue alors que `server/setup` n'existe pas, parce que commencer a échoué, n'écrit rien et laisse le rapport réussir. Tâches 4 et 7.
- Une déclaration reçue pour une session que `server/current` ne porte plus, ou qui n'est plus en préparation, n'écrit rien. Tâche 4.
- Un échec du magasin pendant qu'il avance ne fait pas échouer un rapport `ready`. Tâche 7.

---

### Task 1: Les étapes, les activités et la transition, dans le domaine

**Files:**
- Create: `libs/session/src/lib/setup.ts`
- Create: `libs/session/src/lib/setup.spec.ts`
- Modify: `libs/session/src/index.ts`

**Interfaces:**
- Consumes: rien.
- Produces, exportés par `@beacon/session` :
  - `SETUP_STEPS`, `type SetupStep`, `isSetupStep(value: unknown): value is SetupStep`
  - `SETUP_ACTIVITIES`, `type SetupActivity`, `isSetupActivity(value: unknown): value is SetupActivity`
  - `type SetupProgress = number`, `isSetupProgress(value: unknown): value is SetupProgress`
  - `type SetupStepOrder = readonly SetupStep[]`, `isSetupStepOrder(value: unknown): value is SetupStepOrder`
  - `interface SetupDeclaration { step; activity?; progress? }`
  - `interface KeptSetupStep { step; since: Date; activity: SetupActivity | null; progress: SetupProgress | null }`
  - `type SetupChange = 'step' | 'activity' | 'progress'`
  - `interface SetupAdvance { kept: KeptSetupStep; changed: SetupChange | null; left: { step: SetupStep; since: Date } | null }`
  - `firstSetupStep(openedAt: Date): KeptSetupStep`
  - `advanceSetup(kept: KeptSetupStep, declared: SetupDeclaration, at: Date): SetupAdvance`

- [ ] **Step 1: Écrire le test qui échoue**

`libs/session/src/lib/setup.spec.ts` :

```ts
import { describe, expect, it } from 'vitest';
import {
  advanceSetup,
  firstSetupStep,
  isSetupProgress,
  isSetupStepOrder,
  type KeptSetupStep,
} from './setup.js';

const OPENED = new Date('2026-10-12T20:00:00Z');
const LATER = new Date('2026-10-12T20:02:00Z');

const kept = (parts: Partial<KeptSetupStep> = {}): KeptSetupStep => ({
  step: 'fetching-game',
  since: OPENED,
  activity: null,
  progress: null,
  ...parts,
});

describe('firstSetupStep', () => {
  it('starts on the waking step, at the opening of the session', () => {
    expect(firstSetupStep(OPENED)).toEqual({
      step: 'waking',
      since: OPENED,
      activity: null,
      progress: null,
    });
  });
});

describe('advanceSetup', () => {
  it('replaces the kept step by another one, from the instant it was declared', () => {
    const advance = advanceSetup(kept(), { step: 'starting-game' }, LATER);

    expect(advance).toEqual({
      kept: { step: 'starting-game', since: LATER, activity: null, progress: null },
      changed: 'step',
      left: { step: 'fetching-game', since: OPENED },
    });
  });

  // Nothing checks what a game server declares: a step that comes earlier in
  // the game's order replaces the kept one exactly as a later one does.
  it('follows a declaration that goes back to an earlier step', () => {
    const advance = advanceSetup(kept({ step: 'starting-game' }), { step: 'waking' }, LATER);

    expect(advance.kept).toEqual({ step: 'waking', since: LATER, activity: null, progress: null });
    expect(advance.changed).toBe('step');
    expect(advance.left).toEqual({ step: 'starting-game', since: OPENED });
  });

  it('drops the activity and the progress of the step it leaves', () => {
    const advance = advanceSetup(
      kept({ activity: 'downloading', progress: 80 }),
      { step: 'restoring-world' },
      LATER,
    );

    expect(advance.kept.activity).toBeNull();
    expect(advance.kept.progress).toBeNull();
  });

  it('changes nothing when the same step is declared twice', () => {
    const before = kept({ activity: 'downloading', progress: 40 });

    const advance = advanceSetup(
      before,
      { step: 'fetching-game', activity: 'downloading', progress: 40 },
      LATER,
    );

    expect(advance).toEqual({ kept: before, changed: null, left: null });
  });

  it('keeps the instant the step began when only its progress moves', () => {
    const advance = advanceSetup(
      kept({ activity: 'downloading', progress: 40 }),
      { step: 'fetching-game', activity: 'downloading', progress: 41 },
      LATER,
    );

    expect(advance.kept).toEqual(kept({ activity: 'downloading', progress: 41 }));
    expect(advance.changed).toBe('progress');
    expect(advance.left).toBeNull();
  });

  it('reports an activity that changes inside the same step', () => {
    const advance = advanceSetup(
      kept({ activity: 'downloading', progress: 100 }),
      { step: 'fetching-game', activity: 'unpacking' },
      LATER,
    );

    expect(advance.kept).toEqual(kept({ activity: 'unpacking', progress: null }));
    expect(advance.changed).toBe('activity');
    expect(advance.left).toBeNull();
  });
});

describe('isSetupProgress', () => {
  it('takes a whole percentage and nothing else', () => {
    expect(isSetupProgress(0)).toBe(true);
    expect(isSetupProgress(100)).toBe(true);
    expect(isSetupProgress(101)).toBe(false);
    expect(isSetupProgress(-1)).toBe(false);
    expect(isSetupProgress(41.5)).toBe(false);
    expect(isSetupProgress(Number.NaN)).toBe(false);
    expect(isSetupProgress('41')).toBe(false);
  });
});

describe('isSetupStepOrder', () => {
  it('takes the four steps once each, waking first and starting-game last', () => {
    expect(
      isSetupStepOrder(['waking', 'restoring-world', 'fetching-game', 'starting-game']),
    ).toBe(true);
    expect(
      isSetupStepOrder(['waking', 'fetching-game', 'restoring-world', 'starting-game']),
    ).toBe(true);
  });

  it('refuses an order that misses, repeats or misplaces a step', () => {
    expect(isSetupStepOrder(['waking', 'fetching-game', 'starting-game'])).toBe(false);
    expect(
      isSetupStepOrder(['waking', 'fetching-game', 'fetching-game', 'starting-game']),
    ).toBe(false);
    expect(
      isSetupStepOrder(['fetching-game', 'waking', 'restoring-world', 'starting-game']),
    ).toBe(false);
    expect(
      isSetupStepOrder(['waking', 'starting-game', 'restoring-world', 'fetching-game']),
    ).toBe(false);
    expect(isSetupStepOrder('waking')).toBe(false);
  });
});
```

- [ ] **Step 2: Lancer le test et le voir échouer**

Run: `npx nx run @beacon/session:test`
Expected: FAIL, `Failed to resolve import "./setup.js"`.

- [ ] **Step 3: Écrire l'implémentation**

`libs/session/src/lib/setup.ts` :

```ts
/**
 * What a session goes through between its opening and its coming into
 * service. The first step starts at the opening and the last one is the game
 * starting; the order of the two others depends on the game.
 */
export const SETUP_STEPS = ['waking', 'fetching-game', 'restoring-world', 'starting-game'] as const;

export type SetupStep = (typeof SETUP_STEPS)[number];

export function isSetupStep(value: unknown): value is SetupStep {
  return SETUP_STEPS.includes(value as SetupStep);
}

/**
 * What a game server does inside a step. One closed list for every game: a
 * game uses the activities that suit it, and a new one is a value added here.
 */
export const SETUP_ACTIVITIES = ['downloading', 'unpacking'] as const;

export type SetupActivity = (typeof SETUP_ACTIVITIES)[number];

export function isSetupActivity(value: unknown): value is SetupActivity {
  return SETUP_ACTIVITIES.includes(value as SetupActivity);
}

/** The share already done of the current activity, or of the step when it has none: a whole percentage. */
export type SetupProgress = number;

export function isSetupProgress(value: unknown): value is SetupProgress {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100;
}

/** The four steps in the order one game goes through them. */
export type SetupStepOrder = readonly SetupStep[];

export function isSetupStepOrder(value: unknown): value is SetupStepOrder {
  if (!Array.isArray(value) || value.length !== SETUP_STEPS.length) return false;
  if (!SETUP_STEPS.every((step) => value.includes(step))) return false;
  return value[0] === 'waking' && value[value.length - 1] === 'starting-game';
}

/** What a game server says of its own setup. Nothing checks it. */
export interface SetupDeclaration {
  readonly step: SetupStep;
  readonly activity?: SetupActivity;
  readonly progress?: SetupProgress;
}

/** The step the control plane holds for a session, and the instant it began. */
export interface KeptSetupStep {
  readonly step: SetupStep;
  readonly since: Date;
  readonly activity: SetupActivity | null;
  readonly progress: SetupProgress | null;
}

export type SetupChange = 'step' | 'activity' | 'progress';

export interface SetupAdvance {
  readonly kept: KeptSetupStep;
  /** The coarsest thing that moved, or null when the declaration repeats what is kept. */
  readonly changed: SetupChange | null;
  /** The step that was left and the instant it had begun, when the step changed. */
  readonly left: { readonly step: SetupStep; readonly since: Date } | null;
}

export function firstSetupStep(openedAt: Date): KeptSetupStep {
  return { step: SETUP_STEPS[0], since: openedAt, activity: null, progress: null };
}

/**
 * What a declaration makes of the kept step. Another step replaces it from
 * `at`, whether it comes before or after it in the game's order; the same
 * step keeps its instant and takes the declared activity and progress.
 */
export function advanceSetup(
  kept: KeptSetupStep,
  declared: SetupDeclaration,
  at: Date,
): SetupAdvance {
  const activity = declared.activity ?? null;
  const progress = declared.progress ?? null;

  if (declared.step !== kept.step) {
    return {
      kept: { step: declared.step, since: at, activity, progress },
      changed: 'step',
      left: { step: kept.step, since: kept.since },
    };
  }

  return {
    kept: { ...kept, activity, progress },
    changed: changeWithinStep(kept, activity, progress),
    left: null,
  };
}

function changeWithinStep(
  kept: KeptSetupStep,
  activity: SetupActivity | null,
  progress: SetupProgress | null,
): SetupChange | null {
  if (activity !== kept.activity) return 'activity';
  if (progress !== kept.progress) return 'progress';
  return null;
}
```

Dans `libs/session/src/index.ts`, ajouter après la ligne `export * from './lib/settings.js';` :

```ts
export * from './lib/setup.js';
```

- [ ] **Step 4: Lancer le test et le voir passer**

Run: `npx nx run @beacon/session:test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/session/src/lib/setup.ts libs/session/src/lib/setup.spec.ts libs/session/src/index.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(session): décide de ce qu'une déclaration fait de l'étape gardée" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 2: Le rapport porte la déclaration

**Files:**
- Modify: `libs/agent-protocol/src/lib/report.ts`
- Modify: `libs/agent-protocol/src/lib/report.spec.ts`
- Modify: `apps/functions/src/main.ts:118-124`

**Interfaces:**
- Consumes: `SetupDeclaration`, `isSetupStep`, `isSetupActivity`, `isSetupProgress` de `@beacon/session` (tâche 1).
- Produces :
  - `AgentReport.setup?: SetupDeclaration`
  - `interface ParsedReport { readonly report: AgentReport; readonly discarded: readonly string[] }`
  - `parseReport(body: unknown): ParsedReport | null`

- [ ] **Step 1: Adapter les tests existants à la nouvelle forme**

Dans `libs/agent-protocol/src/lib/report.spec.ts`, chaque assertion existante de la forme `expect(parseReport(X)).toEqual({ … })` devient `expect(parseReport(X)?.report).toEqual({ … })`. Les assertions `toBeNull()` ne changent pas.

- [ ] **Step 2: Écrire les tests qui échouent**

Ajouter à la fin du `describe('parseReport', …)` de `libs/agent-protocol/src/lib/report.spec.ts` :

```ts
  it('reads the setup a game server declares, with its activity and its progress', () => {
    const setup = { step: 'fetching-game', activity: 'downloading', progress: 41 };

    expect(parseReport({ sessionId: 's1', phase: 'alive', setup })).toEqual({
      report: { sessionId: 's1', phase: 'alive', setup },
      discarded: [],
    });
  });

  it('reads a setup that declares a step and nothing else', () => {
    const parsed = parseReport({ sessionId: 's1', phase: 'alive', setup: { step: 'waking' } });

    expect(parsed?.report.setup).toEqual({ step: 'waking' });
  });

  it('says it discarded nothing when the report carries no setup', () => {
    expect(parseReport({ sessionId: 's1', phase: 'alive' })?.discarded).toEqual([]);
  });

  const MALFORMED_SETUPS: readonly (readonly [string, unknown])[] = [
    ['a step outside the list', { step: 'booting' }],
    ['no step at all', { activity: 'downloading' }],
    ['an activity outside the list', { step: 'fetching-game', activity: 'compiling' }],
    ['a progress above a hundred', { step: 'fetching-game', progress: 101 }],
    ['a progress below zero', { step: 'fetching-game', progress: -1 }],
    ['a progress that is not whole', { step: 'fetching-game', progress: 41.5 }],
    ['a progress that is not a number', { step: 'fetching-game', progress: '41' }],
    ['a setup that is not an object', 'fetching-game'],
    ['a null setup', null],
  ];

  for (const [name, setup] of MALFORMED_SETUPS) {
    it(`discards ${name} without refusing the report`, () => {
      expect(parseReport({ sessionId: 's1', phase: 'alive', setup })).toEqual({
        report: { sessionId: 's1', phase: 'alive' },
        discarded: ['setup'],
      });
    });
  }

  // What is displayed must not cost a session: a server that became joinable
  // is put into service whatever it said of its setup.
  it('lets a ready report through with a malformed setup, and names what it discarded', () => {
    expect(
      parseReport({ sessionId: 's1', phase: 'ready', ip: '51.15.42.7', setup: { step: 42 } }),
    ).toEqual({
      report: { sessionId: 's1', phase: 'ready', ip: '51.15.42.7' },
      discarded: ['setup'],
    });
  });
```

- [ ] **Step 3: Lancer les tests et les voir échouer**

Run: `npx nx run agent-protocol:test`
Expected: FAIL, les assertions sur `.report` et `.discarded` lisent `undefined`.

- [ ] **Step 4: Écrire l'implémentation**

Dans `libs/agent-protocol/src/lib/report.ts`, remplacer la ligne d'import par :

```ts
import {
  isSetupActivity,
  isSetupProgress,
  isSetupStep,
  SAVE_ORIGINS,
  type SaveOrigin,
  type SessionId,
  type SessionState,
  type SetupDeclaration,
} from '@beacon/session';
```

Ajouter à `AgentReport`, après le champ `world` :

```ts
  /**
   * While the server sets itself up: the step it is on. Displayed and never
   * acted upon, which is why a malformed one is discarded rather than
   * refused.
   */
  readonly setup?: SetupDeclaration;
```

Ajouter avant `parseReport` :

```ts
/** A report the frontier accepted, and the fields it carried that were discarded. */
export interface ParsedReport {
  readonly report: AgentReport;
  readonly discarded: readonly string[];
}

function setupFrom(value: unknown): SetupDeclaration | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const { step, activity, progress } = raw;

  if (!isSetupStep(step)) return null;
  if (activity !== undefined && !isSetupActivity(activity)) return null;
  if (progress !== undefined && !isSetupProgress(progress)) return null;

  return {
    step,
    ...(activity === undefined ? {} : { activity }),
    ...(progress === undefined ? {} : { progress }),
  };
}
```

Remplacer le commentaire et la signature de `parseReport` par :

```ts
/**
 * The anti-corruption layer (§4). It reads a body that came from the least
 * trusted element of the system (§7) and answers a value the domain recognises,
 * or null.
 *
 * It never repairs and never passes an unknown field through. A parser that
 * coerced would make the endpoint's behaviour depend on what the machine felt
 * like sending, which is the opposite of what a frontier is for.
 *
 * One exception: a malformed `setup` is discarded and named, and the report
 * stands. It is only ever displayed, and a `ready` report must not fall on it.
 */
export function parseReport(body: unknown): ParsedReport | null {
```

Dans le type local de `report`, ajouter `setup?: SetupDeclaration;` après `world?: { name: string; guid: string };`.

Remplacer le `return report;` final par :

```ts
  const discarded: string[] = [];

  if (raw['setup'] !== undefined) {
    const setup = setupFrom(raw['setup']);
    if (setup === null) discarded.push('setup');
    else report.setup = setup;
  }

  return { report, discarded };
```

Dans `apps/functions/src/main.ts`, remplacer :

```ts
    const report = parseReport(request.body);
    if (token === null || report === null) {
      response.status(400).send();
      return;
    }

    const instructions = await runAgentReport(buildAgentReportDeps(), token, report);
```

par :

```ts
    const parsed = parseReport(request.body);
    if (token === null || parsed === null) {
      response.status(400).send();
      return;
    }

    const instructions = await runAgentReport(buildAgentReportDeps(), token, parsed.report);
```

- [ ] **Step 5: Lancer les tests et les voir passer**

Run: `npx nx run agent-protocol:test`
Expected: PASS.

Run: `npx nx run @beacon/functions:test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add libs/agent-protocol/src/lib/report.ts libs/agent-protocol/src/lib/report.spec.ts apps/functions/src/main.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(agent-protocol): porte l'étape déclarée sous setup" -m "Un setup mal formé est écarté et nommé, sans refuser le rapport : un rapport ready ne doit pas tomber sur une donnée d'affichage." -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 3: Chaque jeu donne l'ordre de ses étapes

**Files:**
- Modify: `deploy/cloud-init/src/lib/catalog.ts` (interface `GameCatalogEntry`)
- Modify: `deploy/cloud-init/src/lib/enshrouded.ts` (objet `enshrouded`)
- Modify: `deploy/cloud-init/src/lib/sunkenland.ts` (objet `sunkenland`)
- Modify: `deploy/cloud-init/src/lib/catalog.spec.ts`

**Interfaces:**
- Consumes: `SetupStepOrder`, `isSetupStepOrder` de `@beacon/session` (tâche 1).
- Produces: `GameCatalogEntry.setupStepOrder: SetupStepOrder`, lu par `catalogFor(game).setupStepOrder`.

- [ ] **Step 1: Écrire le test qui échoue**

Dans `deploy/cloud-init/src/lib/catalog.spec.ts`, ajouter `isSetupStepOrder` à l'import de `@beacon/session` :

```ts
import { isSetupStepOrder, type Game } from '@beacon/session';
```

et ajouter à la fin du fichier :

```ts
describe('the order a game goes through its setup', () => {
  for (const game of GAMES) {
    it(`holds the four steps once, waking first and starting-game last, for ${game}`, () => {
      expect(isSetupStepOrder(catalogFor(game).setupStepOrder)).toBe(true);
    });
  }

  it('restores the world before the container fetches the game, for enshrouded', () => {
    expect(catalogFor('enshrouded').setupStepOrder).toEqual([
      'waking',
      'restoring-world',
      'fetching-game',
      'starting-game',
    ]);
  });

  it('fetches the game from the depot before it restores the world, for sunkenland', () => {
    expect(catalogFor('sunkenland').setupStepOrder).toEqual([
      'waking',
      'fetching-game',
      'restoring-world',
      'starting-game',
    ]);
  });
});
```

- [ ] **Step 2: Lancer le test et le voir échouer**

Run: `npx nx run cloud-init:test`
Expected: FAIL, `setupStepOrder` vaut `undefined`.

- [ ] **Step 3: Écrire l'implémentation**

Dans `deploy/cloud-init/src/lib/catalog.ts`, remplacer la première ligne par :

```ts
import type { Game, JoinInfo, SetupStepOrder, WorldId } from '@beacon/session';
```

et ajouter à `GameCatalogEntry`, après le champ `diskGb` :

```ts
  /**
   * The four steps of a setup in the order this game goes through them. The
   * two in the middle swap from one game to the other: it depends on whether
   * the game is fetched by its own container or brought back from the depot.
   */
  readonly setupStepOrder: SetupStepOrder;
```

Dans `deploy/cloud-init/src/lib/enshrouded.ts`, ajouter à l'objet `enshrouded`, après `diskGb: 30,` :

```ts
  // The restore brings the world back before the game's own container starts
  // and downloads the game.
  setupStepOrder: ['waking', 'restoring-world', 'fetching-game', 'starting-game'],
```

Dans `deploy/cloud-init/src/lib/sunkenland.ts`, ajouter à l'objet `sunkenland`, après `diskGb: 40,` :

```ts
  // The restore brings the game back from the depot first, then the world.
  setupStepOrder: ['waking', 'fetching-game', 'restoring-world', 'starting-game'],
```

- [ ] **Step 4: Lancer le test et le voir passer**

Run: `npx nx run cloud-init:test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add deploy/cloud-init/src/lib/catalog.ts deploy/cloud-init/src/lib/enshrouded.ts deploy/cloud-init/src/lib/sunkenland.ts deploy/cloud-init/src/lib/catalog.spec.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(cloud-init): donne l'ordre des étapes de chaque jeu" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 4: Le magasin de la mise en place

**Files:**
- Modify: `libs/session-record/src/lib/fields.ts`
- Create: `libs/session-record/src/lib/setup-record.ts`
- Create: `libs/session-record/src/lib/setup-record.spec.ts`
- Modify: `libs/session-record/src/index.ts`

**Interfaces:**
- Consumes: `advanceSetup`, `firstSetupStep`, `isSetupActivity`, `isSetupProgress`, `isSetupStep`, `KeptSetupStep`, `SetupAdvance`, `SetupDeclaration`, `SetupStepOrder` de `@beacon/session` (tâche 1).
- Produces, exportés par `@beacon/session-record` :
  - `setupDocPath(worldId: WorldId): string`, qui rend `worlds/{worldId}/server/setup`
  - `keptSetupFrom(data: Record<string, unknown>): KeptSetupStep | null`
  - `interface SetupStore { begin(sessionId: SessionId, order: SetupStepOrder, openedAt: Date): Promise<void>; advance(sessionId: SessionId, declared: SetupDeclaration, at: Date): Promise<SetupAdvance | null> }`
  - `interface SetupStores { for(worldId: WorldId): SetupStore }`
  - `setupStores(db: Firestore): SetupStores`

`advance` rend `null` quand il n'a rien appliqué : `server/current` porte une autre session ou n'est plus en préparation, ou `server/setup` manque, porte une autre session ou est illisible.

- [ ] **Step 1: Écrire le test qui échoue**

`libs/session-record/src/lib/setup-record.spec.ts` :

```ts
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { serverDocPath, setupDocPath, toDate } from './fields.js';
import { setupStores, type SetupStore } from './setup-record.js';

process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';

const OPENED = new Date('2026-10-12T20:00:00Z');
const AT = new Date('2026-10-12T20:02:00Z');
const ORDER = ['waking', 'restoring-world', 'fetching-game', 'starting-game'] as const;

const SERVER_DOC = serverDocPath('w1');
const SETUP_DOC = setupDocPath('w1');

let app: ReturnType<typeof initializeApp>;
let db: Firestore;
let store: SetupStore;

const preparing = (sessionId: string) =>
  db.doc(SERVER_DOC).set({ state: 'PROVISIONING', sessionId });

const setup = async () => (await db.doc(SETUP_DOC).get()).data();

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-beacon' }, 'setup-record-spec');
  db = getFirestore(app);
  store = setupStores(db).for('w1');
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await db.doc(SERVER_DOC).delete();
  await db.doc(SETUP_DOC).delete();
});

describe('setupDocPath', () => {
  it('sits beside the session context of its world', () => {
    expect(setupDocPath('w1')).toBe('worlds/w1/server/setup');
  });
});

describe('begin', () => {
  it('writes the session, the order of its game and the first step since the opening', async () => {
    await store.begin('s1', ORDER, OPENED);

    const data = await setup();
    expect(data).toEqual({
      sessionId: 's1',
      stepOrder: [...ORDER],
      step: 'waking',
      stepSince: expect.anything(),
      activity: null,
      progress: null,
    });
    expect(toDate(data?.['stepSince'])).toEqual(OPENED);
  });

  // Nothing ever deletes this document: the setup of the next session is what
  // erases the previous one, whole.
  it('rewrites everything the previous setup left', async () => {
    await db.doc(SETUP_DOC).set({
      sessionId: 's0',
      stepOrder: ['waking', 'fetching-game', 'restoring-world', 'starting-game'],
      step: 'fetching-game',
      stepSince: new Date('2026-10-11T20:00:00Z'),
      activity: 'downloading',
      progress: 80,
      stray: 'left over',
    });

    await store.begin('s1', ORDER, OPENED);

    const data = await setup();
    expect(data?.['sessionId']).toBe('s1');
    expect(data?.['step']).toBe('waking');
    expect(data?.['activity']).toBeNull();
    expect(data?.['progress']).toBeNull();
    expect(data).not.toHaveProperty('stray');
  });
});

describe('advance', () => {
  it('replaces the step, from the instant it was declared, and answers what changed', async () => {
    await preparing('s1');
    await store.begin('s1', ORDER, OPENED);

    const advance = await store.advance(
      's1',
      { step: 'fetching-game', activity: 'downloading', progress: 3 },
      AT,
    );

    expect(advance).toEqual({
      kept: { step: 'fetching-game', since: AT, activity: 'downloading', progress: 3 },
      changed: 'step',
      left: { step: 'waking', since: OPENED },
    });
    const data = await setup();
    expect(data?.['step']).toBe('fetching-game');
    expect(toDate(data?.['stepSince'])).toEqual(AT);
    expect(data?.['activity']).toBe('downloading');
    expect(data?.['progress']).toBe(3);
    expect(data?.['stepOrder']).toEqual([...ORDER]);
  });

  it('keeps the instant the step began when only its progress moves', async () => {
    await preparing('s1');
    await store.begin('s1', ORDER, OPENED);
    await store.advance('s1', { step: 'fetching-game', progress: 3 }, AT);

    const advance = await store.advance(
      's1',
      { step: 'fetching-game', progress: 4 },
      new Date('2026-10-12T20:02:10Z'),
    );

    expect(advance?.changed).toBe('progress');
    const data = await setup();
    expect(toDate(data?.['stepSince'])).toEqual(AT);
    expect(data?.['progress']).toBe(4);
  });

  it('answers that nothing changed when the same declaration comes twice', async () => {
    await preparing('s1');
    await store.begin('s1', ORDER, OPENED);

    const advance = await store.advance('s1', { step: 'waking' }, AT);

    expect(advance?.changed).toBeNull();
    expect(toDate((await setup())?.['stepSince'])).toEqual(OPENED);
  });

  it('writes nothing when the kept setup belongs to another session', async () => {
    await preparing('s1');
    await store.begin('s0', ORDER, OPENED);

    const advance = await store.advance('s1', { step: 'fetching-game' }, AT);

    expect(advance).toBeNull();
    expect((await setup())?.['step']).toBe('waking');
  });

  it('writes nothing when the world moved on to another session', async () => {
    await preparing('s2');
    await store.begin('s1', ORDER, OPENED);

    const advance = await store.advance('s1', { step: 'fetching-game' }, AT);

    expect(advance).toBeNull();
    expect((await setup())?.['step']).toBe('waking');
  });

  it('writes nothing once the session is no longer preparing', async () => {
    await db.doc(SERVER_DOC).set({ state: 'RUNNING', sessionId: 's1' });
    await store.begin('s1', ORDER, OPENED);

    const advance = await store.advance('s1', { step: 'starting-game' }, AT);

    expect(advance).toBeNull();
    expect((await setup())?.['step']).toBe('waking');
  });

  it('writes nothing, and creates nothing, when no setup was begun', async () => {
    await preparing('s1');

    const advance = await store.advance('s1', { step: 'fetching-game' }, AT);

    expect(advance).toBeNull();
    expect(await setup()).toBeUndefined();
  });

  it('writes nothing over a kept setup it cannot read', async () => {
    await preparing('s1');
    await db.doc(SETUP_DOC).set({ sessionId: 's1', step: 'booting', stepSince: OPENED });

    const advance = await store.advance('s1', { step: 'fetching-game' }, AT);

    expect(advance).toBeNull();
    expect((await setup())?.['step']).toBe('booting');
  });
});
```

- [ ] **Step 2: Lancer le test et le voir échouer**

Run: `npx nx run @beacon/session-record:test`
Expected: FAIL, `Failed to resolve import "./setup-record.js"`.

- [ ] **Step 3: Écrire l'implémentation**

Dans `libs/session-record/src/lib/fields.ts`, ajouter à l'import de `@beacon/session` les noms `isSetupActivity`, `isSetupProgress`, `isSetupStep` et `type KeptSetupStep`, puis ajouter après `serverDocPath` :

```ts
/** `worlds/{worldId}/server/setup` — the step the session's setup is on. */
export function setupDocPath(worldId: WorldId): string {
  return `${WORLDS}/${worldId}/server/setup`;
}

/**
 * `worlds/{worldId}/server/setup` as the domain reads it. Null means the
 * document names no step this vocabulary recognises. An activity or a
 * progress it does not recognise reads as none.
 */
export function keptSetupFrom(data: Record<string, unknown>): KeptSetupStep | null {
  const step = data['step'];
  const since = toDate(data['stepSince']);
  if (!isSetupStep(step) || since === null) return null;
  const activity = data['activity'];
  const progress = data['progress'];
  return {
    step,
    since,
    activity: isSetupActivity(activity) ? activity : null,
    progress: isSetupProgress(progress) ? progress : null,
  };
}
```

`libs/session-record/src/lib/setup-record.ts` :

```ts
import {
  advanceSetup,
  firstSetupStep,
  type KeptSetupStep,
  type SessionId,
  type SetupAdvance,
  type SetupDeclaration,
  type SetupStepOrder,
  type WorldId,
} from '@beacon/session';
import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { keptSetupFrom, serverDocPath, setupDocPath } from './fields.js';

export interface SetupStore {
  /** Rewrites the whole document: nothing else ever erases the previous setup. */
  begin(sessionId: SessionId, order: SetupStepOrder, openedAt: Date): Promise<void>;
  /**
   * Applies what a game server declares to the kept step. Null when nothing
   * was applied: the world holds another session, the session is no longer
   * preparing, or no setup was begun for it.
   */
  advance(
    sessionId: SessionId,
    declared: SetupDeclaration,
    at: Date,
  ): Promise<SetupAdvance | null>;
}

export interface SetupStores {
  for(worldId: WorldId): SetupStore;
}

const stepFields = (kept: KeptSetupStep): Record<string, unknown> => ({
  step: kept.step,
  stepSince: Timestamp.fromDate(kept.since),
  activity: kept.activity,
  progress: kept.progress,
});

/**
 * A document of its own, beside `server/current` and never inside it: every
 * write to `server/current` wakes the state-change trigger, and a progress
 * arrives several times a minute.
 */
export function setupStores(db: Firestore): SetupStores {
  return {
    for(worldId: WorldId): SetupStore {
      const setupDoc = () => db.doc(setupDocPath(worldId));
      const serverDoc = () => db.doc(serverDocPath(worldId));

      return {
        async begin(sessionId, order, openedAt): Promise<void> {
          await setupDoc().set({
            sessionId,
            stepOrder: [...order],
            ...stepFields(firstSetupStep(openedAt)),
          });
        },

        async advance(sessionId, declared, at): Promise<SetupAdvance | null> {
          return db.runTransaction(async (transaction) => {
            const [server, setup] = await transaction.getAll(serverDoc(), setupDoc());
            const current = server.data() ?? {};
            if (current['sessionId'] !== sessionId) return null;
            if (current['state'] !== 'PROVISIONING') return null;

            const data = setup.data() ?? {};
            if (data['sessionId'] !== sessionId) return null;
            const kept = keptSetupFrom(data);
            if (kept === null) return null;

            const advance = advanceSetup(kept, declared, at);
            if (advance.changed !== null) {
              transaction.update(setupDoc(), stepFields(advance.kept));
            }
            return advance;
          });
        },
      };
    },
  };
}
```

Dans `libs/session-record/src/index.ts`, ajouter après `export * from './lib/settings-record.js';` :

```ts
export * from './lib/setup-record.js';
```

- [ ] **Step 4: Lancer le test et le voir passer**

Run: `npx nx run @beacon/session-record:test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/session-record/src/lib/fields.ts libs/session-record/src/lib/setup-record.ts libs/session-record/src/lib/setup-record.spec.ts libs/session-record/src/index.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(session-record): garde l'étape d'une mise en place dans un document à elle" -m "Chaque écriture de server/current relance onServerStateChange : y écrire l'avancement mettrait une Function et une transaction derrière chaque rapport." -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 5: Les règles de `server/setup`

**Files:**
- Modify: `firestore.rules` (bloc `match /worlds/{worldId}`)
- Create: `libs/rules/src/lib/server-setup.spec.ts`

**Interfaces:**
- Consumes: le chemin `worlds/{worldId}/server/setup` (tâche 4).
- Produces: la lecture de `server/setup` pour les membres du monde et les administrateurs, l'écriture pour personne.

- [ ] **Step 1: Invoquer les skills des règles**

Invoquer `firebase-firestore`, puis `firebase-security-rules-auditor`, avant de modifier `firestore.rules`, et suivre ce qu'elles demandent pour ce changement.

- [ ] **Step 2: Écrire le test qui échoue**

`libs/rules/src/lib/server-setup.spec.ts` :

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

const setup = (uid: string | null) => doc(as(env, uid), 'worlds', 'w1', 'server', 'setup');

const KEPT = {
  sessionId: 's1',
  stepOrder: ['waking', 'restoring-world', 'fetching-game', 'starting-game'],
  step: 'fetching-game',
  stepSince: null,
  activity: null,
  progress: null,
};

describe('worlds/{worldId}/server/setup', () => {
  beforeEach(async () => {
    await given(env, 'worlds/w1/server/setup', KEPT);
  });

  it('is read by a member of its world', async () => {
    await assertSucceeds(getDoc(setup(ALICE)));
  });

  it('is read by an admin who never joined the world', async () => {
    await assertSucceeds(getDoc(setup(ROOT)));
  });

  it('is read by nobody outside its world', async () => {
    await assertFails(getDoc(setup(BOB)));
    await assertFails(getDoc(setup(MALLORY)));
    await assertFails(getDoc(setup(null)));
  });

  it('is written by no member, whatever the write', async () => {
    await assertFails(updateDoc(setup(ALICE), { step: 'starting-game' }));
    await assertFails(setDoc(setup(ALICE), { ...KEPT, progress: 100 }));
    await assertFails(deleteDoc(setup(ALICE)));
  });

  it('is written by no admin either', async () => {
    await assertFails(updateDoc(setup(ROOT), { step: 'starting-game' }));
    await assertFails(deleteDoc(setup(ROOT)));
  });

  it('is created by no member on a world that holds none yet', async () => {
    await assertFails(setDoc(doc(as(env, BOB), 'worlds', 'w2', 'server', 'setup'), KEPT));
  });
});
```

- [ ] **Step 3: Lancer le test et le voir échouer**

Run: `npx nx run @beacon/rules:test`
Expected: FAIL sur `is read by a member of its world` et `is read by an admin who never joined the world`. Les refus passent déjà, par la règle finale qui refuse tout.

- [ ] **Step 4: Écrire la règle**

Dans `firestore.rules`, à l'intérieur de `match /worlds/{worldId}`, ajouter après le bloc `match /server/current { … }` :

```
      match /server/setup {
        // Read like the session context beside it, and written by no client:
        // only the Functions hold what a game server declares.
        allow read: if isPlayerOf(worldId) || isAdmin();
      }
```

- [ ] **Step 5: Lancer le test et le voir passer**

Run: `npx nx run @beacon/rules:test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add firestore.rules libs/rules/src/lib/server-setup.spec.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(rules): ouvre la lecture de server/setup aux membres du monde" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 6: `provision` commence la mise en place

**Files:**
- Modify: `apps/functions/src/platform-journal.ts` (type `FailureSource`)
- Modify: `apps/functions/src/provisioning.ts`
- Modify: `apps/functions/src/provisioning.spec.ts`
- Modify: `apps/functions/src/container.ts` (`buildProvisionDeps`)

**Interfaces:**
- Consumes: `SetupStores` et `setupStores` de `@beacon/session-record` (tâche 4), `catalogFor(game).setupStepOrder` (tâche 3).
- Produces: `ProvisionDeps.setups: SetupStores`, et la source d'échec `'provisioning.begin'`.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `apps/functions/src/provisioning.spec.ts`, dans `fakeDeps`, déclarer avant le `return` :

```ts
  const setup = {
    begin: vi.fn(async () => undefined),
    advance: vi.fn(async () => null),
  };
```

et ajouter à l'objet rendu, après `states` :

```ts
    setups: { for: vi.fn(() => setup) },
```

Ajouter dans `describe('provisioning', …)` :

```ts
  it('begins the setup with the order of the game, since the opening of the session', async () => {
    await runStateChange(deps, WORLD_ID, provisioning());

    expect(deps.setups.for).toHaveBeenCalledWith(WORLD_ID);
    expect(deps.setups.for(WORLD_ID).begin).toHaveBeenCalledWith(
      's1',
      ['waking', 'restoring-world', 'fetching-game', 'starting-game'],
      NOW,
    );
  });

  it('begins the setup of the other game with its own order', async () => {
    await runStateChange(deps, WORLD_ID, provisioningSunkenland());

    expect(deps.setups.for(WORLD_ID).begin).toHaveBeenCalledWith(
      's1',
      ['waking', 'fetching-game', 'restoring-world', 'starting-game'],
      NOW,
    );
  });

  it('begins no setup for a session it did not claim', async () => {
    vi.mocked(deps.states.for(WORLD_ID).claimProvisioning).mockResolvedValue(false);

    await runStateChange(deps, WORLD_ID, provisioning());

    expect(deps.setups.for(WORLD_ID).begin).not.toHaveBeenCalled();
  });

  // What is displayed must not cost a session: the server opens all the same,
  // and the failure is kept where the operator reads it.
  it('opens the server when the setup could not begin, and journals why', async () => {
    vi.mocked(deps.setups.for(WORLD_ID).begin).mockRejectedValue(new Error('firestore is down'));

    await runStateChange(deps, WORLD_ID, provisioning());

    expect(deps.host.open).toHaveBeenCalledTimes(1);
    expect(deps.journal.failure).toHaveBeenCalledWith({
      source: 'provisioning.begin',
      sessionId: 's1',
      error: 'Error: firestore is down',
    });
    expect(deps.states.for(WORLD_ID).apply).not.toHaveBeenCalled();
  });
```

`provisioning()` ouvre sa session à `NOW` : `startedAt` et l'horloge du test donnent le même instant, et c'est `startedAt` que le code passe.

- [ ] **Step 2: Lancer les tests et les voir échouer**

Run: `npx nx run @beacon/functions:test`
Expected: FAIL, `begin` n'est jamais appelé.

- [ ] **Step 3: Écrire l'implémentation**

Dans `apps/functions/src/platform-journal.ts`, ajouter `| 'provisioning.begin'` à `FailureSource`, après `'provisioning.setup'`.

Dans `apps/functions/src/provisioning.ts` :

Remplacer les deux lignes d'import concernées par :

```ts
import { catalogFor, renderCloudInit, type SaveAccess } from '@beacon/cloud-init';
```

```ts
import type { Clock, Game, ServerHost, Session, SessionId, WorldId } from '@beacon/session';
import type {
  AdminWorldRecord,
  SettingsStore,
  SetupStores,
  WorldStateStores,
} from '@beacon/session-record';
```

Ajouter à `ProvisionDeps`, après `states` :

```ts
  readonly setups: SetupStores;
```

Dans `provision`, ajouter juste après `if (!claimed) return false;` :

```ts
  await beginSetup(deps, worldId, sessionId, game, session.startedAt ?? now);
```

Ajouter après la fonction `provision` :

```ts
/**
 * The setup is only ever displayed, so failing to begin it stops nothing: the
 * screen stays on the first step for this session, and the operator reads why.
 */
async function beginSetup(
  deps: ProvisionDeps,
  worldId: WorldId,
  sessionId: SessionId,
  game: Game,
  openedAt: Date,
): Promise<void> {
  try {
    await deps.setups.for(worldId).begin(sessionId, catalogFor(game).setupStepOrder, openedAt);
  } catch (error) {
    deps.journal.failure({ source: 'provisioning.begin', sessionId, error: String(error) });
  }
}
```

Dans `apps/functions/src/container.ts`, ajouter `setupStores` à l'import de `@beacon/session-record`, et ajouter à l'objet que `buildProvisionDeps` rend, après `states: worldStateStores(db),` :

```ts
    setups: setupStores(db),
```

- [ ] **Step 4: Lancer les tests et les voir passer**

Run: `npx nx run @beacon/functions:test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/functions/src/platform-journal.ts apps/functions/src/provisioning.ts apps/functions/src/provisioning.spec.ts apps/functions/src/container.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(functions): commence la mise en place à l'ouverture du serveur" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 7: `agentReport` avance et écrit au journal de la plateforme

**Files:**
- Modify: `apps/functions/src/platform-journal.ts`
- Modify: `apps/functions/src/agent-report.ts`
- Modify: `apps/functions/src/agent-report.spec.ts`
- Modify: `apps/functions/src/main.ts`
- Modify: `apps/functions/src/main.spec.ts`
- Modify: `apps/functions/src/container.ts`
- Modify: `apps/functions/src/provisioning.spec.ts`, `apps/functions/src/watchdog.spec.ts`, `apps/functions/src/immediate-pass.spec.ts` (faux journaux)

**Interfaces:**
- Consumes: `SetupStores` (tâche 4), `ParsedReport.discarded` et `AgentReport.setup` (tâche 2), `SetupAdvance` (tâche 1).
- Produces :
  - `AgentReportDeps.setups: SetupStores`
  - `runAgentReport(deps, token, report, discarded?: readonly string[])`
  - `PlatformJournal.setupChanged(entry: JournalledSetupChange): void`
  - `PlatformJournal.discarded(entry: JournalledDiscard): void`
  - la source d'échec `'agentReport.setup'`

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `apps/functions/src/agent-report.spec.ts`, dans `fakeDeps`, déclarer avant le `return` :

```ts
  const setup = {
    begin: vi.fn(async () => undefined),
    advance: vi.fn(async (): Promise<SetupAdvance | null> => null),
  };
```

ajouter à l'objet rendu, après `states` :

```ts
    setups: { for: vi.fn(() => setup) },
```

remplacer `journal: { failure: vi.fn() },` par :

```ts
    journal: { failure: vi.fn(), setupChanged: vi.fn(), discarded: vi.fn() },
```

et ajouter `setup,` à côté de `store,` en fin d'objet. Ajouter `type SetupAdvance` à l'import de `@beacon/session`.

Ajouter dans `describe('agentReport', …)` :

```ts
  describe('the setup a game server declares', () => {
    const OPENED = new Date('2026-09-15T20:00:00Z');
    const DECLARED = { step: 'fetching-game', activity: 'downloading', progress: 3 } as const;

    const stepChanged: SetupAdvance = {
      kept: { step: 'fetching-game', since: NOW, activity: 'downloading', progress: 3 },
      changed: 'step',
      left: { step: 'waking', since: OPENED },
    };

    it('advances the kept step of the world the session was opened on', async () => {
      await runAgentReport(deps, TOKEN, { sessionId: 's1', phase: 'alive', setup: DECLARED });

      expect(deps.setups.for).toHaveBeenCalledWith(WORLD);
      expect(deps.setup.advance).toHaveBeenCalledWith('s1', DECLARED, NOW);
    });

    it('ignores the setup of a session that is no longer preparing', async () => {
      deps = fakeDeps({ session: runningSession('s1') });

      await runAgentReport(deps, TOKEN, { sessionId: 's1', phase: 'alive', setup: DECLARED });

      expect(deps.setup.advance).not.toHaveBeenCalled();
    });

    // The companion of before this protocol field declares nothing.
    it('handles a report without a setup as it always did', async () => {
      const instructions = await runAgentReport(deps, TOKEN, { sessionId: 's1', phase: 'ready' });

      expect(deps.setup.advance).not.toHaveBeenCalled();
      expect(deps.store.publish).toHaveBeenCalledTimes(1);
      expect(instructions?.state).toBe('PROVISIONING');
    });

    it('journals a step that changed, with the step left and the time spent in it', async () => {
      deps.setup.advance.mockResolvedValue(stepChanged);

      await runAgentReport(deps, TOKEN, { sessionId: 's1', phase: 'alive', setup: DECLARED });

      expect(deps.journal.setupChanged).toHaveBeenCalledWith({
        sessionId: 's1',
        worldId: WORLD,
        game: 'enshrouded',
        step: 'fetching-game',
        activity: 'downloading',
        left: { step: 'waking', elapsedMs: NOW.getTime() - OPENED.getTime() },
      });
    });

    it('journals an activity that changed, without a step left', async () => {
      deps.setup.advance.mockResolvedValue({
        kept: { step: 'fetching-game', since: OPENED, activity: 'unpacking', progress: null },
        changed: 'activity',
        left: null,
      });

      await runAgentReport(deps, TOKEN, {
        sessionId: 's1',
        phase: 'alive',
        setup: { step: 'fetching-game', activity: 'unpacking' },
      });

      expect(deps.journal.setupChanged).toHaveBeenCalledWith({
        sessionId: 's1',
        worldId: WORLD,
        game: 'enshrouded',
        step: 'fetching-game',
        activity: 'unpacking',
        left: null,
      });
    });

    it('journals nothing for a progress that moved alone', async () => {
      deps.setup.advance.mockResolvedValue({
        kept: { step: 'fetching-game', since: OPENED, activity: 'downloading', progress: 4 },
        changed: 'progress',
        left: null,
      });

      await runAgentReport(deps, TOKEN, { sessionId: 's1', phase: 'alive', setup: DECLARED });

      expect(deps.journal.setupChanged).not.toHaveBeenCalled();
    });

    it('journals nothing when the store applied nothing', async () => {
      await runAgentReport(deps, TOKEN, { sessionId: 's1', phase: 'alive', setup: DECLARED });

      expect(deps.journal.setupChanged).not.toHaveBeenCalled();
    });

    // A change of step is not a change of state.
    it('files no event for a step that changed', async () => {
      deps.setup.advance.mockResolvedValue(stepChanged);

      await runAgentReport(deps, TOKEN, { sessionId: 's1', phase: 'alive', setup: DECLARED });

      expect(deps.store.apply).not.toHaveBeenCalled();
    });

    it('puts the session into service when the setup could not advance, and journals why', async () => {
      deps.setup.advance.mockRejectedValue(new Error('firestore is down'));

      const instructions = await runAgentReport(deps, TOKEN, {
        sessionId: 's1',
        phase: 'ready',
        setup: { step: 'starting-game' },
      });

      expect(deps.store.publish).toHaveBeenCalledTimes(1);
      expect(instructions).not.toBeNull();
      expect(deps.journal.failure).toHaveBeenCalledWith({
        source: 'agentReport.setup',
        sessionId: 's1',
        error: 'Error: firestore is down',
      });
    });
  });

  describe('the fields the frontier discarded', () => {
    it('are journalled with the session, once the token is verified', async () => {
      await runAgentReport(deps, TOKEN, { sessionId: 's1', phase: 'ready' }, ['setup']);

      expect(deps.journal.discarded).toHaveBeenCalledWith({ sessionId: 's1', fields: ['setup'] });
      expect(deps.store.publish).toHaveBeenCalledTimes(1);
    });

    it('are not journalled for a token that does not verify', async () => {
      deps.tokens.verify.mockResolvedValue(false);

      await runAgentReport(deps, TOKEN, { sessionId: 's1', phase: 'ready' }, ['setup']);

      expect(deps.journal.discarded).not.toHaveBeenCalled();
    });

    it('are not journalled when there are none', async () => {
      await runAgentReport(deps, TOKEN, { sessionId: 's1', phase: 'alive' }, []);

      expect(deps.journal.discarded).not.toHaveBeenCalled();
    });
  });
```

Dans `apps/functions/src/main.spec.ts`, dans le test `answers the instructions on the happy path`, remplacer la dernière assertion par :

```ts
    expect(mockRunAgentReport).toHaveBeenCalledWith(
      undefined,
      'a'.repeat(64),
      { sessionId: 's1', phase: 'alive' },
      [],
    );
```

et ajouter après ce test, dans le même `describe` :

```ts
  it('hands over the fields the frontier discarded, by name', async () => {
    mockRunAgentReport.mockResolvedValueOnce({ state: 'PROVISIONING', deadlineIso: null });

    const response = await post(
      { sessionId: 's1', phase: 'alive', setup: { step: 'booting' } },
      { authorization: `Bearer ${'a'.repeat(64)}` },
    );

    expect(response.status).toBe(200);
    expect(mockRunAgentReport).toHaveBeenLastCalledWith(
      undefined,
      'a'.repeat(64),
      { sessionId: 's1', phase: 'alive' },
      ['setup'],
    );
  });
```

- [ ] **Step 2: Lancer les tests et les voir échouer**

Run: `npx nx run @beacon/functions:test`
Expected: FAIL, `advance`, `setupChanged` et `discarded` ne sont jamais appelés.

- [ ] **Step 3: Étendre le journal de la plateforme**

Dans `apps/functions/src/platform-journal.ts` :

Remplacer la ligne d'import de `@beacon/session` par :

```ts
import type { Game, SessionId, SetupActivity, SetupStep, WorldId } from '@beacon/session';
```

Ajouter `| 'agentReport.setup'` à `FailureSource`, après `'agentReport.machine'`.

Ajouter après `JournalledFailure` :

```ts
/** A setup that moved to another step, or to another activity inside its step. */
export interface JournalledSetupChange {
  readonly sessionId: SessionId;
  readonly worldId: WorldId;
  readonly game: Game;
  readonly step: SetupStep;
  readonly activity: SetupActivity | null;
  /** The step that was left and the time spent in it. Null when only the activity moved. */
  readonly left: { readonly step: SetupStep; readonly elapsedMs: number } | null;
}

/** The fields a report carried and the frontier discarded, by name and never by value. */
export interface JournalledDiscard {
  readonly sessionId: SessionId;
  readonly fields: readonly string[];
}
```

Remplacer l'interface `PlatformJournal` par :

```ts
export interface PlatformJournal {
  failure(entry: JournalledFailure): void;
  setupChanged(entry: JournalledSetupChange): void;
  discarded(entry: JournalledDiscard): void;
}
```

Dans `apps/functions/src/container.ts`, remplacer `platformJournal` par :

```ts
const platformJournal: PlatformJournal = {
  failure: (entry) => logger.error(`${entry.source} failed`, entry),
  setupChanged: (entry) => logger.info('setup changed', entry),
  discarded: (entry) => logger.warn('report fields discarded', entry),
};
```

Ajouter `setupStores` à l'import de `@beacon/session-record` s'il n'y est pas, et ajouter à l'objet que `buildAgentReportDeps` rend, après `states: worldStateStores(db),` :

```ts
    setups: setupStores(db),
```

Chaque faux journal des tests reçoit les deux méthodes. Dans `apps/functions/src/provisioning.spec.ts` et à la ligne 202 de `apps/functions/src/watchdog.spec.ts`, `journal: { failure: vi.fn() }` devient :

```ts
    journal: { failure: vi.fn(), setupChanged: vi.fn(), discarded: vi.fn() },
```

À la ligne 151 de `apps/functions/src/watchdog.spec.ts`, `journal: { failure: (entry) => journalled.push(entry) }` devient :

```ts
  journal: {
    failure: (entry) => journalled.push(entry),
    setupChanged: () => undefined,
    discarded: () => undefined,
  },
```

Aux lignes 149 et 161 de `apps/functions/src/immediate-pass.spec.ts`, `journal: { failure: () => undefined }` devient :

```ts
  journal: { failure: () => undefined, setupChanged: () => undefined, discarded: () => undefined },
```

- [ ] **Step 4: Faire avancer `agentReport`**

Dans `apps/functions/src/agent-report.ts` :

Ajouter `type SetupDeclaration` à l'import de `@beacon/session`, et `SetupStores` à l'import de type de `@beacon/session-record`.

Ajouter à `AgentReportDeps`, après `states` :

```ts
  readonly setups: SetupStores;
```

Remplacer la signature de `runAgentReport` et sa première ligne par :

```ts
export async function runAgentReport(
  deps: AgentReportDeps,
  token: string,
  report: AgentReport,
  discarded: readonly string[] = [],
): Promise<AgentInstructions | null> {
  if (!(await deps.tokens.verify(report.sessionId, token))) return null;

  // After the token and never before: anyone can post a body, and the journal
  // is not where an unauthenticated caller gets to write.
  if (discarded.length > 0) {
    deps.journal.discarded({ sessionId: report.sessionId, fields: discarded });
  }
```

Remplacer :

```ts
  const now = deps.clock.now();
  if (report.phase === 'ready') await becomeRunning(deps, state, worldId, session, report, now);
```

par :

```ts
  const now = deps.clock.now();
  // Before the phase is handled: a `ready` report leaves PROVISIONING, and the
  // step it declares belongs to the setup it is ending.
  if (report.setup !== undefined && session.state === 'PROVISIONING') {
    await keepDeclaredSetup(deps, worldId, session, report.setup, now);
  }
  if (report.phase === 'ready') await becomeRunning(deps, state, worldId, session, report, now);
```

Ajouter après `instructionsFor` :

```ts
/**
 * A change of step is not a change of state: it files no event, and the
 * platform journal is the one place that keeps it. A progress that moves
 * alone is kept nowhere but in the document the screen reads.
 *
 * The setup is only ever displayed, so a store that fails here must not cost
 * the report its phase.
 */
async function keepDeclaredSetup(
  deps: AgentReportDeps,
  worldId: WorldId,
  session: Session,
  declared: SetupDeclaration,
  now: Date,
): Promise<void> {
  const sessionId = session.sessionId;
  const game = session.game;
  if (sessionId === null || game === null) return;

  let advance;
  try {
    advance = await deps.setups.for(worldId).advance(sessionId, declared, now);
  } catch (error) {
    deps.journal.failure({ source: 'agentReport.setup', sessionId, error: String(error) });
    return;
  }
  if (advance === null || advance.changed === null || advance.changed === 'progress') return;

  deps.journal.setupChanged({
    sessionId,
    worldId,
    game,
    step: advance.kept.step,
    activity: advance.kept.activity,
    left:
      advance.left === null
        ? null
        : { step: advance.left.step, elapsedMs: now.getTime() - advance.left.since.getTime() },
  });
}
```

Dans `apps/functions/src/main.ts`, remplacer :

```ts
    const instructions = await runAgentReport(buildAgentReportDeps(), token, parsed.report);
```

par :

```ts
    const instructions = await runAgentReport(
      buildAgentReportDeps(),
      token,
      parsed.report,
      parsed.discarded,
    );
```

- [ ] **Step 5: Lancer les tests et les voir passer**

Run: `npx nx run @beacon/functions:test`
Expected: PASS.

Run: `npx nx run-many -t lint typecheck -p @beacon/session agent-protocol cloud-init @beacon/session-record @beacon/rules @beacon/functions`
Expected: PASS. Une cible qu'un projet ne déclare pas est ignorée par Nx.

- [ ] **Step 6: Commit**

```bash
git add apps/functions/src
bash ~/.config/github-app/as-agent.sh git commit -m "feat(functions): garde l'étape qu'un serveur de jeu déclare et la journalise" -m "Un changement d'étape n'est pas un changement d'état : il n'écrit aucun événement, et seul le journal de la plateforme le reçoit." -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

## Before the merge

Cette story change `libs/session` et `libs/agent-protocol`, que l'image du compagnon embarque. `companion:test` reste rouge sur `names an image built from the sources in the tree` tant que l'image n'est pas republiée.

Une fois la revue accordée et les `fixup!` écrasés :

1. Le commanditaire pose le tag `companion-v0.9` sur la tête de la branche et le pousse. Le workflow `companion` publie l'image.
2. `npx nx run companion:pin -- 0.9` récrit `deploy/cloud-init/src/lib/companion-image.ts`.
3. Le changement est commité sous `build(cloud-init): épingle le compagnon 0.9` et poussé.
4. `npx nx run companion:test` passe.

Un commit qui touche `libs/session` ou `libs/agent-protocol` après le tag demande un nouveau tag.

## Rulings log

## Observed drift
