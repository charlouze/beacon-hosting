# Les étapes déclarées Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un serveur de jeu déclare l'étape, l'activité et l'avancement de sa mise en place, et joint la fin de la sortie du jeu à un échec déclaré, sans rien changer à l'écran.

**Architecture:** `libs/agent-protocol` porte `gameLog`, la seconde cadence et le format du fichier des marqueurs, avec la fonction pure qui décide d'une étape à partir de la sortie d'un jeu. Le catalogue donne pour chaque jeu son étape de départ et ses marqueurs, les dépose sur le serveur de jeu, et y ajoute l'unité systemd qui recopie la sortie du jeu dans un fichier. Le compagnon déclare les étapes de la restauration par des rapports `alive`, puis l'agent déclare à chaque tour l'étape que les marqueurs décident, jusqu'à l'annonce du serveur.

**Tech Stack:** TypeScript, Vitest, Nx, esbuild, Docker Compose, systemd, bash.

**Spec:** docs/specs/session.md
**Batch:** docs/batches/03-progression-de-la-mise-en-place/README.md
**Sections:** none
**Blocks:** none
**Technical:** yes

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

`apps/web`, `libs/session`, `libs/session-record`, `firestore.rules` et `probe/` ne changent pas.

`apps/functions` ne change que par le commentaire que la tâche 1 nomme : le plan de contrôle ne fait rien de `gameLog` dans cette story.

Aucune tâche ne modifie `deploy/cloud-init/src/lib/companion-image.ts`, ne lance `companion:pin`, ni ne pose de tag git.

À partir de la tâche 1, `companion:test` échoue sur le seul test `names an image built from the sources in the tree` de `deploy/companion/src/pin/catalogue-pin.spec.ts`. Cet échec est attendu jusqu'à l'épinglage décrit sous `Before the merge`, et aucune tâche ne le corrige.

Les commentaires de `deploy/companion/src/lib/restore.ts` et de `agent-loop.ts` qui disent qu'un échec déclaré attend le délai d'abandon restent : ils sont vrais tant que l'abandon déclaré n'est pas livré.

Aucun conteneur ne reçoit le socket Docker.

Le compagnon ne nomme aucun jeu : ce qu'il sait d'un jeu lui arrive par ses variables et par le fichier des marqueurs.

Aucune commande n'atteint la production : ni `firebase deploy`, ni appel à un fournisseur, ni tag git. Le test de fumée tourne sur le Docker du poste.

### Les commandes

Les tests se lancent par Nx, un projet à la fois :

```bash
npx nx run agent-protocol:test
npx nx run scaleway-storage:test
npx nx run cloud-init:test
npx nx run companion:test
npx nx run @beacon/functions:test
```

`companion:test` construit le compagnon avant de tourner.

Le test de fumée demande Docker, et prend plusieurs minutes par jeu :

```bash
npx nx run companion:smoke
bash deploy/companion/smoke/run.sh sunkenland
```

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

> If, while conducting a technical story, you discover that it changes something observable at the module's boundary, stop. The story is no longer technical.

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

- Un rapport d'étape de la restauration qui échoue ou qui tarde n'arrête pas la restauration, et le monde est posé quand même. Tâche 6.
- Un téléchargement dont le seau ne donne pas la taille ne déclare aucun avancement et aboutit. Tâches 3 et 6.
- Un fichier de journal absent, ou plus long que ce que l'agent lit, laisse l'agent déclarer une étape et rapporter à sa cadence. Tâche 7.
- Une ligne du journal dont la capture n'est pas un nombre donne l'étape sans avancement. Tâche 2.
- Une fois le serveur annoncé, aucun rapport ne porte `setup` ni `gameLog`, et la cadence revient à 60 s. Tâche 8.

---

### Task 1: Le protocole porte `gameLog` et la seconde cadence

**Files:**
- Modify: `libs/agent-protocol/src/lib/report.ts`
- Modify: `libs/agent-protocol/src/lib/report.spec.ts`
- Modify: `apps/functions/src/main.ts:86` (commentaire)

**Interfaces:**
- Consumes: rien.
- Produces, exportés par `@beacon/agent-protocol` :
  - `AgentReport.gameLog?: string`
  - `GAME_LOG_MAX_CHARS = 16_384`
  - `SETUP_REPORT_INTERVAL_MS = 10_000`
  - `parseReport` écarte et nomme un `gameLog` qui n'est pas une chaîne ou qui dépasse `GAME_LOG_MAX_CHARS`.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `libs/agent-protocol/src/lib/report.spec.ts`, ajouter `GAME_LOG_MAX_CHARS`, `REPORT_INTERVAL_MS` et `SETUP_REPORT_INTERVAL_MS` à l'import de `./report.js`, puis ajouter à la fin du `describe('parseReport', …)` :

```ts
  it('reads the end of the game output a failed report carries', () => {
    const body = { sessionId: 's1', phase: 'failed', detail: 'boom', gameLog: 'line 1\nline 2' };

    expect(parseReport(body)).toEqual({ report: body, discarded: [] });
  });

  it('takes a game output of exactly the bound', () => {
    const gameLog = 'x'.repeat(GAME_LOG_MAX_CHARS);

    expect(parseReport({ sessionId: 's1', phase: 'failed', gameLog })?.report.gameLog).toBe(gameLog);
  });

  // The cause of a failure must reach the control plane whatever the machine
  // attached to it.
  it('discards a game output over the bound without refusing the report', () => {
    const gameLog = 'x'.repeat(GAME_LOG_MAX_CHARS + 1);

    expect(parseReport({ sessionId: 's1', phase: 'failed', detail: 'boom', gameLog })).toEqual({
      report: { sessionId: 's1', phase: 'failed', detail: 'boom' },
      discarded: ['gameLog'],
    });
  });

  it('discards a game output that is not a string', () => {
    expect(parseReport({ sessionId: 's1', phase: 'failed', gameLog: ['line 1'] })).toEqual({
      report: { sessionId: 's1', phase: 'failed' },
      discarded: ['gameLog'],
    });
  });

  it('names every field it discarded', () => {
    const parsed = parseReport({
      sessionId: 's1',
      phase: 'failed',
      setup: { step: 'booting' },
      gameLog: 42,
    });

    expect(parsed?.discarded).toEqual(['setup', 'gameLog']);
  });
```

et à la fin du fichier :

```ts
describe('the cadences of the protocol', () => {
  it('reports every ten seconds while a setup is followed, and once a minute otherwise', () => {
    expect(SETUP_REPORT_INTERVAL_MS).toBe(10_000);
    expect(REPORT_INTERVAL_MS).toBe(60_000);
  });
});
```

- [ ] **Step 2: Lancer les tests et les voir échouer**

Run: `npx nx run agent-protocol:test`
Expected: FAIL, `GAME_LOG_MAX_CHARS` et `SETUP_REPORT_INTERVAL_MS` valent `undefined`.

- [ ] **Step 3: Écrire l'implémentation**

Dans `libs/agent-protocol/src/lib/report.ts`, ajouter à `AgentReport`, après le champ `setup` :

```ts
  /**
   * On `failed`, before the server was announced: the end of what the game
   * printed. Kept for the operator alone, never for a member — which is why a
   * malformed one is discarded rather than refused.
   */
  readonly gameLog?: string;
```

Remplacer le commentaire et la déclaration de `REPORT_INTERVAL_MS` par :

```ts
/**
 * One report a minute once the server is announced, and it lives here rather
 * than in a catalogue entry because it is not a per-game value: two measured
 * guarantees of the spec hang on this number — the machine learns an extension
 * or a stop in under a minute, and the watchdog can tell a slow machine from a
 * mute one. A game that could set it would be a game that can break the
 * protocol.
 */
export const REPORT_INTERVAL_MS = 60_000;

/**
 * The cadence of a server that follows its own setup in the game's output,
 * until it is announced: a step is only worth displaying while it is current.
 */
export const SETUP_REPORT_INTERVAL_MS = 10_000;

/** The most a report carries of the game's output. The machine cuts to it, the frontier checks it. */
export const GAME_LOG_MAX_CHARS = 16_384;
```

Dans le commentaire de `parseReport`, remplacer le dernier paragraphe par :

```ts
 * One exception: a malformed `setup` or `gameLog` is discarded and named, and
 * the report stands. Neither is ever acted upon, and a `ready` or a `failed`
 * report must not fall on it.
```

Dans le type local de `report`, ajouter `gameLog?: string;` après `setup?: SetupDeclaration;`.

Ajouter avant `return { report, discarded };` :

```ts
  if (raw['gameLog'] !== undefined) {
    const gameLog = raw['gameLog'];
    if (typeof gameLog === 'string' && gameLog.length <= GAME_LOG_MAX_CHARS) {
      report.gameLog = gameLog;
    } else {
      discarded.push('gameLog');
    }
  }
```

Dans `apps/functions/src/main.ts`, dans le commentaire de `agentReport`, remplacer `Called roughly once a minute by every live session's companion, and one of` par :

```ts
 * Called by every live session's companion — every ten seconds while a server
 * follows its setup in the game's output, once a minute otherwise — and one of
```

- [ ] **Step 4: Lancer les tests et les voir passer**

Run: `npx nx run agent-protocol:test`
Expected: PASS.

Run: `npx nx run @beacon/functions:test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/agent-protocol/src/lib/report.ts libs/agent-protocol/src/lib/report.spec.ts apps/functions/src/main.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(agent-protocol): porte la fin de la sortie du jeu et une seconde cadence" -m "Un gameLog mal formé est écarté et nommé, sans refuser le rapport : la cause d'un échec ne doit pas tomber sur ce qui l'accompagne." -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 2: Le format des marqueurs, et l'étape qu'ils décident

**Files:**
- Create: `libs/agent-protocol/src/lib/setup-markers.ts`
- Create: `libs/agent-protocol/src/lib/setup-markers.spec.ts`
- Modify: `libs/agent-protocol/src/index.ts`

**Interfaces:**
- Consumes: `isSetupActivity`, `isSetupStep`, `SetupActivity`, `SetupDeclaration`, `SetupStep` de `@beacon/session`.
- Produces, exportés par `@beacon/agent-protocol` :
  - `interface SetupMarker { readonly pattern: string; readonly step: SetupStep; readonly activity?: SetupActivity }`
  - `interface AgentSetup { readonly startStep: SetupStep; readonly markers: readonly SetupMarker[] }`
  - `renderAgentSetup(setup: AgentSetup): string`, une ligne de JSON
  - `parseAgentSetup(text: string): AgentSetup | null`, `null` quand le texte n'est pas un `AgentSetup` lisible
  - `declaredByMarkers(setup: AgentSetup, output: string): SetupDeclaration | null`, `null` quand aucune ligne ne répond à un marqueur

- [ ] **Step 1: Écrire le test qui échoue**

`libs/agent-protocol/src/lib/setup-markers.spec.ts` :

```ts
import { describe, expect, it } from 'vitest';
import {
  declaredByMarkers,
  parseAgentSetup,
  renderAgentSetup,
  type AgentSetup,
} from './setup-markers.js';

const SETUP: AgentSetup = {
  startStep: 'fetching-game',
  markers: [
    { pattern: 'fetching: ([0-9.]+)%', step: 'fetching-game', activity: 'downloading' },
    { pattern: 'fetching', step: 'fetching-game' },
    { pattern: 'installed', step: 'starting-game' },
  ],
};

describe('the file a game server reads its markers from', () => {
  it('is read back as what was written', () => {
    expect(parseAgentSetup(renderAgentSetup(SETUP))).toEqual(SETUP);
  });

  it('is written on one line, so that it sits in a block of a larger file', () => {
    expect(renderAgentSetup(SETUP)).not.toContain('\n');
  });

  it('carries a game that has no marker at all', () => {
    const none: AgentSetup = { startStep: 'starting-game', markers: [] };

    expect(parseAgentSetup(renderAgentSetup(none))).toEqual(none);
  });

  const UNREADABLE: readonly (readonly [string, string])[] = [
    ['what is not json', '{ startStep'],
    ['what is not an object', '"fetching-game"'],
    ['a start step outside the list', '{"startStep":"booting","markers":[]}'],
    ['markers that are not a list', '{"startStep":"waking","markers":{}}'],
    ['a marker without a pattern', '{"startStep":"waking","markers":[{"step":"waking"}]}'],
    ['an empty pattern', '{"startStep":"waking","markers":[{"pattern":"","step":"waking"}]}'],
    [
      'a pattern that is no regular expression',
      '{"startStep":"waking","markers":[{"pattern":"(","step":"waking"}]}',
    ],
    [
      'a marker step outside the list',
      '{"startStep":"waking","markers":[{"pattern":"a","step":"booting"}]}',
    ],
    [
      'a marker activity outside the list',
      '{"startStep":"waking","markers":[{"pattern":"a","step":"waking","activity":"compiling"}]}',
    ],
  ];

  for (const [name, text] of UNREADABLE) {
    it(`refuses ${name}`, () => {
      expect(parseAgentSetup(text)).toBeNull();
    });
  }
});

describe('declaredByMarkers', () => {
  it('declares nothing while no line answers a marker', () => {
    expect(declaredByMarkers(SETUP, 'booting\nstill booting\n')).toBeNull();
    expect(declaredByMarkers(SETUP, '')).toBeNull();
  });

  it('follows the last line that answers a marker', () => {
    const output = 'fetching: 10%\ninstalled\nunrelated\n';

    expect(declaredByMarkers(SETUP, output)).toEqual({ step: 'starting-game' });
  });

  it('follows the first marker of the list on a line that answers several', () => {
    expect(declaredByMarkers(SETUP, 'fetching: 10%\n')).toEqual({
      step: 'fetching-game',
      activity: 'downloading',
      progress: 10,
    });
  });

  it('rounds the captured progress down, and keeps it between 0 and 100', () => {
    expect(declaredByMarkers(SETUP, 'fetching: 36.96%')?.progress).toBe(36);
    expect(declaredByMarkers(SETUP, 'fetching: 250%')?.progress).toBe(100);
  });

  // The game writes this prose, and nothing promises it stays a number.
  it('declares no progress when the capture is not a number', () => {
    const setup: AgentSetup = {
      startStep: 'waking',
      markers: [{ pattern: 'fetching: (\\S*)', step: 'fetching-game' }],
    };

    expect(declaredByMarkers(setup, 'fetching: soon')).toEqual({ step: 'fetching-game' });
    expect(declaredByMarkers(setup, 'fetching: ')).toEqual({ step: 'fetching-game' });
  });

  it('declares a marker without a capture as a step alone', () => {
    expect(declaredByMarkers(SETUP, 'installed')).toEqual({ step: 'starting-game' });
  });

  it('reads lines ended the way wine ends them', () => {
    expect(declaredByMarkers(SETUP, 'fetching: 10%\r\ninstalled\r\n')).toEqual({
      step: 'starting-game',
    });
  });
});
```

- [ ] **Step 2: Lancer le test et le voir échouer**

Run: `npx nx run agent-protocol:test`
Expected: FAIL, `Failed to resolve import "./setup-markers.js"`.

- [ ] **Step 3: Écrire l'implémentation**

`libs/agent-protocol/src/lib/setup-markers.ts` :

```ts
import {
  isSetupActivity,
  isSetupStep,
  type SetupActivity,
  type SetupDeclaration,
  type SetupStep,
} from '@beacon/session';

/**
 * One thing a game prints that says where its setup is. The pattern is tried
 * on each line of the game's output; its first capture group, when it has
 * one, is the progress.
 */
export interface SetupMarker {
  readonly pattern: string;
  readonly step: SetupStep;
  readonly activity?: SetupActivity;
}

/**
 * What a game server declares of its setup once its own container runs: the
 * step it starts on, and what in the game's output moves it. The catalogue
 * writes it and the machine reads it, so both ends of that file live here.
 */
export interface AgentSetup {
  readonly startStep: SetupStep;
  readonly markers: readonly SetupMarker[];
}

/** One line, so that it sits in a block of a larger file. */
export function renderAgentSetup(setup: AgentSetup): string {
  return JSON.stringify({
    startStep: setup.startStep,
    markers: setup.markers.map(({ pattern, step, activity }) => ({
      pattern,
      step,
      ...(activity === undefined ? {} : { activity }),
    })),
  });
}

function markerFrom(value: unknown): SetupMarker | null {
  if (typeof value !== 'object' || value === null) return null;
  const { pattern, step, activity } = value as Record<string, unknown>;

  if (typeof pattern !== 'string' || pattern === '') return null;
  try {
    new RegExp(pattern);
  } catch {
    return null;
  }
  if (!isSetupStep(step)) return null;
  if (activity !== undefined && !isSetupActivity(activity)) return null;

  return { pattern, step, ...(activity === undefined ? {} : { activity }) };
}

/** Null when the text is not a file this protocol wrote. */
export function parseAgentSetup(text: string): AgentSetup | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const { startStep, markers } = raw as Record<string, unknown>;

  if (!isSetupStep(startStep) || !Array.isArray(markers)) return null;
  const read = markers.map(markerFrom);
  if (read.some((marker) => marker === null)) return null;

  return { startStep, markers: read as SetupMarker[] };
}

function progressFrom(captured: string | undefined): number | null {
  if (captured === undefined || captured.trim() === '') return null;
  const value = Number(captured);
  if (!Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.floor(value)));
}

/**
 * What the game's output says of the setup: the last line that answers a
 * marker decides, and on a line that answers several the first of the list
 * wins. Null while no line answers.
 */
export function declaredByMarkers(setup: AgentSetup, output: string): SetupDeclaration | null {
  const markers = setup.markers.map((marker) => ({
    marker,
    expression: new RegExp(marker.pattern),
  }));
  const lines = output.split(/\r?\n/);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    for (const { marker, expression } of markers) {
      const match = expression.exec(lines[index]);
      if (match === null) continue;
      const progress = progressFrom(match[1]);
      return {
        step: marker.step,
        ...(marker.activity === undefined ? {} : { activity: marker.activity }),
        ...(progress === null ? {} : { progress }),
      };
    }
  }
  return null;
}
```

Dans `libs/agent-protocol/src/index.ts`, ajouter après `export * from './lib/report.js';` :

```ts
export * from './lib/setup-markers.js';
```

- [ ] **Step 4: Lancer le test et le voir passer**

Run: `npx nx run agent-protocol:test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/agent-protocol/src/lib/setup-markers.ts libs/agent-protocol/src/lib/setup-markers.spec.ts libs/agent-protocol/src/index.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(agent-protocol): décide d'une étape à partir de la sortie d'un jeu" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 3: Le seau dit où en est un téléchargement

**Files:**
- Modify: `libs/scaleway-storage/src/lib/object-api.ts`
- Modify: `libs/scaleway-storage/src/lib/from-sdk.ts`
- Modify: `libs/scaleway-storage/src/lib/from-sdk.spec.ts`
- Modify: `libs/scaleway-storage/src/lib/fake-object-api.ts`
- Create: `libs/scaleway-storage/src/lib/fake-object-api.spec.ts`

**Interfaces:**
- Consumes: rien.
- Produces, exportés par `@beacon/scaleway-storage` :
  - `type TransferProgress = (receivedBytes: number, totalBytes: number) => void`
  - `ObjectApi.get(key: string, toFile: string, onProgress?: TransferProgress): Promise<void>`

`fromS3` n'appelle `onProgress` que si la réponse du seau porte la taille de l'objet. `fakeObjectApi` l'appelle une fois, l'objet reçu en entier.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `libs/scaleway-storage/src/lib/from-sdk.spec.ts`, ajouter `readFileSync` à l'import de `node:fs` et `Readable` (en valeur, plus en type seul) à celui de `node:stream`, puis ajouter à la fin du fichier :

```ts
/** A client that answers one object, in the chunks given, with or without its size. */
function servingClient(chunks: readonly Buffer[], contentLength?: number): S3Client {
  const client = {
    config: {},
    send: () => Promise.resolve({ Body: Readable.from(chunks), ContentLength: contentLength }),
  };
  return client as unknown as S3Client;
}

describe('getting an object', () => {
  const CHUNKS = [Buffer.alloc(1_000, 1), Buffer.alloc(3_000, 2)];

  it('writes the object to the file, whole', async () => {
    const toFile = join(folder, 'fetched.tar');

    await fromS3(servingClient(CHUNKS, 4_000), 'beacon-games').get('sunkenland/game.tar', toFile);

    expect(readFileSync(toFile).byteLength).toBe(4_000);
  });

  it('says how much arrived, out of the size the bucket answered', async () => {
    const seen: [number, number][] = [];

    await fromS3(servingClient(CHUNKS, 4_000), 'beacon-games').get(
      'sunkenland/game.tar',
      join(folder, 'fetched.tar'),
      (received, total) => seen.push([received, total]),
    );

    expect(seen).toEqual([
      [1_000, 4_000],
      [4_000, 4_000],
    ]);
  });

  // A progress out of an unknown total is no progress: nothing is said, and
  // the object still lands whole.
  it('says nothing when the bucket did not answer a size', async () => {
    const onProgress = vi.fn();
    const toFile = join(folder, 'fetched.tar');

    await fromS3(servingClient(CHUNKS), 'beacon-games').get('sunkenland/game.tar', toFile, onProgress);

    expect(onProgress).not.toHaveBeenCalled();
    expect(readFileSync(toFile).byteLength).toBe(4_000);
  });
});
```

`libs/scaleway-storage/src/lib/fake-object-api.spec.ts` :

```ts
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeObjectApi } from './fake-object-api.js';

let folder: string;

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'beacon-fake-object-api-'));
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

describe('fakeObjectApi', () => {
  it('says the whole object arrived, to whoever asked for the progress of a get', async () => {
    const api = fakeObjectApi();
    const source = join(folder, 'source');
    writeFileSync(source, Buffer.alloc(2_000, 7));
    await api.put('sunkenland/game.tar', source);
    const onProgress = vi.fn();

    await api.get('sunkenland/game.tar', join(folder, 'fetched'), onProgress);

    expect(onProgress).toHaveBeenCalledTimes(1);
    expect(onProgress).toHaveBeenCalledWith(2_000, 2_000);
  });
});
```

- [ ] **Step 2: Lancer les tests et les voir échouer**

Run: `npx nx run scaleway-storage:test`
Expected: FAIL, `onProgress` n'est jamais appelé.

- [ ] **Step 3: Écrire l'implémentation**

Dans `libs/scaleway-storage/src/lib/object-api.ts`, ajouter avant `ObjectApi` :

```ts
/** Called as an object arrives: how many bytes so far, out of how many. */
export type TransferProgress = (receivedBytes: number, totalBytes: number) => void;
```

et remplacer la méthode `get` de `ObjectApi` par :

```ts
  /**
   * Write this key's content to a local file. `onProgress` is called as the
   * bytes arrive, and never when the bucket does not say how large the object
   * is.
   */
  get(key: string, toFile: string, onProgress?: TransferProgress): Promise<void>;
```

Dans `libs/scaleway-storage/src/lib/from-sdk.ts`, remplacer l'import de `node:stream` par :

```ts
import { Transform, type Readable } from 'node:stream';
```

remplacer l'import de `./object-api.js` par :

```ts
import type { ObjectApi, ObjectSummary, TransferProgress } from './object-api.js';
```

remplacer la méthode `get` par :

```ts
    async get(key: string, toFile: string, onProgress?: TransferProgress): Promise<void> {
      const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      if (response.Body === undefined) {
        throw new Error(`s3 returned no body for ${key}`);
      }
      const body = response.Body as Readable;
      const totalBytes = response.ContentLength;
      // Streamed to disk, and awaited: a save that arrives half-written is the
      // failure mode this whole tranche exists to prevent.
      if (onProgress === undefined || totalBytes === undefined) {
        await pipeline(body, createWriteStream(toFile));
        return;
      }
      await pipeline(body, countingBytes(totalBytes, onProgress), createWriteStream(toFile));
    },
```

et ajouter après `fromS3` :

```ts
/** Passes every chunk through untouched, and says how many bytes have gone by. */
function countingBytes(totalBytes: number, onProgress: TransferProgress): Transform {
  let receivedBytes = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding, done): void {
      receivedBytes += chunk.byteLength;
      onProgress(receivedBytes, totalBytes);
      done(null, chunk);
    },
  });
}
```

Dans `libs/scaleway-storage/src/lib/fake-object-api.ts`, remplacer l'import de `./object-api.js` par :

```ts
import type { ObjectApi, ObjectSummary, TransferProgress } from './object-api.js';
```

et la méthode `get` par :

```ts
    async get(key: string, toFile: string, onProgress?: TransferProgress): Promise<void> {
      check();
      const body = stored.get(key);
      if (body === undefined) throw new Error(`no such key: ${key}`);
      writeFileSync(toFile, body);
      onProgress?.(body.byteLength, body.byteLength);
    },
```

- [ ] **Step 4: Lancer les tests et les voir passer**

Run: `npx nx run scaleway-storage:test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/scaleway-storage/src/lib
bash ~/.config/github-app/as-agent.sh git commit -m "feat(scaleway-storage): dit où en est la lecture d'un objet" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 4: Chaque jeu donne son étape de départ et ses marqueurs

**Files:**
- Modify: `eslint.config.mjs` (contrainte `scope:catalog`)
- Modify: `deploy/cloud-init/tsconfig.lib.json`, `deploy/cloud-init/tsconfig.spec.json` (par `npx nx sync`)
- Modify: `deploy/cloud-init/src/lib/catalog.ts`
- Modify: `deploy/cloud-init/src/lib/enshrouded.ts`
- Modify: `deploy/cloud-init/src/lib/sunkenland.ts`
- Modify: `deploy/cloud-init/src/render.ts`
- Modify: `deploy/cloud-init/package.json` (cible `render-setup-markers`)
- Create: `deploy/cloud-init/src/lib/enshrouded-output.spec-helper.ts`
- Modify: `deploy/cloud-init/src/lib/catalog.spec.ts`
- Modify: `deploy/cloud-init/src/lib/enshrouded.spec.ts`

**Interfaces:**
- Consumes: `AgentSetup`, `renderAgentSetup`, `parseAgentSetup`, `declaredByMarkers` de `@beacon/agent-protocol` (tâche 2).
- Produces :
  - `GameCatalogEntry.agentSetup: AgentSetup`
  - `renderSetupMarkers(game: Game): string`, exporté par `@beacon/cloud-init`
  - la cible Nx `cloud-init:render-setup-markers`, qui écrit ce fichier sur la sortie standard pour le jeu de `GAME`

- [ ] **Step 1: Ouvrir la dépendance du catalogue au protocole**

Dans `eslint.config.mjs`, remplacer le bloc de `scope:catalog` et son commentaire par :

```js
            // The catalogue knows images, ports and command-line options. It
            // needs the domain for `Game` and `JoinInfo`, and the protocol for
            // the one file it writes that the machine reads back. Nothing
            // else — an adapter it could reach would let a provider's word
            // back in through the one place §4 keeps free of it.
            {
              sourceTag: 'scope:catalog',
              onlyDependOnLibsWithTags: ['scope:domain', 'scope:protocol'],
            },
```

- [ ] **Step 2: Écrire les tests qui échouent**

`deploy/cloud-init/src/lib/enshrouded-output.spec-helper.ts` :

```ts
/**
 * What this game's container prints on a start that succeeds, as
 * `probe/RESULTS.md`, section P, quotes it and in the order it measured it.
 * The two traps it names are both here: an `ERROR!` on a start that succeeds,
 * and a progress back at zero once the download is over.
 */
export const ENSHROUDED_OUTPUT = [
  "ERROR! Failed to install app '2278520' (Missing configuration)",
  'Update state (0x3) reconfiguring, progress: 0.00 (0 / 0)',
  'Update state (0x61) downloading, progress: 36.46 (3212988231 / 8811579458)',
  'Update state (0x81) verifying update',
  'Update state (0x81) verifying update',
  'Update state (0x81) verifying update',
  'Update state (0x0) unknown, progress: 0.00 (0 / 0)',
  "Success! App '2278520' fully installed.",
  'enshrouded-server: started',
  '[game_server] Switching state from Load to LoadEcsScene',
  '[game_server] Switching state from LoadEcsScene to Run',
] as const;
```

Dans `deploy/cloud-init/src/lib/catalog.spec.ts`, ajouter l'import :

```ts
import { parseAgentSetup, renderAgentSetup } from '@beacon/agent-protocol';
```

ajouter `renderSetupMarkers` à l'import de `./catalog.js`, et ajouter à la fin du fichier :

```ts
describe('what the agent declares of a game', () => {
  for (const game of GAMES) {
    // The first step belongs to the control plane: it starts at the opening
    // of the session, before any machine exists to declare it.
    it(`starts after the first step of the order, and so does every marker, for ${game}`, () => {
      const { agentSetup, setupStepOrder } = catalogFor(game);

      expect(setupStepOrder.indexOf(agentSetup.startStep)).toBeGreaterThan(0);
      for (const marker of agentSetup.markers) {
        expect(setupStepOrder.indexOf(marker.step)).toBeGreaterThan(0);
      }
    });

    it(`is read back by the machine as the entry wrote it, for ${game}`, () => {
      const { agentSetup } = catalogFor(game);

      expect(parseAgentSetup(renderSetupMarkers(game))).toEqual(agentSetup);
      expect(renderSetupMarkers(game)).toBe(renderAgentSetup(agentSetup));
    });
  }

  it('starts on the game fetching itself, for the game its own container downloads', () => {
    expect(catalogFor('enshrouded').agentSetup.startStep).toBe('fetching-game');
  });

  it('starts on the game starting and follows no output, for the game the restore brings back', () => {
    expect(catalogFor('sunkenland').agentSetup).toEqual({
      startStep: 'starting-game',
      markers: [],
    });
  });
});
```

Dans `deploy/cloud-init/src/lib/enshrouded.spec.ts`, ajouter les imports :

```ts
import { declaredByMarkers } from '@beacon/agent-protocol';
import { ENSHROUDED_OUTPUT } from './enshrouded-output.spec-helper.js';
```

et ajouter à la fin du fichier :

```ts
describe('the markers of the enshrouded entry, on the output the probe measured', () => {
  const FETCHING = { step: 'fetching-game' };
  const STARTING = { step: 'starting-game' };

  /** What is declared once each line of the output has been printed, in turn. */
  const EXPECTED = [
    // `ERROR!` is printed on a start that succeeds: no marker stops on it.
    null,
    FETCHING,
    { step: 'fetching-game', activity: 'downloading', progress: 36 },
    FETCHING,
    FETCHING,
    FETCHING,
    // Only a `downloading` line gives a progress: this one says zero once the
    // download is over.
    FETCHING,
    STARTING,
    STARTING,
    STARTING,
    STARTING,
  ];

  ENSHROUDED_OUTPUT.forEach((line, index) => {
    it(`declares the right step after line ${index + 1}: ${line}`, () => {
      const printed = ENSHROUDED_OUTPUT.slice(0, index + 1).join('\n');

      expect(declaredByMarkers(enshrouded.agentSetup, printed)).toEqual(EXPECTED[index]);
    });
  });
});
```

- [ ] **Step 3: Lancer les tests et les voir échouer**

Run: `npx nx run cloud-init:test`
Expected: FAIL, `agentSetup` vaut `undefined` et `renderSetupMarkers` n'est pas exporté.

- [ ] **Step 4: Écrire l'implémentation**

Dans `deploy/cloud-init/src/lib/catalog.ts`, ajouter l'import :

```ts
import { renderAgentSetup, type AgentSetup } from '@beacon/agent-protocol';
```

ajouter à `GameCatalogEntry`, après `setupStepOrder` :

```ts
  /**
   * What the agent declares of this game's setup once the game's own
   * container runs: the step it starts on, and what in the game's output
   * moves it. No marker at all for a game whose output says nothing of it.
   */
  readonly agentSetup: AgentSetup;
```

et ajouter après `renderCompose` :

```ts
/** The file the agent reads its markers from, as a machine of this game receives it. */
export const renderSetupMarkers = (game: Game): string =>
  renderAgentSetup(catalogFor(game).agentSetup);
```

Dans `deploy/cloud-init/src/lib/enshrouded.ts`, ajouter l'import :

```ts
import type { AgentSetup } from '@beacon/agent-protocol';
```

ajouter après `GAME_CONTAINER` :

```ts
/**
 * Measured, `probe/RESULTS.md` section P: the tool that downloads this game
 * prints a state every two seconds or so, and a line once the install is over.
 * Only a `downloading` line gives a progress — the others print one that says
 * zero — and no marker stops on `ERROR!`, which a start that succeeds prints
 * too.
 */
const AGENT_SETUP: AgentSetup = {
  // The agent starts once the game's container does, and that container
  // begins by downloading the game.
  startStep: 'fetching-game',
  markers: [
    {
      pattern: 'Update state \\(0x[0-9a-f]+\\) downloading, progress: ([0-9.]+)',
      step: 'fetching-game',
      activity: 'downloading',
    },
    { pattern: 'Update state \\(0x[0-9a-f]+\\) ', step: 'fetching-game' },
    { pattern: "Success! App '[0-9]+' fully installed", step: 'starting-game' },
  ],
};
```

et ajouter à l'objet `enshrouded`, après `setupStepOrder` :

```ts
  agentSetup: AGENT_SETUP,
```

Dans `deploy/cloud-init/src/lib/sunkenland.ts`, ajouter l'import :

```ts
import type { AgentSetup } from '@beacon/agent-protocol';
```

ajouter après `SERVER_OWNER` :

```ts
/**
 * The restore has brought the game back by the time the agent starts, and
 * nothing measures what this game's output says of its start.
 */
const AGENT_SETUP: AgentSetup = { startStep: 'starting-game', markers: [] };
```

et ajouter à l'objet `sunkenland`, après `setupStepOrder` :

```ts
  agentSetup: AGENT_SETUP,
```

Dans `deploy/cloud-init/src/render.ts`, ajouter `renderSetupMarkers` à l'import de `./lib/catalog.js`, et ajouter après la ligne `if (process.env['WHAT'] === 'compose') return renderCompose(game);` :

```ts
  if (process.env['WHAT'] === 'setup-markers') return renderSetupMarkers(game);
```

Dans `deploy/cloud-init/package.json`, ajouter à `nx.targets`, après `render-serverid-filter` :

```json
      "render-setup-markers": {
        "executor": "nx:run-commands",
        "options": {
          "command": "npx tsx deploy/cloud-init/src/render.ts",
          "env": {
            "WHAT": "setup-markers"
          }
        }
      }
```

Lancer `npx nx sync`, qui ajoute `libs/agent-protocol` aux références TypeScript de `deploy/cloud-init`.

Chercher tout autre objet qui implémente `GameCatalogEntry` : `grep -rn "GameCatalogEntry" --include=*.ts apps libs deploy tools`. Seuls `enshrouded.ts` et `sunkenland.ts` en construisent un ; si un double de test en construit un, il reçoit `agentSetup: { startStep: 'starting-game', markers: [] }`.

- [ ] **Step 5: Lancer les tests et les voir passer**

Run: `npx nx run cloud-init:test`
Expected: PASS.

Run: `GAME=enshrouded npx nx run cloud-init:render-setup-markers`
Expected: une ligne de JSON qui commence par `{"startStep":"fetching-game","markers":[`.

Run: `npx nx run-many -t lint typecheck -p cloud-init agent-protocol @beacon/functions`
Expected: PASS. Une cible qu'un projet ne déclare pas est ignorée par Nx.

- [ ] **Step 6: Commit**

```bash
git add eslint.config.mjs deploy/cloud-init
bash ~/.config/github-app/as-agent.sh git commit -m "feat(cloud-init): donne l'étape de départ et les marqueurs de chaque jeu" -m "Le catalogue dépend du protocole pour le seul fichier qu'il écrit et que le serveur de jeu relit." -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 5: La sortie du jeu dans un fichier, et les marqueurs sur le serveur

**Files:**
- Create: `deploy/cloud-init/src/lib/game-log.ts`
- Modify: `deploy/cloud-init/src/lib/enshrouded.ts`
- Modify: `deploy/cloud-init/src/lib/sunkenland.ts`
- Modify: `deploy/cloud-init/src/lib/enshrouded.spec.ts`
- Modify: `deploy/cloud-init/src/lib/sunkenland.spec.ts`
- Modify: `deploy/cloud-init/src/lib/catalog.spec.ts`
- Modify: `deploy/cloud-init/src/lib/catalogue-fixtures.spec-helper.ts`
- Modify: `STACK.md` (section `Conteneurs`)

**Interfaces:**
- Consumes: `renderAgentSetup` de `@beacon/agent-protocol` (tâche 2), `agentSetup` de chaque entrée (tâche 4).
- Produces, sur un serveur de jeu :
  - `/opt/beacon/setup-markers.json`, monté en lecture seule dans le conteneur `agent` au même chemin ;
  - `/opt/beacon/log/game.log`, écrit par l'unité `beacon-game-log.service`, et `/opt/beacon/log` monté en lecture seule dans le conteneur `agent` ;
  - `BEACON_GAME_LOG=/opt/beacon/log/game.log` et `BEACON_SETUP_MARKERS=/opt/beacon/setup-markers.json` dans `companion.env`.

Jusqu'à la tâche 9, le test de fumée ne passe plus : son compose monte un fichier de marqueurs qu'il ne rend pas encore.

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `deploy/cloud-init/src/lib/catalogue-fixtures.spec-helper.ts`, ajouter à la fin :

```ts
/**
 * The first line of a file a cloud-init writes, as the machine will read it.
 * Read back out of the rendered document rather than from the value that went
 * in: the template is what stands between the two.
 */
export function writtenLine(cloudInit: string, path: string): string {
  const lines = cloudInit.split('\n');
  const file = lines.indexOf(`  - path: ${path}`);
  if (file === -1) throw new Error(`this cloud-init writes no file at ${path}`);
  const content = lines.indexOf('    content: |', file);
  return lines[content + 1].trim();
}
```

Dans `deploy/cloud-init/src/lib/catalog.spec.ts`, ajouter `writtenLine` à l'import de `./catalogue-fixtures.spec-helper.js`, et ajouter dans la boucle `for (const game of GAMES)` de `describe('what the agent declares of a game', …)` :

```ts
    // The file crosses a template and a yaml block before a machine reads it.
    it(`reaches the machine through the cloud-init as the entry wrote it, for ${game}`, () => {
      const written = writtenLine(renderCloudInit(game, REQUEST), '/opt/beacon/setup-markers.json');

      expect(parseAgentSetup(written)).toEqual(catalogFor(game).agentSetup);
    });
```

Dans `deploy/cloud-init/src/lib/enshrouded.spec.ts`, ajouter dans `describe('the enshrouded catalogue entry', …)` :

```ts
  // The agent holds no docker socket, so the game's output reaches it as a
  // file: a unit on the host follows the game's service and writes it there.
  it('gives the host a unit that copies the output of the game into a file', () => {
    const rendered = renderCloudInit('enshrouded', REQUEST);
    expect(rendered).toContain('  - path: /etc/systemd/system/beacon-game-log.service');
    expect(rendered).toContain(
      "ExecStart=/bin/sh -c 'exec /usr/bin/docker compose -f /opt/beacon/docker-compose.yml --env-file /opt/beacon/.env logs -f --no-color --no-log-prefix enshrouded > /opt/beacon/log/game.log'",
    );
  });

  // Measured: launched before the game's container exists, the command returns
  // at once and without an error. What calls it again is the unit.
  it('starts that unit again every two seconds, without ever giving up', () => {
    const rendered = renderCloudInit('enshrouded', REQUEST);
    expect(rendered).toContain('Restart=always');
    expect(rendered).toContain('RestartSec=2');
    expect(rendered).toContain('StartLimitIntervalSec=0');
  });

  it('starts following the output before it starts the compose', () => {
    const rendered = renderCloudInit('enshrouded', REQUEST);
    const made = rendered.indexOf('/opt/beacon/log ]');
    const followed = rendered.indexOf('[ systemctl, enable, --now, beacon-game-log.service ]');
    const started = rendered.indexOf('[ docker, compose,');
    expect(made).toBeGreaterThan(-1);
    expect(followed).toBeGreaterThan(made);
    expect(started).toBeGreaterThan(followed);
  });

  it('lets the agent read the output and its markers, and write neither', () => {
    const compose = renderCompose('enshrouded');
    expect(serviceBlock(compose, 'agent')).toContain('./log:/opt/beacon/log:ro');
    expect(serviceBlock(compose, 'agent')).toContain(
      './setup-markers.json:/opt/beacon/setup-markers.json:ro',
    );
    expect(serviceBlock(compose, 'enshrouded')).not.toContain('/opt/beacon/log');
    expect(serviceBlock(compose, 'restore')).not.toContain('/opt/beacon/log');
  });

  it('tells the companion where the output and the markers are', () => {
    const rendered = renderCloudInit('enshrouded', REQUEST);
    expect(rendered).toContain('BEACON_GAME_LOG=/opt/beacon/log/game.log');
    expect(rendered).toContain('BEACON_SETUP_MARKERS=/opt/beacon/setup-markers.json');
  });
```

Dans `deploy/cloud-init/src/lib/sunkenland.spec.ts`, ajouter dans le `describe` qui porte `mounts no docker socket anywhere` :

```ts
  it('gives the host a unit that copies the output of the game into a file', () => {
    const rendered = renderCloudInit('sunkenland', REQUEST);
    expect(rendered).toContain('  - path: /etc/systemd/system/beacon-game-log.service');
    expect(rendered).toContain(
      "ExecStart=/bin/sh -c 'exec /usr/bin/docker compose -f /opt/beacon/docker-compose.yml --env-file /opt/beacon/.env logs -f --no-color --no-log-prefix sunkenland > /opt/beacon/log/game.log'",
    );
  });

  it('starts that unit again every two seconds, without ever giving up', () => {
    const rendered = renderCloudInit('sunkenland', REQUEST);
    expect(rendered).toContain('Restart=always');
    expect(rendered).toContain('RestartSec=2');
    expect(rendered).toContain('StartLimitIntervalSec=0');
  });

  it('starts following the output before it starts the compose', () => {
    const rendered = renderCloudInit('sunkenland', REQUEST);
    const made = rendered.indexOf('/opt/beacon/log ]');
    const followed = rendered.indexOf('[ systemctl, enable, --now, beacon-game-log.service ]');
    const started = rendered.indexOf('[ docker, compose,');
    expect(made).toBeGreaterThan(-1);
    expect(followed).toBeGreaterThan(made);
    expect(started).toBeGreaterThan(followed);
  });

  it('lets the agent read the output and its markers, and write neither', () => {
    const compose = renderCompose('sunkenland');
    expect(serviceBlock(compose, 'agent')).toContain('./log:/opt/beacon/log:ro');
    expect(serviceBlock(compose, 'agent')).toContain(
      './setup-markers.json:/opt/beacon/setup-markers.json:ro',
    );
    expect(serviceBlock(compose, 'sunkenland')).not.toContain('/opt/beacon/log');
    expect(serviceBlock(compose, 'restore')).not.toContain('/opt/beacon/log');
  });

  it('tells the companion where the output and the markers are', () => {
    const rendered = renderCloudInit('sunkenland', REQUEST);
    expect(rendered).toContain('BEACON_GAME_LOG=/opt/beacon/log/game.log');
    expect(rendered).toContain('BEACON_SETUP_MARKERS=/opt/beacon/setup-markers.json');
  });
```

- [ ] **Step 2: Lancer les tests et les voir échouer**

Run: `npx nx run cloud-init:test`
Expected: FAIL, `this cloud-init writes no file at /opt/beacon/setup-markers.json` et les assertions sur l'unité.

- [ ] **Step 3: Écrire ce que les deux jeux partagent**

`deploy/cloud-init/src/lib/game-log.ts` :

```ts
/** Where the host keeps what the game prints, and what the agent mounts read-only. */
export const GAME_LOG_DIR = '/opt/beacon/log';
export const GAME_LOG_FILE = `${GAME_LOG_DIR}/game.log`;

/** Where the agent reads what it declares of this game's setup. */
export const SETUP_MARKERS_FILE = '/opt/beacon/setup-markers.json';

export const GAME_LOG_UNIT = 'beacon-game-log.service';

/**
 * The unit that copies the output of the game's service into a file. The agent
 * holds no docker socket, so a file is the only form that output can reach it
 * in.
 *
 * Measured, `probe/RESULTS.md` section P: this command follows a service
 * across its restarts and writes what `docker logs` gives, and launched before
 * the container exists it returns at once, without an error. So the unit is
 * started before the compose and calls the command again for as long as it
 * returns.
 */
export const gameLogUnit = (service: string): string => `[Unit]
Description=Copy the output of the game into a file
After=docker.service
# Never given up on: until the game's container exists the command returns at
# once, and this unit is what calls it again.
StartLimitIntervalSec=0
[Service]
# Each start writes the file again from its beginning, and the command begins
# by printing everything the container has said so far.
ExecStart=/bin/sh -c 'exec /usr/bin/docker compose -f /opt/beacon/docker-compose.yml --env-file /opt/beacon/.env logs -f --no-color --no-log-prefix ${service} > ${GAME_LOG_FILE}'
Restart=always
RestartSec=2
[Install]
WantedBy=multi-user.target
`;
```

- [ ] **Step 4: Écrire le cloud-init d'Enshrouded**

Dans `deploy/cloud-init/src/lib/enshrouded.ts`, ajouter les imports :

```ts
import { renderAgentSetup, type AgentSetup } from '@beacon/agent-protocol';
import {
  GAME_LOG_DIR,
  GAME_LOG_FILE,
  GAME_LOG_UNIT,
  gameLogUnit,
  SETUP_MARKERS_FILE,
} from './game-log.js';
```

(l'import de type seul posé par la tâche 4 est remplacé par le premier).

Dans `COMPOSE`, à la fin des `volumes` du service `agent`, après `- ./control:/opt/beacon/control`, ajouter :

```
      # What the game prints, copied here by a unit of the host, and what this
      # game's output says of its setup. Read-only: the agent observes both.
      - ./log:${GAME_LOG_DIR}:ro
      - ./setup-markers.json:${SETUP_MARKERS_FILE}:ro
```

Dans `CLOUD_INIT`, après la ligne `BEACON_PUSH_INTERVAL_MS=600000`, ajouter :

```
      BEACON_GAME_LOG=${GAME_LOG_FILE}
      BEACON_SETUP_MARKERS=${SETUP_MARKERS_FILE}
```

Après le bloc de `beacon-stop.service` (sa dernière ligne est `ExecStartPost=-/bin/rm -f /opt/beacon/control/stop`), ajouter :

```
  # What the agent declares of this game's setup, read once when it starts.
  - path: ${SETUP_MARKERS_FILE}
    permissions: "0644"
    content: |
      __SETUP_MARKERS__
  - path: /etc/systemd/system/${GAME_LOG_UNIT}
    permissions: "0644"
    content: |
      __GAME_LOG_UNIT__
```

Dans `runcmd`, remplacer :

```
  - [ systemctl, enable, --now, beacon-stop.path ]
  - [ docker, compose, -f, /opt/beacon/docker-compose.yml, --env-file, /opt/beacon/.env, up, -d ]
```

par :

```
  - [ mkdir, -p, ${GAME_LOG_DIR} ]
  - [ systemctl, enable, --now, beacon-stop.path ]
  - [ systemctl, enable, --now, ${GAME_LOG_UNIT} ]
  - [ docker, compose, -f, /opt/beacon/docker-compose.yml, --env-file, /opt/beacon/.env, up, -d ]
```

Dans `render`, remplacer la première ligne par :

```ts
    let rendered = fill(CLOUD_INIT, '__DOCKER_COMPOSE__', indent(COMPOSE));
    rendered = fill(rendered, '__SETUP_MARKERS__', renderAgentSetup(AGENT_SETUP));
    rendered = fill(rendered, '__GAME_LOG_UNIT__', indent(gameLogUnit(GAME_CONTAINER)));
```

- [ ] **Step 5: Écrire le cloud-init de Sunkenland**

Dans `deploy/cloud-init/src/lib/sunkenland.ts`, ajouter les imports :

```ts
import { renderAgentSetup, type AgentSetup } from '@beacon/agent-protocol';
import {
  GAME_LOG_DIR,
  GAME_LOG_FILE,
  GAME_LOG_UNIT,
  gameLogUnit,
  SETUP_MARKERS_FILE,
} from './game-log.js';
```

(l'import de type seul posé par la tâche 4 est remplacé par le premier).

Dans `COMPOSE`, à la fin des `volumes` du service `agent`, après `- ./control:/opt/beacon/control`, ajouter :

```
      # What the game prints, copied here by a unit of the host, and what this
      # game's output says of its setup. Read-only: the agent observes both.
      - ./log:${GAME_LOG_DIR}:ro
      - ./setup-markers.json:${SETUP_MARKERS_FILE}:ro
```

Dans `CLOUD_INIT`, après la ligne `BEACON_GAME_DIR=${GAME_DIR}`, ajouter :

```
      BEACON_GAME_LOG=${GAME_LOG_FILE}
      BEACON_SETUP_MARKERS=${SETUP_MARKERS_FILE}
```

Après le bloc de `beacon-stop.service`, ajouter :

```
  # What the agent declares of this game's setup, read once when it starts.
  - path: ${SETUP_MARKERS_FILE}
    permissions: "0644"
    content: |
      __SETUP_MARKERS__
  - path: /etc/systemd/system/${GAME_LOG_UNIT}
    permissions: "0644"
    content: |
      __GAME_LOG_UNIT__
```

Dans `runcmd`, remplacer la ligne `mkdir` par :

```
  - [ mkdir, -p, /opt/beacon/game, /opt/beacon/worlds, /opt/beacon/ready, /opt/beacon/control, ${GAME_LOG_DIR} ]
```

et remplacer :

```
  - [ systemctl, enable, --now, beacon-stop.path ]
  - [ docker, compose, -f, /opt/beacon/docker-compose.yml, --env-file, /opt/beacon/.env, up, -d ]
```

par :

```
  - [ systemctl, enable, --now, beacon-stop.path ]
  - [ systemctl, enable, --now, ${GAME_LOG_UNIT} ]
  - [ docker, compose, -f, /opt/beacon/docker-compose.yml, --env-file, /opt/beacon/.env, up, -d ]
```

Dans `render`, après la ligne qui remplit `__DOCKER_COMPOSE__`, ajouter :

```ts
    rendered = fill(rendered, '__SETUP_MARKERS__', renderAgentSetup(AGENT_SETUP));
    rendered = fill(rendered, '__GAME_LOG_UNIT__', indent(gameLogUnit(GAME_CONTAINER)));
```

- [ ] **Step 6: Récrire les commentaires qui interdisent au compagnon de lire la sortie du jeu**

Le commanditaire a levé cette interdiction le 2026-10-12 : le mot de passe du serveur n'ouvre rien du système. Le filtre et ce qu'il extrait ne changent pas.

Dans `deploy/cloud-init/src/lib/sunkenland.ts`, remplacer le premier paragraphe du commentaire de `SERVERID_FILTER` par :

```ts
/**
 * The one value the agent reads to know this server can be joined, and the
 * whole reason this filter exists: the entry point pipes its own output
 * through this, which copies it back byte for byte and extracts nothing but
 * the identifier.
```

Dans le commentaire bash du filtre, remplacer `provisioning delay with nothing saying why — by design, this container's log` et la ligne qui suit, `# crosses no boundary. This fragment appears in both, so nothing here depends`, par :

```
# provisioning delay with nothing on the screen saying why. This fragment
# appears in both, so nothing here depends
```

Dans `startSh`, remplacer le commentaire qui précède `exec > >(/opt/beacon/serverid-filter.sh …)` par :

```
# Everything this script and the server print goes through the filter, which
# copies it back unchanged: \`docker logs\` stays what it was. The one thing the
# filter does besides copying is write the identifier where the agent reads it.
```

Dans `deploy/cloud-init/src/lib/sunkenland.spec.ts`, remplacer le commentaire du test `gives the game a folder to announce itself in, and the agent only reading rights on it` par :

```ts
  // The game writes the identifier, the agent reads it, and nothing else
  // passes through this folder.
```

Relire `deploy/cloud-init/src/lib/sunkenland.ts`, `sunkenland.spec.ts` et `deploy/companion/smoke/serverid-extraction.sh` : tout autre commentaire qui dit que le compagnon ne peut pas ou ne doit pas lire la sortie du jeu se récrit pour dire ce que le filtre fait. Un commentaire qui dit seulement que cette sortie porte le mot de passe reste.

- [ ] **Step 7: Écrire `STACK.md`**

Dans `STACK.md`, section `Conteneurs`, ajouter après le paragraphe qui commence par `**Il n'embarque pas \`rclone\`**` :

```markdown
**Aucun conteneur ne reçoit le socket Docker**, et le compagnon lit pourtant la
sortie du jeu : une unité systemd du serveur de jeu, `beacon-game-log.service`,
suit le service du jeu par `docker compose logs -f` et recopie sa sortie dans
`/opt/beacon/log/game.log`, que l'agent monte en lecture seule. L'unité démarre
avant le compose et se relance toutes les deux secondes, parce que la commande
rend la main tant que le conteneur du jeu n'existe pas — mesuré les 2026-10-11
et 2026-10-12, section P de `probe/RESULTS.md`.
```

- [ ] **Step 8: Lancer les tests et les voir passer**

Run: `npx nx run cloud-init:test`
Expected: PASS.

Run: `GAME=sunkenland SERVER_PASSWORD=x npx nx run cloud-init:render`
Expected: le cloud-init porte les deux fichiers nouveaux, chaque ligne de l'unité à six espaces, et aucune ligne `__…__`.

- [ ] **Step 9: Commit**

```bash
git add deploy/cloud-init deploy/companion/smoke/serverid-extraction.sh STACK.md
bash ~/.config/github-app/as-agent.sh git commit -m "feat(cloud-init): recopie la sortie du jeu dans un fichier que l'agent lit" -m "Une unité du serveur de jeu suit le service du jeu : aucun conteneur ne reçoit le socket Docker. L'interdiction de lire la sortie de Sunkenland est levée, son mot de passe n'ouvre rien du système." -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

`git add` ne prend `serverid-extraction.sh` que si l'étape 6 l'a modifié.

---

### Task 6: La restauration déclare ses étapes

**Files:**
- Modify: `deploy/companion/src/lib/reporter.ts`
- Create: `deploy/companion/src/lib/reporter.spec.ts`
- Create: `deploy/companion/src/lib/declare-setup.ts`
- Create: `deploy/companion/src/lib/declare-setup.spec.ts`
- Modify: `deploy/companion/src/lib/restore.ts`
- Modify: `deploy/companion/src/lib/restore.spec.ts`

**Interfaces:**
- Consumes: `SETUP_REPORT_INTERVAL_MS` de `@beacon/agent-protocol` (tâche 1), `TransferProgress` et le troisième paramètre de `ObjectApi.get` (tâche 3), `SetupDeclaration` de `@beacon/session`.
- Produces :
  - `interface SendOptions { readonly timeoutMs?: number }`
  - `Reporter.send(report: Omit<AgentReport, 'sessionId'>, options?: SendOptions): Promise<AgentInstructions>`
  - `SETUP_REPORT_TIMEOUT_MS = 5_000`
  - `interface SetupDeclarer { declare(setup: SetupDeclaration): Promise<void>; declareIfDue(setup: SetupDeclaration): void }`
  - `setupDeclarer(deps: { report: Reporter['send']; log: (message: string) => void; clock: Clock }): SetupDeclarer`

`declare` attend la réponse du rapport précédent, envoie un rapport `alive` avec 5 s de délai, et ne rejette jamais. `declareIfDue` n'envoie rien tant qu'un rapport attend sa réponse, ni moins de 10 s après le début du dernier.

- [ ] **Step 1: Écrire les tests qui échouent du rapporteur**

`deploy/companion/src/lib/reporter.spec.ts` :

```ts
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { CompanionConfig } from './config.js';
import { httpReporter, type Reporter } from './reporter.js';

let server: Server;
let answerAfterMs: number;
let reporter: Reporter;

beforeEach(async () => {
  answerAfterMs = 0;
  server = createServer((_request, response) => {
    setTimeout(() => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ state: 'PROVISIONING', deadlineIso: null }));
    }, answerAfterMs);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  reporter = httpReporter({
    endpoint: `http://127.0.0.1:${port}/`,
    token: 'a'.repeat(64),
    sessionId: 's1',
  } as CompanionConfig);
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

describe('httpReporter', () => {
  it('answers what the control plane said', async () => {
    await expect(reporter.send({ phase: 'alive' })).resolves.toEqual({
      state: 'PROVISIONING',
      deadlineIso: null,
    });
  });

  it('gives up on an answer that takes longer than the delay it was given', async () => {
    answerAfterMs = 500;

    await expect(reporter.send({ phase: 'alive' }, { timeoutMs: 50 })).rejects.toThrow();
  });

  // Only a setup declaration is given a delay: every other report waits.
  it('waits for a slow answer when it was given no delay', async () => {
    answerAfterMs = 200;

    await expect(reporter.send({ phase: 'alive' })).resolves.toEqual({
      state: 'PROVISIONING',
      deadlineIso: null,
    });
  });
});
```

- [ ] **Step 2: Écrire les tests qui échouent du déclarant**

`deploy/companion/src/lib/declare-setup.spec.ts` :

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SETUP_REPORT_INTERVAL_MS } from '@beacon/agent-protocol';
import { SETUP_REPORT_TIMEOUT_MS, setupDeclarer, type SetupDeclarer } from './declare-setup.js';
import type { Reporter } from './reporter.js';

const INSTRUCTIONS = { state: 'PROVISIONING' as const, deadlineIso: null };
const settle = () => new Promise((resolve) => setImmediate(resolve));

let elapsedMs: number;
let report: ReturnType<typeof vi.fn<Reporter['send']>>;
let log: ReturnType<typeof vi.fn<(message: string) => void>>;
let declarer: SetupDeclarer;

beforeEach(() => {
  elapsedMs = 0;
  report = vi.fn<Reporter['send']>(async () => INSTRUCTIONS);
  log = vi.fn<(message: string) => void>();
  declarer = setupDeclarer({
    report,
    log,
    clock: { now: () => new Date(1_760_000_000_000 + elapsedMs) },
  });
});

describe('setupDeclarer', () => {
  it('declares a step in an alive report, and waits five seconds at most for its answer', async () => {
    await declarer.declare({ step: 'restoring-world' });

    expect(SETUP_REPORT_TIMEOUT_MS).toBe(5_000);
    expect(report).toHaveBeenCalledWith(
      { phase: 'alive', setup: { step: 'restoring-world' } },
      { timeoutMs: SETUP_REPORT_TIMEOUT_MS },
    );
  });

  // What is displayed must not cost a restore.
  it('writes a declaration that failed in its log, and carries on', async () => {
    report.mockRejectedValue(new Error('The operation was aborted due to timeout'));

    await expect(declarer.declare({ step: 'restoring-world' })).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('restoring-world'));
  });

  it('waits for the answer to a declaration before it sends the next one', async () => {
    let answer: () => void = () => undefined;
    report.mockImplementationOnce(
      () => new Promise((resolve) => (answer = () => resolve(INSTRUCTIONS))),
    );

    const first = declarer.declare({ step: 'fetching-game' });
    const second = declarer.declare({ step: 'restoring-world' });
    await settle();
    expect(report).toHaveBeenCalledTimes(1);

    answer();
    await Promise.all([first, second]);
    expect(report).toHaveBeenCalledTimes(2);
  });

  it('sends nothing less than ten seconds after the last declaration began', async () => {
    await declarer.declare({ step: 'fetching-game', activity: 'downloading', progress: 0 });

    elapsedMs = SETUP_REPORT_INTERVAL_MS - 1;
    declarer.declareIfDue({ step: 'fetching-game', activity: 'downloading', progress: 40 });
    await settle();
    expect(report).toHaveBeenCalledTimes(1);

    elapsedMs = SETUP_REPORT_INTERVAL_MS;
    declarer.declareIfDue({ step: 'fetching-game', activity: 'downloading', progress: 60 });
    await settle();
    expect(report).toHaveBeenCalledTimes(2);
    expect(report.mock.calls[1][0].setup).toEqual({
      step: 'fetching-game',
      activity: 'downloading',
      progress: 60,
    });
  });

  it('sends nothing while a declaration still waits for its answer', async () => {
    let answer: () => void = () => undefined;
    report.mockImplementationOnce(
      () => new Promise((resolve) => (answer = () => resolve(INSTRUCTIONS))),
    );
    const pending = declarer.declare({ step: 'fetching-game' });

    elapsedMs = 3 * SETUP_REPORT_INTERVAL_MS;
    declarer.declareIfDue({ step: 'fetching-game', activity: 'downloading', progress: 60 });
    answer();
    await pending;
    await settle();

    expect(report).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 3: Écrire les tests qui échouent de la restauration**

Dans `deploy/companion/src/lib/restore.spec.ts`, ajouter après la déclaration de `saveOf` :

```ts
/** The setups the restore declared, in the order it declared them. */
const declared = () =>
  (deps.report as ReturnType<typeof vi.fn>).mock.calls
    .map((call) => call[0])
    .filter((report) => report.setup !== undefined)
    .map((report) => report.setup);
```

Ajouter dans `describe('runRestore', …)` :

```ts
  it('declares that it restores the world before it looks for its last save', async () => {
    const order: string[] = [];
    deps.report = vi.fn(async (report) => {
      if (report.setup !== undefined) order.push(report.setup.step);
      return { state: 'PROVISIONING' as const, deadlineIso: null };
    });
    deps.store.list = vi.fn(async () => {
      order.push('listed');
      return [saveOf('2026-09-06T19:00:00Z')];
    });

    await runRestore(deps);

    expect(order).toEqual(['restoring-world', 'listed']);
  });

  it('declares that it restores the world of a world that has no save yet', async () => {
    deps.store.list = vi.fn(async () => []);

    await runRestore(deps);

    expect(declared()).toEqual([{ step: 'restoring-world' }]);
  });

  // The game that downloads its own files: the restore knows nothing of that
  // step, and the agent declares it.
  it('declares no install of the game when it brings no game back', async () => {
    await runRestore(deps);

    expect(declared()).toEqual([{ step: 'restoring-world' }]);
  });

  // What is displayed must not cost a session: the world lands all the same.
  it('restores the world when no declaration could be sent', async () => {
    deps.report = vi.fn(async () => {
      throw new Error('The operation was aborted due to timeout');
    });

    await expect(runRestore(deps)).resolves.toBeUndefined();
    expect(readFileSync(join(root, 'savegame', '3ad85aea')).byteLength).toBe(20_000);
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('could not declare'));
  });
```

Ajouter dans `describe('runRestore with game files', …)` :

```ts
  it('declares the install of the game, its unpacking, then the world, in that order', async () => {
    await runRestore(deps);

    expect(declared()).toEqual([
      { step: 'fetching-game', activity: 'downloading', progress: 0 },
      { step: 'fetching-game', activity: 'unpacking' },
      { step: 'restoring-world' },
    ]);
  });

  it('declares the progress of the download from the bytes received, every ten seconds at most', async () => {
    let elapsedMs = 0;
    deps = { ...deps, clock: { now: () => new Date(NOW.getTime() + elapsedMs) } };
    const originalGet = games.get.bind(games);
    games.get = vi.fn(async (key, toFile, onProgress) => {
      const arrivals = [
        [4_000, 25],
        [10_000, 50],
        [12_000, 60],
        [20_000, 90],
      ] as const;
      for (const [atMs, receivedBytes] of arrivals) {
        elapsedMs = atMs;
        onProgress?.(receivedBytes, 100);
        await new Promise((resolve) => setImmediate(resolve));
      }
      await originalGet(key, toFile);
    });

    await runRestore(deps);

    expect(declared()).toEqual([
      { step: 'fetching-game', activity: 'downloading', progress: 0 },
      { step: 'fetching-game', activity: 'downloading', progress: 50 },
      { step: 'fetching-game', activity: 'downloading', progress: 90 },
      { step: 'fetching-game', activity: 'unpacking' },
      { step: 'restoring-world' },
    ]);
  });

  it('declares a whole percentage, rounded down', async () => {
    let elapsedMs = 0;
    deps = { ...deps, clock: { now: () => new Date(NOW.getTime() + elapsedMs) } };
    const originalGet = games.get.bind(games);
    games.get = vi.fn(async (key, toFile, onProgress) => {
      elapsedMs = 10_000;
      onProgress?.(2, 3);
      await new Promise((resolve) => setImmediate(resolve));
      await originalGet(key, toFile);
    });

    await runRestore(deps);

    expect(declared()[1]).toEqual({ step: 'fetching-game', activity: 'downloading', progress: 66 });
  });

  // A bucket that does not say how large the object is: no progress to tell.
  it('declares no progress out of a total it does not know', async () => {
    let elapsedMs = 0;
    deps = { ...deps, clock: { now: () => new Date(NOW.getTime() + elapsedMs) } };
    const originalGet = games.get.bind(games);
    games.get = vi.fn(async (key, toFile, onProgress) => {
      elapsedMs = 10_000;
      onProgress?.(500, 0);
      await new Promise((resolve) => setImmediate(resolve));
      await originalGet(key, toFile);
    });

    await runRestore(deps);

    expect(declared()).toEqual([
      { step: 'fetching-game', activity: 'downloading', progress: 0 },
      { step: 'fetching-game', activity: 'unpacking' },
      { step: 'restoring-world' },
    ]);
  });

  it('brings the game back when a declaration takes too long', async () => {
    deps.report = vi.fn(async () => {
      throw new Error('The operation was aborted due to timeout');
    });

    await expect(runRestore(deps)).resolves.toBeUndefined();
    expect(readdirSync(gameDir)).toContain('Sunkenland-DedicatedServer.exe');
  });
```

- [ ] **Step 4: Lancer les tests et les voir échouer**

Run: `npx nx run companion:test`
Expected: FAIL, `Failed to resolve import "./declare-setup.js"`, le test du délai de `reporter.spec.ts`, et les tests de `restore.spec.ts` qui lisent `declared()`. Le test `names an image built from the sources in the tree` échoue aussi, et c'est attendu.

- [ ] **Step 5: Écrire le rapporteur**

Dans `deploy/companion/src/lib/reporter.ts`, remplacer l'interface `Reporter` par :

```ts
export interface SendOptions {
  /**
   * How long to wait for the answer. Only a setup declaration sets it: it is
   * only ever displayed, and must not hold back what the machine is doing.
   */
  readonly timeoutMs?: number;
}

/** What the machine says, and what it is told back. Nothing else crosses. */
export interface Reporter {
  send(report: Omit<AgentReport, 'sessionId'>, options?: SendOptions): Promise<AgentInstructions>;
}
```

Remplacer la signature de `send` dans `httpReporter` par :

```ts
    async send(
      report: Omit<AgentReport, 'sessionId'>,
      options: SendOptions = {},
    ): Promise<AgentInstructions> {
```

et ajouter à l'objet passé à `fetch`, après `body` :

```ts
        signal:
          options.timeoutMs === undefined ? undefined : AbortSignal.timeout(options.timeoutMs),
```

- [ ] **Step 6: Écrire le déclarant**

`deploy/companion/src/lib/declare-setup.ts` :

```ts
import { SETUP_REPORT_INTERVAL_MS } from '@beacon/agent-protocol';
import type { Clock, SetupDeclaration } from '@beacon/session';
import type { Reporter } from './reporter.js';

/** How long a setup declaration waits for its answer before the machine moves on. */
export const SETUP_REPORT_TIMEOUT_MS = 5_000;

export interface SetupDeclarerDeps {
  readonly report: Reporter['send'];
  readonly log: (message: string) => void;
  readonly clock: Clock;
}

export interface SetupDeclarer {
  /** Sent once the previous declaration was answered. Never rejects. */
  declare(setup: SetupDeclaration): Promise<void>;
  /**
   * Sent only if no declaration waits for its answer and the last one began at
   * least one setup interval ago. For what moves faster than it is worth
   * telling — the bytes of a download.
   */
  declareIfDue(setup: SetupDeclaration): void;
}

/**
 * What the restore says of the setup while it runs. A declaration is only ever
 * displayed, so one that fails or takes too long is written in the log and
 * stops nothing.
 */
export function setupDeclarer(deps: SetupDeclarerDeps): SetupDeclarer {
  let answered: Promise<void> = Promise.resolve();
  let waiting = 0;
  let lastBeganAt = Number.NEGATIVE_INFINITY;

  const send = async (setup: SetupDeclaration): Promise<void> => {
    try {
      await deps.report({ phase: 'alive', setup }, { timeoutMs: SETUP_REPORT_TIMEOUT_MS });
    } catch (error) {
      deps.log(`could not declare ${setup.step}: ${String(error)}`);
    }
  };

  const declare = (setup: SetupDeclaration): Promise<void> => {
    waiting += 1;
    lastBeganAt = deps.clock.now().getTime();
    answered = answered
      .then(() => send(setup))
      .finally(() => {
        waiting -= 1;
      });
    return answered;
  };

  return {
    declare,
    declareIfDue(setup: SetupDeclaration): void {
      if (waiting > 0) return;
      if (deps.clock.now().getTime() - lastBeganAt < SETUP_REPORT_INTERVAL_MS) return;
      void declare(setup);
    },
  };
}
```

- [ ] **Step 7: Faire déclarer la restauration**

Dans `deploy/companion/src/lib/restore.ts`, ajouter l'import :

```ts
import { setupDeclarer, type SetupDeclarer } from './declare-setup.js';
```

Dans `runRestore`, remplacer :

```ts
  if (deps.gameFiles !== undefined) {
    await restoreGameFiles(deps, deps.gameFiles);
  }

  let newest: Save | undefined;
```

par :

```ts
  // The restore says which operation it begins, and knows nothing of the
  // order a game goes through its steps.
  const declarer = setupDeclarer(deps);

  if (deps.gameFiles !== undefined) {
    await restoreGameFiles(deps, deps.gameFiles, declarer);
  }

  // Before the listing, and whatever it answers: a world with no save yet is
  // still a world being restored.
  await declarer.declare({ step: 'restoring-world' });

  let newest: Save | undefined;
```

Remplacer la signature de `restoreGameFiles` et le début de son `try` par :

```ts
async function restoreGameFiles(
  deps: RestoreDeps,
  gameFiles: NonNullable<RestoreDeps['gameFiles']>,
  declarer: SetupDeclarer,
): Promise<void> {
  // `.tar` and not `.tar.gz` like the world's: `pushGameFiles` deliberately
  // builds this one without gzip, because an install's files are already
  // compressed. node-tar sniffs either way, so the suffix costs nothing at
  // runtime and would only teach a reader the opposite of the decision.
  const archive = join(deps.config.workDir, 'game-files.tar');
  try {
    mkdirSync(gameFiles.directory, { recursive: true });
    await declarer.declare(downloading(0));
    await gameFiles.api.get(gameFiles.objectKey, archive, (receivedBytes, totalBytes) => {
      if (totalBytes <= 0) return;
      declarer.declareIfDue(downloading(Math.floor((receivedBytes / totalBytes) * 100)));
    });
    // No progress from here on: nothing says how far an unpacking is.
    await declarer.declare({ step: 'fetching-game', activity: 'unpacking' });
    await unpackInto(archive, gameFiles.directory);
```

Le reste de `restoreGameFiles` ne change pas. Ajouter après elle :

```ts
const downloading = (progress: number): SetupDeclaration => ({
  step: 'fetching-game',
  activity: 'downloading',
  progress: Math.min(100, Math.max(0, progress)),
});
```

et ajouter `type SetupDeclaration` à l'import de `@beacon/session`.

- [ ] **Step 8: Lancer les tests et les voir passer**

Run: `npx nx run companion:test`
Expected: PASS, à l'exception du seul test `names an image built from the sources in the tree`.

- [ ] **Step 9: Commit**

```bash
git add deploy/companion/src/lib/reporter.ts deploy/companion/src/lib/reporter.spec.ts deploy/companion/src/lib/declare-setup.ts deploy/companion/src/lib/declare-setup.spec.ts deploy/companion/src/lib/restore.ts deploy/companion/src/lib/restore.spec.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(companion): déclare les étapes de la restauration" -m "Une déclaration n'est qu'affichée : celle qui échoue ou qui tarde plus de 5 s va au journal de la restauration et n'arrête rien." -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 7: L'agent lit la sortie du jeu et ses marqueurs

**Files:**
- Modify: `deploy/companion/src/lib/config.ts`
- Modify: `deploy/companion/src/lib/config.spec.ts`
- Create: `deploy/companion/src/lib/game-log.ts`
- Create: `deploy/companion/src/lib/game-log.spec.ts`
- Create: `deploy/companion/src/lib/setup-watch.ts`
- Create: `deploy/companion/src/lib/setup-watch.spec.ts`

**Interfaces:**
- Consumes: `AgentSetup`, `parseAgentSetup`, `declaredByMarkers` de `@beacon/agent-protocol` (tâche 2), `REPORT_INTERVAL_MS` et `SETUP_REPORT_INTERVAL_MS` (tâche 1), `Reporter['send']` (tâche 6).
- Produces :
  - `CompanionConfig.gameLog: string`, lu de `BEACON_GAME_LOG`, et `CompanionConfig.setupMarkers: string`, lu de `BEACON_SETUP_MARKERS`, tous deux obligatoires
  - `GAME_LOG_TAIL_BYTES = 65_536`
  - `readLogTail(path: string, maxBytes?: number): string`, qui rend `''` pour un fichier absent ou illisible
  - `loadAgentSetup(path: string, deps: { report: Reporter['send']; log: (message: string) => void }): Promise<AgentSetup>`, qui déclare un échec puis rejette quand le fichier ne se lit pas
  - `interface SetupWatch { declared(): SetupDeclaration; readonly intervalMs: number }`
  - `setupWatch(setup: AgentSetup, readTail: () => string): SetupWatch`, dont `intervalMs` vaut `SETUP_REPORT_INTERVAL_MS` pour un jeu à marqueurs et `REPORT_INTERVAL_MS` sinon

- [ ] **Step 1: Écrire les tests qui échouent**

Dans `deploy/companion/src/lib/config.spec.ts`, ajouter à `ENV`, après `BEACON_PUSH_INTERVAL_MS` :

```ts
  BEACON_GAME_LOG: '/opt/beacon/log/game.log',
  BEACON_SETUP_MARKERS: '/opt/beacon/setup-markers.json',
```

et ajouter dans `describe('readConfig', …)` :

```ts
  it('reads where the output of the game and its markers are', () => {
    const config = readConfig(ENV);
    expect(config.gameLog).toBe('/opt/beacon/log/game.log');
    expect(config.setupMarkers).toBe('/opt/beacon/setup-markers.json');
  });

  it('requires both paths', () => {
    expect(() => readConfig({ ...ENV, BEACON_GAME_LOG: undefined })).toThrow(/BEACON_GAME_LOG/);
    expect(() => readConfig({ ...ENV, BEACON_SETUP_MARKERS: undefined })).toThrow(
      /BEACON_SETUP_MARKERS/,
    );
  });
```

`deploy/companion/src/lib/game-log.spec.ts` :

```ts
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GAME_LOG_TAIL_BYTES, readLogTail } from './game-log.js';

let folder: string;

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'beacon-game-log-'));
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

describe('readLogTail', () => {
  it('reads a short file whole', () => {
    const path = join(folder, 'game.log');
    writeFileSync(path, 'line 1\nline 2\n');

    expect(readLogTail(path)).toBe('line 1\nline 2\n');
  });

  it('reads the end of a file longer than what it reads, and nothing before it', () => {
    const path = join(folder, 'game.log');
    writeFileSync(path, `first line\n${'x'.repeat(GAME_LOG_TAIL_BYTES)}\nlast line\n`);

    const tail = readLogTail(path);

    expect(GAME_LOG_TAIL_BYTES).toBe(65_536);
    expect(Buffer.byteLength(tail)).toBe(GAME_LOG_TAIL_BYTES);
    expect(tail.endsWith('last line\n')).toBe(true);
    expect(tail).not.toContain('first line');
  });

  // The ordinary case until the game's container exists: nothing has written
  // the file yet.
  it('reads a file that is not there as an empty one', () => {
    expect(readLogTail(join(folder, 'absent.log'))).toBe('');
  });

  it('reads what cannot be read as an empty file', () => {
    expect(readLogTail(folder)).toBe('');
  });
});
```

`deploy/companion/src/lib/setup-watch.spec.ts` :

```ts
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  renderAgentSetup,
  REPORT_INTERVAL_MS,
  SETUP_REPORT_INTERVAL_MS,
  type AgentSetup,
} from '@beacon/agent-protocol';
import { GAME_LOG_TAIL_BYTES, readLogTail } from './game-log.js';
import { loadAgentSetup, setupWatch } from './setup-watch.js';

const SETUP: AgentSetup = {
  startStep: 'fetching-game',
  markers: [
    { pattern: 'fetching: ([0-9.]+)%', step: 'fetching-game', activity: 'downloading' },
    { pattern: 'installed', step: 'starting-game' },
  ],
};

let folder: string;

beforeEach(() => {
  folder = mkdtempSync(join(tmpdir(), 'beacon-setup-watch-'));
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

describe('setupWatch', () => {
  it('declares the start step while no line has answered a marker', () => {
    const watch = setupWatch(SETUP, () => 'booting\n');

    expect(watch.declared()).toEqual({ step: 'fetching-game' });
  });

  it('declares what the markers decide on the end of the output', () => {
    const watch = setupWatch(SETUP, () => 'fetching: 41.7%\n');

    expect(watch.declared()).toEqual({
      step: 'fetching-game',
      activity: 'downloading',
      progress: 41,
    });
  });

  it('follows the output as it grows', () => {
    let output = 'fetching: 10%\n';
    const watch = setupWatch(SETUP, () => output);
    watch.declared();

    output += 'installed\n';

    expect(watch.declared()).toEqual({ step: 'starting-game' });
  });

  // The game goes on printing: the line that decided leaves what is read, and
  // the step it decided is still the current one.
  it('keeps what a marker decided once its line is out of what it reads', () => {
    let output = 'installed\n';
    const watch = setupWatch(SETUP, () => output);
    watch.declared();

    output = 'serving\nserving\n';

    expect(watch.declared()).toEqual({ step: 'starting-game' });
  });

  it('declares the start step for a game that has no marker', () => {
    const watch = setupWatch({ startStep: 'starting-game', markers: [] }, () => 'anything');

    expect(watch.declared()).toEqual({ step: 'starting-game' });
  });

  it('declares the start step when the decisive line left the file before it was ever read', () => {
    const path = join(folder, 'game.log');
    writeFileSync(path, `installed\n${'x'.repeat(GAME_LOG_TAIL_BYTES)}\n`);
    const watch = setupWatch(SETUP, () => readLogTail(path));

    expect(watch.declared()).toEqual({ step: 'fetching-game' });
  });

  it('declares the start step when the file of the output is not there', () => {
    const watch = setupWatch(SETUP, () => readLogTail(join(folder, 'absent.log')));

    expect(watch.declared()).toEqual({ step: 'fetching-game' });
  });

  it('is followed every ten seconds when the game has markers', () => {
    expect(setupWatch(SETUP, () => '').intervalMs).toBe(SETUP_REPORT_INTERVAL_MS);
  });

  // A game with no marker has nothing new to say between two minutes.
  it('is followed once a minute when the game has no marker', () => {
    const watch = setupWatch({ startStep: 'starting-game', markers: [] }, () => '');

    expect(watch.intervalMs).toBe(REPORT_INTERVAL_MS);
  });
});

describe('loadAgentSetup', () => {
  const INSTRUCTIONS = { state: 'PROVISIONING' as const, deadlineIso: null };

  it('reads the markers the cloud-init wrote', async () => {
    const path = join(folder, 'setup-markers.json');
    writeFileSync(path, `${renderAgentSetup(SETUP)}\n`);
    const report = vi.fn(async () => INSTRUCTIONS);

    await expect(loadAgentSetup(path, { report, log: vi.fn() })).resolves.toEqual(SETUP);
    expect(report).not.toHaveBeenCalled();
  });

  it('declares a failure and gives up on a file it cannot read', async () => {
    const path = join(folder, 'setup-markers.json');
    writeFileSync(path, '{ "startStep": "booting" }');
    const report = vi.fn(async () => INSTRUCTIONS);

    await expect(loadAgentSetup(path, { report, log: vi.fn() })).rejects.toThrow(/setup markers/);
    expect(report).toHaveBeenCalledWith({
      phase: 'failed',
      detail: expect.stringContaining('setup markers'),
    });
  });

  it('declares a failure and gives up on a file that is not there', async () => {
    const report = vi.fn(async () => INSTRUCTIONS);

    await expect(
      loadAgentSetup(join(folder, 'absent.json'), { report, log: vi.fn() }),
    ).rejects.toThrow(/setup markers/);
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ phase: 'failed' }));
  });

  it('gives up all the same when the failure could not be declared', async () => {
    const log = vi.fn();
    const report = vi.fn(async () => {
      throw new Error('ECONNRESET');
    });

    await expect(loadAgentSetup(join(folder, 'absent.json'), { report, log })).rejects.toThrow(
      /setup markers/,
    );
    expect(log).toHaveBeenCalledWith(expect.stringContaining('ECONNRESET'));
  });
});
```

- [ ] **Step 2: Lancer les tests et les voir échouer**

Run: `npx nx run companion:test`
Expected: FAIL, `Failed to resolve import "./game-log.js"` et `"./setup-watch.js"`, et les deux tests nouveaux de `config.spec.ts`.

- [ ] **Step 3: Écrire l'implémentation**

Dans `deploy/companion/src/lib/config.ts`, ajouter à `CompanionConfig`, après `workDir` :

```ts
  /**
   * Where a unit of the host copies what the game prints. The agent has no
   * docker socket: this file is the only form that output reaches it in.
   */
  readonly gameLog: string;
  /** What in that output says where the setup is — the catalogue's, read once at launch. */
  readonly setupMarkers: string;
```

et à l'objet que `readConfig` rend, après `workDir` :

```ts
    gameLog: required(env, 'BEACON_GAME_LOG'),
    setupMarkers: required(env, 'BEACON_SETUP_MARKERS'),
```

`deploy/companion/src/lib/game-log.ts` :

```ts
import { closeSync, fstatSync, openSync, readSync } from 'node:fs';

/** How much of the game's output a turn of the agent reads: its end, and no more. */
export const GAME_LOG_TAIL_BYTES = 65_536;

/**
 * The end of what the game printed. The file grows for the whole session, so
 * it is never read whole. Absent or unreadable, it reads as empty: until the
 * game's container exists nothing has written it, and that is no failure.
 */
export function readLogTail(path: string, maxBytes = GAME_LOG_TAIL_BYTES): string {
  let file: number;
  try {
    file = openSync(path, 'r');
  } catch {
    return '';
  }
  try {
    const size = fstatSync(file).size;
    const length = Math.min(size, maxBytes);
    const tail = Buffer.alloc(length);
    const read = readSync(file, tail, 0, length, size - length);
    return tail.subarray(0, read).toString('utf8');
  } catch {
    return '';
  } finally {
    closeSync(file);
  }
}
```

`deploy/companion/src/lib/setup-watch.ts` :

```ts
import { readFileSync } from 'node:fs';
import {
  declaredByMarkers,
  parseAgentSetup,
  REPORT_INTERVAL_MS,
  SETUP_REPORT_INTERVAL_MS,
  type AgentSetup,
} from '@beacon/agent-protocol';
import type { SetupDeclaration } from '@beacon/session';
import type { Reporter } from './reporter.js';

export interface LoadAgentSetupDeps {
  readonly report: Reporter['send'];
  readonly log: (message: string) => void;
}

/**
 * The markers the cloud-init wrote, read once at launch. A file this cannot
 * read is a catalogue entry to fix: the failure is declared, best effort, and
 * the agent gives up rather than follow a setup it knows nothing of.
 */
export async function loadAgentSetup(path: string, deps: LoadAgentSetupDeps): Promise<AgentSetup> {
  let setup: AgentSetup | null = null;
  try {
    setup = parseAgentSetup(readFileSync(path, 'utf8'));
  } catch {
    // Absent or unreadable: the same refusal as a file that says nothing.
  }
  if (setup !== null) return setup;

  // The path and never the content: this detail travels.
  const detail = `the setup markers at ${path} could not be read`;
  try {
    await deps.report({ phase: 'failed', detail });
  } catch (error) {
    deps.log(`could not report the failure: ${String(error)}`);
  }
  throw new Error(detail);
}

export interface SetupWatch {
  /**
   * What the game's output says of the setup, read anew on every call. The
   * start step until a line answers a marker; then whatever the last such line
   * decided, kept even once that line is out of what is read.
   */
  declared(): SetupDeclaration;
  /**
   * How long a turn waits while this setup is followed. A game with no marker
   * has nothing new to say between two minutes.
   */
  readonly intervalMs: number;
}

export function setupWatch(setup: AgentSetup, readTail: () => string): SetupWatch {
  let decided: SetupDeclaration = { step: setup.startStep };
  return {
    declared(): SetupDeclaration {
      decided = declaredByMarkers(setup, readTail()) ?? decided;
      return decided;
    },
    intervalMs: setup.markers.length > 0 ? SETUP_REPORT_INTERVAL_MS : REPORT_INTERVAL_MS,
  };
}
```

- [ ] **Step 4: Lancer les tests et les voir passer**

Run: `npx nx run companion:test`
Expected: PASS, à l'exception du seul test `names an image built from the sources in the tree`.

- [ ] **Step 5: Commit**

```bash
git add deploy/companion/src/lib/config.ts deploy/companion/src/lib/config.spec.ts deploy/companion/src/lib/game-log.ts deploy/companion/src/lib/game-log.spec.ts deploy/companion/src/lib/setup-watch.ts deploy/companion/src/lib/setup-watch.spec.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(companion): lit la fin de la sortie du jeu et l'étape qu'elle décide" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 8: L'agent déclare l'étape jusqu'à l'annonce du serveur

**Files:**
- Modify: `deploy/companion/src/lib/agent-loop.ts`
- Modify: `deploy/companion/src/lib/agent-loop.spec.ts`
- Modify: `deploy/companion/src/agent.ts`
- Modify: `deploy/companion/src/lib/readiness.ts` (commentaire)
- Modify: `deploy/companion/src/lib/serverid.ts` (commentaire)
- Modify: `deploy/cloud-init/src/lib/catalog.ts`, `deploy/cloud-init/src/lib/enshrouded.spec.ts` (commentaires)

**Interfaces:**
- Consumes: `GAME_LOG_MAX_CHARS`, `SETUP_REPORT_INTERVAL_MS`, `REPORT_INTERVAL_MS` (tâche 1), `readLogTail`, `loadAgentSetup`, `setupWatch`, `SetupWatch`, `CompanionConfig.gameLog`, `CompanionConfig.setupMarkers` (tâche 7).
- Produces, sur `AgentLoopDeps` :
  - `readonly setup: SetupWatch`
  - `readonly readGameLog: () => string`

Tant que le serveur n'est pas annoncé, chaque rapport de la boucle porte `setup`, celui qui l'annonce compris, et la boucle attend `setup.intervalMs` entre deux tours. Un rapport `failed` envoyé avant l'annonce porte aussi `gameLog`, les `GAME_LOG_MAX_CHARS` derniers caractères de ce que `readGameLog` rend, sauf si c'est vide.

- [ ] **Step 1: Adapter les tests existants**

Dans `deploy/companion/src/lib/agent-loop.spec.ts`, ajouter `GAME_LOG_MAX_CHARS` et `SETUP_REPORT_INTERVAL_MS` à l'import de `@beacon/agent-protocol`, et ajouter à l'objet `deps` du `beforeEach`, après `readWorld` :

```ts
    setup: {
      declared: vi.fn(() => ({ step: 'starting-game' as const })),
      intervalMs: SETUP_REPORT_INTERVAL_MS,
    },
    readGameLog: vi.fn(() => ''),
```

Dans le test `carries the identifier in the report that announces readiness`, remplacer l'assertion finale par :

```ts
    expect(phases[0]).toEqual({
      phase: 'ready',
      serverId: `${guid}~1`,
      world: { name: 'w', guid },
      setup: { step: 'starting-game' },
    });
```

Dans le test `reports readiness without an identifier when the probe found none`, remplacer l'assertion finale par :

```ts
    expect(phases[0]).toEqual({ phase: 'ready', setup: { step: 'starting-game' } });
```

Remplacer le commentaire du test `reports on every turn, ready or not` par :

```ts
  // On every turn, whatever the server is doing. Two guarantees hang on the
  // cadence of an announced server: an extension is learned in under a minute,
  // and the watchdog can tell a slow machine from a mute one.
```

- [ ] **Step 2: Écrire les tests qui échouent**

Ajouter dans `describe('runAgentLoop', …)` :

```ts
  describe('before the server is announced', () => {
    const reports = () => (deps.report as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);

    it('declares on every turn the step the output of the game decides', async () => {
      let turns = 0;
      const steps = ['fetching-game', 'fetching-game', 'starting-game'] as const;
      const probeReady = vi.fn(async () => {
        turns++;
        return { ready: false };
      });
      const setup = { ...deps.setup, declared: () => ({ step: steps[turns - 1] }) };

      await runAgentLoop({ ...deps, probeReady, setup, until: () => turns >= 3 });

      expect(reports()).toEqual([
        { phase: 'alive', setup: { step: 'fetching-game' } },
        { phase: 'alive', setup: { step: 'fetching-game' } },
        { phase: 'alive', setup: { step: 'starting-game' } },
      ]);
    });

    it('declares the step in the report that announces the server, and in none after it', async () => {
      let turns = 0;
      const probeReady = vi.fn(async () => {
        turns++;
        return { ready: turns >= 2 };
      });

      await runAgentLoop({ ...deps, probeReady, until: () => turns >= 4 });

      expect(reports()).toEqual([
        { phase: 'alive', setup: { step: 'starting-game' } },
        { phase: 'ready', setup: { step: 'starting-game' } },
        { phase: 'alive' },
        { phase: 'alive' },
      ]);
    });

    it('stops reading the output of the game once the server is announced', async () => {
      let turns = 0;
      const probeReady = vi.fn(async () => {
        turns++;
        return { ready: true };
      });

      await runAgentLoop({ ...deps, probeReady, until: () => turns >= 4 });

      expect(deps.setup.declared).toHaveBeenCalledTimes(1);
      expect(deps.readGameLog).not.toHaveBeenCalled();
    });

    it('waits the setup interval between two turns, then the report interval', async () => {
      let turns = 0;
      const probeReady = vi.fn(async () => {
        turns++;
        return { ready: turns >= 3 };
      });

      await runAgentLoop({ ...deps, probeReady, until: () => turns >= 4 });

      expect((deps.sleep as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0])).toEqual([
        SETUP_REPORT_INTERVAL_MS,
        SETUP_REPORT_INTERVAL_MS,
        REPORT_INTERVAL_MS,
        REPORT_INTERVAL_MS,
      ]);
    });

    it('waits the interval of the setup it follows, whatever it is', async () => {
      let turns = 0;
      const probeReady = vi.fn(async () => {
        turns++;
        return { ready: false };
      });

      await runAgentLoop({
        ...deps,
        probeReady,
        setup: { ...deps.setup, intervalMs: REPORT_INTERVAL_MS },
        until: () => turns >= 2,
      });

      expect(deps.sleep).toHaveBeenNthCalledWith(1, REPORT_INTERVAL_MS);
    });

    it('waits the setup interval after a report that failed to be sent', async () => {
      let turns = 0;
      const report = vi.fn(async () => {
        if (++turns === 1) throw new Error('ECONNRESET');
        return { state: 'PROVISIONING' as const, deadlineIso: null };
      });

      await runAgentLoop({
        ...deps,
        probeReady: async () => ({ ready: false }),
        report,
        until: () => turns >= 2,
      });

      expect(deps.sleep).toHaveBeenNthCalledWith(1, SETUP_REPORT_INTERVAL_MS);
    });

    it('joins the end of the output of the game to a failure it declares', async () => {
      let turns = 0;
      const probeReady = vi.fn(async () => {
        turns++;
        return { ready: true, serverId: '00000000-0000-0000-0000-000000000000~1' };
      });
      const readGameLog = vi.fn(() => 'last line of the game\n');

      await runAgentLoop({
        ...deps,
        probeReady,
        readGameLog,
        readWorld: () => WORLD,
        until: () => turns >= 1,
      });

      expect(reports()[0]).toEqual({
        phase: 'failed',
        detail: expect.stringContaining('serverId does not name the world'),
        setup: { step: 'starting-game' },
        gameLog: 'last line of the game\n',
      });
    });

    it('joins no more of the output than a report carries, and its end', async () => {
      let turns = 0;
      const probeReady = vi.fn(async () => {
        turns++;
        return { ready: true, serverId: '00000000-0000-0000-0000-000000000000~1' };
      });
      const readGameLog = () => `${'x'.repeat(GAME_LOG_MAX_CHARS)}the end`;

      await runAgentLoop({
        ...deps,
        probeReady,
        readGameLog,
        readWorld: () => WORLD,
        until: () => turns >= 1,
      });

      expect(reports()[0].gameLog).toHaveLength(GAME_LOG_MAX_CHARS);
      expect(reports()[0].gameLog.endsWith('the end')).toBe(true);
    });

    it('joins nothing to a failure when the game has printed nothing', async () => {
      let turns = 0;
      const probeReady = vi.fn(async () => {
        turns++;
        return { ready: true, serverId: '00000000-0000-0000-0000-000000000000~1' };
      });

      await runAgentLoop({ ...deps, probeReady, readWorld: () => WORLD, until: () => turns >= 1 });

      expect(reports()[0]).not.toHaveProperty('gameLog');
    });

    it('joins the output of the game to no report that is not a failure', async () => {
      let turns = 0;
      const probeReady = vi.fn(async () => {
        turns++;
        return { ready: false };
      });

      await runAgentLoop({
        ...deps,
        probeReady,
        readGameLog: vi.fn(() => 'last line of the game\n'),
        until: () => turns >= 2,
      });

      for (const report of reports()) expect(report).not.toHaveProperty('gameLog');
    });
  });
```

`WORLD` est déclaré plus bas dans le même `describe` : déplacer sa déclaration et celle de `phasesOf` avant ce bloc.

- [ ] **Step 3: Lancer les tests et les voir échouer**

Run: `npx nx run companion:test`
Expected: FAIL, aucun rapport ne porte `setup` et la boucle attend toujours `reportIntervalMs`.

- [ ] **Step 4: Écrire la boucle**

Dans `deploy/companion/src/lib/agent-loop.ts`, remplacer les trois imports du fichier par :

```ts
import {
  GAME_LOG_MAX_CHARS,
  type AgentInstructions,
  type AgentReport,
} from '@beacon/agent-protocol';
import type { Clock } from '@beacon/session';
import type { Readiness } from './readiness.js';
import type { SetupWatch } from './setup-watch.js';
```

Ajouter à `AgentLoopDeps`, après `readWorld` :

```ts
  /**
   * The setup this server goes through, followed until it is announced: what
   * to declare on each turn, and how long a turn waits. `reportIntervalMs`
   * takes over from there.
   */
  readonly setup: SetupWatch;
  /** The end of what the game printed. Read only for a failure declared before the server is announced. */
  readonly readGameLog: () => string;
```

Remplacer le commentaire de `runAgentLoop` par :

```ts
/**
 * One report a minute once the server is announced (§6). That cadence is not
 * an implementation detail: two measured guarantees hang on it — the machine
 * learns an extension or a stop in under a minute, and the watchdog can tell a
 * slow machine from a mute one.
 *
 * Until then every report also declares the step the setup is on, and the
 * turns follow the setup interval: a step is only worth telling while it is
 * the current one. Once announced the loop declares nothing more and reads the
 * game's output no longer.
 *
 * Everything the control plane decides comes back in the answer, so there is no
 * channel to keep open and no notification to miss.
 */
```

Dans le corps de la boucle, remplacer :

```ts
    let instructions: AgentInstructions;
    try {
      instructions = await deps.report(outcome.report);
      if (outcome.becomesReady) announced = true;
    } catch (error) {
      // The endpoint is across a network and the session is not over because
      // one call failed. A loop that died here would stop pushing saves — which
      // is the one thing this machine holds that nothing else can rebuild.
      deps.log(`report failed, trying again next turn: ${String(error)}`);
      await deps.sleep(deps.reportIntervalMs);
      continue;
    }
```

par :

```ts
    const report = announced ? outcome.report : beforeAnnounced(outcome.report, deps);

    let instructions: AgentInstructions;
    try {
      instructions = await deps.report(report);
      if (outcome.becomesReady) announced = true;
    } catch (error) {
      // The endpoint is across a network and the session is not over because
      // one call failed. A loop that died here would stop pushing saves — which
      // is the one thing this machine holds that nothing else can rebuild.
      deps.log(`report failed, trying again next turn: ${String(error)}`);
      await deps.sleep(turnInterval(deps, announced));
      continue;
    }
```

et remplacer la dernière ligne de la boucle, `await deps.sleep(deps.reportIntervalMs);`, par :

```ts
    await deps.sleep(turnInterval(deps, announced));
```

Ajouter après `runAgentLoop` :

```ts
const turnInterval = (deps: AgentLoopDeps, announced: boolean): number =>
  announced ? deps.reportIntervalMs : deps.setup.intervalMs;

/**
 * What a report carries on top of its phase while the server sets itself up:
 * the step it is on, and on a failure the end of what the game printed — the
 * one trace of it that outlives the machine.
 */
function beforeAnnounced(
  report: Omit<AgentReport, 'sessionId'>,
  deps: AgentLoopDeps,
): Omit<AgentReport, 'sessionId'> {
  const declaring = { ...report, setup: deps.setup.declared() };
  if (report.phase !== 'failed') return declaring;

  const gameLog = deps.readGameLog().slice(-GAME_LOG_MAX_CHARS);
  return gameLog === '' ? declaring : { ...declaring, gameLog };
}
```

- [ ] **Step 5: Câbler l'agent**

Dans `deploy/companion/src/agent.ts`, ajouter les imports :

```ts
import { readLogTail } from './lib/game-log.js';
import { loadAgentSetup, setupWatch } from './lib/setup-watch.js';
```

ajouter après la déclaration de `log` :

```ts
const report = httpReporter(config).send;
// Read once, and it stops the launch: an agent that cannot read its markers
// would follow a setup it knows nothing of.
const agentSetup = await loadAgentSetup(config.setupMarkers, { report, log });
const readGameLog = (): string => readLogTail(config.gameLog);
```

remplacer les deux `report: httpReporter(config).send,` par `report,`, et ajouter à l'objet passé à `runAgentLoop`, après `readWorld` :

```ts
  setup: setupWatch(agentSetup, readGameLog),
  readGameLog,
```

- [ ] **Step 6: Récrire les commentaires qui disent une fois par minute**

Dans `deploy/companion/src/lib/readiness.ts`, remplacer le commentaire de `PROBE_TIMEOUT_MS` par :

```ts
/**
 * Half the report interval of an announced server. Longer than a turn of a
 * server that follows its setup: measured, a game that listens on nothing yet
 * refuses a probe in 15 ms, and what a game that listens without answering
 * costs a turn is not measured.
 */
```

Dans `deploy/companion/src/lib/serverid.ts`, remplacer le premier commentaire par :

```ts
/**
 * Bounded like every value this wire carries (§5) — a file something else
 * filled must not grow a report the Function accepts on every turn.
 */
```

Dans `deploy/cloud-init/src/lib/catalog.ts`, dans le commentaire de `renderCloudInit`, remplacer `` `authorization` header, once a minute, for the whole session. Over plain http `` par :

```ts
 * `authorization` header, on every report, for the whole session. Over plain http
```

Dans `deploy/cloud-init/src/lib/enshrouded.spec.ts`, dans le commentaire du test `refuses to write a cloud-init that would carry the token in clear`, remplacer `once a minute for` par `on every report for`.

Relire `deploy/companion/src` et `deploy/cloud-init/src` par `grep -rn "a minute\|every minute\|thirty seconds" deploy/companion/src deploy/cloud-init/src` : tout autre commentaire qui dit qu'un serveur de jeu rapporte ou lit une fois par minute, ou toutes les trente secondes, se récrit pour dire « à chaque tour » ou la cadence d'un serveur annoncé. Les garanties d'un serveur annoncé, apprendre une prolongation en moins d'une minute, restent écrites comme elles le sont.

- [ ] **Step 7: Lancer les tests et les voir passer**

Run: `npx nx run companion:test`
Expected: PASS, à l'exception du seul test `names an image built from the sources in the tree`.

Run: `npx nx run cloud-init:test`
Expected: PASS.

Run: `npx nx run-many -t lint typecheck -p companion cloud-init agent-protocol scaleway-storage`
Expected: PASS. Une cible qu'un projet ne déclare pas est ignorée par Nx.

- [ ] **Step 8: Commit**

```bash
git add deploy/companion/src deploy/cloud-init/src/lib/catalog.ts deploy/cloud-init/src/lib/enshrouded.spec.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(companion): déclare l'étape à chaque tour jusqu'à l'annonce du serveur" -m "L'agent d'un jeu à marqueurs rapporte toutes les 10 s tant que le serveur n'est pas annoncé, et joint la fin de la sortie du jeu à un échec qu'il déclare." -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 9: Le test de fumée vérifie les étapes déclarées

**Files:**
- Modify: `deploy/companion/smoke/enshrouded.env`, `deploy/companion/smoke/sunkenland.env`
- Create: `deploy/companion/smoke/enshrouded.output`, `deploy/companion/smoke/sunkenland.output`
- Create: `deploy/companion/smoke/enshrouded.setup`, `deploy/companion/smoke/sunkenland.setup`
- Modify: `deploy/companion/smoke/stub-game.mjs`
- Modify: `deploy/companion/smoke/fake-endpoint.mjs`
- Modify: `deploy/companion/smoke/render-smoke-compose.mjs`
- Modify: `deploy/companion/smoke/run.sh`

**Interfaces:**
- Consumes: la cible `cloud-init:render-setup-markers` (tâche 4), les montages du compose du catalogue (tâche 5), le compagnon des tâches 6 à 8.
- Produces: `./tmp/beacon-smoke-setup.log`, une ligne par rapport qui porte `setup`, de la forme `<step>[ <activity>][ <progress>]`.

`run.sh` ne nomme toujours aucun jeu : ce que le faux jeu écrit vient de `<game>.output`, et les étapes attendues de `<game>.setup`.

- [ ] **Step 1: Écrire ce que chaque jeu apporte au harnais**

Ajouter à la fin de `deploy/companion/smoke/enshrouded.env` et de `deploy/companion/smoke/sunkenland.env` :

```
BEACON_GAME_LOG=/opt/beacon/log/game.log
BEACON_SETUP_MARKERS=/opt/beacon/setup-markers.json
```

`deploy/companion/smoke/enshrouded.output`, les lignes que la sonde a relevées, celles d'avant la ligne `---` écrites au lancement du faux jeu, les autres quinze secondes plus tard :

```
Update state (0x3) reconfiguring, progress: 0.00 (0 / 0)
Update state (0x61) downloading, progress: 36.46 (3212988231 / 8811579458)
---
Update state (0x0) unknown, progress: 0.00 (0 / 0)
Success! App '2278520' fully installed.
enshrouded-server: started
```

`deploy/companion/smoke/sunkenland.output` est un fichier vide : la sortie de ce jeu n'a pas été relevée, et son agent ne suit aucun marqueur.

`deploy/companion/smoke/enshrouded.setup`, les étapes que le faux plan de contrôle doit avoir reçues, dans cet ordre :

```
restoring-world
fetching-game downloading 36
starting-game
```

`deploy/companion/smoke/sunkenland.setup` :

```
fetching-game downloading 0
fetching-game unpacking
restoring-world
starting-game
```

- [ ] **Step 2: Faire retenir `setup` au faux plan de contrôle**

Dans `deploy/companion/smoke/fake-endpoint.mjs`, ajouter après la déclaration de `STOPPING_FLAG` :

```js
// One line per report that declares a step, apart from the phases: `run.sh`
// reads the phases back with `grep -qx`, and a step riding on those lines
// would change every one of them.
const SETUP_LOG = './tmp/beacon-smoke-setup.log';
```

remplacer la ligne qui déstructure le corps par :

```js
      const { phase, save, serverId, setup } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
```

et ajouter après `appendFileSync(PHASES_LOG, …);` :

```js
      if (setup) {
        const declared = [setup.step, setup.activity, setup.progress].filter((part) => part !== undefined);
        appendFileSync(SETUP_LOG, `${declared.join(' ')}\n`);
      }
```

- [ ] **Step 3: Faire écrire sa sortie au faux jeu, et le faire répondre plus tard**

Dans `deploy/companion/smoke/stub-game.mjs`, remplacer l'import de `node:fs` par :

```js
import { appendFileSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
```

Ajouter après la déclaration de `HEARTBEAT_MS` :

```js
/**
 * What this game prints, handed in as a file because this stub knows no game:
 * the lines before `---` are written at launch, the others a moment later.
 * They go straight to the file a unit of the host fills on a real machine —
 * nothing in this harness plays that unit's part.
 */
const OUTPUT_FILE = '/opt/game-output.txt';
const LATER_OUTPUT_MS = 15_000;

/**
 * Longer than the later output takes to be written, plus two turns of an agent
 * that follows a setup: the agent must have declared what both halves decide
 * before the server answers, since it declares nothing once it is announced.
 */
const QUERY_DELAY_MS = 40_000;

printOutput();

function printOutput() {
  const gameLog = process.env.GAME_LOG;
  if (!gameLog) throw new Error('stub-game: GAME_LOG is required');
  // A checkout may end these lines with a carriage return.
  const [atLaunch = '', later = ''] = readFileSync(OUTPUT_FILE, 'utf8').replaceAll('\r', '').split('---\n');
  // A game whose output was never measured prints nothing, and its agent reads
  // a file that is not there.
  if (atLaunch.trim() === '') return;
  mkdirSync(dirname(gameLog), { recursive: true });
  writeFileSync(gameLog, atLaunch);
  setTimeout(() => appendFileSync(gameLog, later), LATER_OUTPUT_MS);
}
```

Dans `answerQueries`, remplacer `socket.bind(port);` par :

```js
  // Not at once: a real server downloads and installs before it listens, and a
  // probe sent meanwhile is refused — which is what the agent must survive.
  setTimeout(() => socket.bind(port), QUERY_DELAY_MS);
```

et remplacer le gestionnaire `SIGTERM` de `answerQueries` par :

```js
  process.on('SIGTERM', () => process.exit(0));
```

Remplacer le commentaire de `ANNOUNCE_DELAY_MS` par :

```js
/**
 * The world above is written at once, the announcement below is not, and the
 * order is the measured one: a server has its world folder long before it
 * finishes booting — 121 to 205 seconds for the real image (probe/RESULTS.md).
 * What the probe has to survive is the wait, so this stub makes it wait: the
 * agent reports `alive` at least once, and cannot report `ready` on its very
 * first turn.
 */
```

et, dans `announceIdentifier`, remplacer `agent reads this file every thirty seconds` par `agent reads this file on every turn`.

- [ ] **Step 4: Donner au faux jeu son journal et sa sortie**

Dans `deploy/companion/smoke/render-smoke-compose.mjs`, ajouter après la déclaration de `serverId` :

```js
// Where the stub writes what the game prints (`BEACON_GAME_LOG`): the file the
// agent reads, through the mount the catalogue's own compose gives it.
const gameLog = process.env.GAME_LOG ?? '';
if (gameLog === '') {
  throw new Error('render-smoke-compose: GAME_LOG is required');
}
const gameLogDir = gameLog.slice(0, gameLog.lastIndexOf('/'));
```

Dans `stubBlock`, ajouter après la ligne `` `      SERVER_ID: "${serverId}"`, `` :

```js
  `      GAME_LOG: ${gameLog}`,
```

et remplacer la ligne `'      - ../stub-game.mjs:/opt/stub-game.mjs:ro',` par :

```js
  '      - ../stub-game.mjs:/opt/stub-game.mjs:ro',
  // The folder the agent mounts read-only, written here by the stub: on a real
  // machine a unit of the host fills it.
  `      - ./log:${gameLogDir}`,
  `      - ../${game}.output:/opt/game-output.txt:ro`,
```

- [ ] **Step 5: Faire vérifier les étapes à `run.sh`**

Dans `deploy/companion/smoke/run.sh`, ajouter après la fonction `assert_game_files` :

```bash
# The steps `<game>.setup` lists must all have been declared, in that order —
# other declarations may sit between them, and a step is declared on every turn
# it lasts. Read from a file per game for the reason everything else is: this
# script names no game, and which steps a restore and an agent declare is the
# catalogue's knowledge.
assert_setup_steps() {
  local from=1 expected found
  while IFS= read -r expected || [ -n "$expected" ]; do
    expected=${expected%$'\r'}
    [ -n "$expected" ] || continue
    found=$(tail -n "+$from" "$SETUP_LOG" | grep -nxF -m1 -- "$expected" | cut -d: -f1) || true
    if [ -z "$found" ]; then
      echo "smoke: no report declared \"$expected\" in its turn — declared instead: $(tr '\n' '/' < "$SETUP_LOG")" >&2
      exit 1
    fi
    from=$((from + found))
  done < "./${GAME}.setup"
}
```

Remplacer :

```bash
PHASES_LOG=./tmp/beacon-smoke-phases.log
clean_tmp
mkdir -p ./tmp
```

par :

```bash
PHASES_LOG=./tmp/beacon-smoke-phases.log
SETUP_LOG=./tmp/beacon-smoke-setup.log
clean_tmp
# `./tmp/log` too: the compose mounts it into the agent, and a folder docker
# made itself would belong to root on a Linux runner.
mkdir -p ./tmp/log
```

Dans la commande qui rend le compose, ajouter `GAME_LOG="$BEACON_GAME_LOG"` à côté de `SERVER_ID="$SERVER_ID"` :

```bash
GAME="$GAME" FORCE_COLOR=1 npx nx run cloud-init:render-compose |
  MSYS_NO_PATHCONV=1 GAME="$GAME" SAVE_DIR="$BEACON_SAVE_DIR" \
    READY_PROBE="$BEACON_READY_PROBE" SERVER_ID="$SERVER_ID" GAME_LOG="$BEACON_GAME_LOG" \
    node ./render-smoke-compose.mjs > "$COMPOSE_FILE"
```

et ajouter aussitôt après :

```bash
# What the agent reads when it starts, rendered from the catalogue like the
# compose above and written where that compose mounts it from: a marker changed
# in the catalogue changes what this stack declares.
GAME="$GAME" FORCE_COLOR=1 npx nx run cloud-init:render-setup-markers |
  node ./nx-target-output.mjs > ./tmp/setup-markers.json
```

Après la vérification du rapport `ready`, c'est-à-dire après le bloc qui commence par `grep -qx "ready${SERVER_ID:+ $SERVER_ID}" "$PHASES_LOG" ||`, ajouter :

```bash
# By the time the server is announced the agent has declared everything it
# will: it declares nothing once announced.
assert_setup_steps
```

Dans le commentaire qui précède le bloc `# 4 — clean shutdown`, et partout ailleurs dans ce fichier, un commentaire qui dit que le compagnon rapporte toutes les soixante secondes reste : il parle d'un serveur annoncé.

- [ ] **Step 6: Lancer le test de fumée pour chaque jeu**

Run: `npx nx run companion:smoke`
Expected: se termine par `smoke: the clean shutdown stopped the game, archived, and reported`, code 0.

Run: `npx nx build companion && bash deploy/companion/smoke/run.sh sunkenland`
Expected: même dernière ligne, code 0.

Si Docker n'est pas disponible, le dire dans le rapport de la tâche et ne pas prétendre que le test est passé.

- [ ] **Step 7: Voir le test refuser une étape qui manque**

Ajouter une ligne `restoring-world unpacking` à la fin de `deploy/companion/smoke/enshrouded.setup`, lancer `npx nx run companion:smoke`, et vérifier qu'il échoue sur `smoke: no report declared "restoring-world unpacking"`. Retirer la ligne.

- [ ] **Step 8: Commit**

```bash
git add deploy/companion/smoke
bash ~/.config/github-app/as-agent.sh git commit -m "test(companion): vérifie les étapes que le compagnon déclare, pour chaque jeu" -m "Le faux jeu écrit les lignes que la sonde a relevées, et le fichier des marqueurs est rendu depuis le catalogue." -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

## Before the merge

Cette story change `libs/agent-protocol`, `libs/scaleway-storage` et `deploy/companion`, que l'image du compagnon embarque. `companion:test` reste rouge sur `names an image built from the sources in the tree` tant que l'image n'est pas republiée.

Une fois la revue accordée et les `fixup!` écrasés :

1. Le commanditaire pose le tag `companion-v0.10` sur la tête de la branche et le pousse. Le workflow `companion` publie l'image.
2. `npx nx run companion:pin -- 0.10` récrit `deploy/cloud-init/src/lib/companion-image.ts`.
3. Le changement est commité sous `build(cloud-init): épingle le compagnon 0.10` et poussé.
4. `npx nx run companion:test` passe.

Un commit qui touche `libs/session`, `libs/agent-protocol`, `libs/scaleway-storage` ou `deploy/companion/src` après le tag demande un nouveau tag.

## Rulings log

Ruling: les deux cloud-init gardent chacun leur copie des fragments du fichier des marqueurs, de l'unité et des montages, et seuls le texte de l'unité et les chemins sont partagés dans `game-log.ts` — chaque entrée est un document littéral qu'on relit contre un serveur de jeu, et l'unité d'arrêt y est déjà copiée ainsi — si c'est faux, un changement de ces fragments se fait deux fois.

Ruling: la tâche 6 a tourné avant la tâche 5 — la tâche 5 récrit les fichiers que la revue de la tâche 4 pouvait encore rouvrir, et la tâche 6 ne touche que `deploy/companion/src` — si c'est faux, l'ordre des commits diffère de l'ordre des tâches, sans dépendance entre les deux.

Ruling: le test `sends nothing while a declaration still waits for its answer` de `declare-setup.spec.ts` attend un tour avant de répondre — le faux rapport n'est appelé qu'une microtâche après `declare`, et la version du plan répondait à un rapport qui n'existait pas encore — si c'est faux, un test attend un tour de trop.

Ruling: les tests de `restore.spec.ts` qui remplacent `report` reconstruisent `deps` au lieu d'assigner le champ — `RestoreDeps.report` est en lecture seule, et le plan faisait échouer le typecheck — si c'est faux, trois tests construisent un objet de plus.

Ruling: les deux commentaires « every thirty seconds » de `deploy/cloud-init/src/lib/sunkenland.ts` et de `sunkenland.spec.ts` disent « on every turn of the agent » — la recherche de la tâche 8 les vise et sa liste de fichiers les oubliait — si c'est faux, deux commentaires hors de la liste de la tâche ont changé, dont un dans le script que le cloud-init rend.

Ruling: le faux jeu du test de fumée pose un dossier `<nom>~<guid>` quand le jeu s'annonce par un identifiant, et `run.sh` vide le dossier des sauvegardes par `rm -rf` — le test de fumée de ce jeu n'atteignait plus `ready` sur `main`, son agent refusant un identifiant qui ne nomme aucun monde du disque, et les vérifications de cette story demandent ce passage au vert — si c'est faux, le harnais prouve le chemin de ce jeu avec un dossier qu'une vraie restauration aurait posé elle-même.

Ruling: la restauration déclare d'abord le téléchargement sans avancement, et un avancement seulement à partir des octets reçus — le plan déclarait 0 % avant de savoir si le seau donne la taille de l'objet, contre son propre point de vigilance — si c'est faux, l'écran ne montre aucun pourcentage pendant les dix premières secondes d'un téléchargement.

Ruling: une déclaration abandonnée après 5 s peut encore être traitée par le plan de contrôle, après la suivante — la revue de la branche le relève, et le lot accepte déjà qu'un rapport d'étape perdu ne soit pas renvoyé — si c'est faux, l'écran reste sur l'activité précédente jusqu'au rapport suivant, et le lot gagne ce risque à sa clôture.

Ruling: le faux jeu du test de fumée ne laisse lire la première moitié de sa sortie que pendant 15 s — la revue de la branche le relève, et un agent y fait deux tours — si c'est faux, un poste lent rend le test de fumée rouge à tort, jamais vert à tort.

Technical design ruling: la fonction qui décide d'une étape à partir de la sortie d'un jeu, `declaredByMarkers`, vit dans `libs/agent-protocol` avec le format du fichier, et les marqueurs d'Enshrouded s'exécutent sur la sortie relevée dans le test du catalogue, non dans celui du compagnon — le design range ce test chez le compagnon, qui ne nomme aucun jeu — si c'est faux, le compagnon n'a aucun test sur la sortie d'un vrai jeu, hors du test de fumée.

Technical design ruling: la fixture de la sortie d'Enshrouded reprend les lignes que `probe/RESULTS.md`, section P, cite, dans l'ordre qu'il mesure — la sonde n'a pas gardé sa capture — si c'est faux, une ligne que le relevé ne cite pas échappe aux tests des marqueurs.

Technical design ruling: le rapport qui annonce le serveur porte encore l'étape — il part avant que l'agent se sache annoncé, et il laisse l'étape gardée sur la dernière que le jeu a montrée — si c'est faux, un rapport `ready` porte une déclaration dont le plan de contrôle n'a pas besoin.

Technical design ruling: `parseReport` écarte aussi un `gameLog` qui n'est pas une chaîne — le design ne nomme que la borne de 16 384 caractères — si c'est faux, un rapport `failed` mal formé passe avec sa cause au lieu d'être refusé.

Technical design ruling: le plan de contrôle ne fait rien de `gameLog` dans cette story, et les commentaires de `restore.ts` et de `agent-loop.ts` sur l'attente du délai d'abandon restent — l'entrée du journal de la plateforme et l'abandon déclaré appartiennent à la story qui transcrit D4 — si c'est faux, la fin de la sortie du jeu voyage sans lecteur jusqu'à cette story.

Technical design ruling: l'unité de suivi passe `-f` et `--env-file` à `docker compose` et ne redirige que la sortie standard — sans le fichier d'environnement la commande écrit un avertissement par variable du compose — si c'est faux, une erreur de la commande elle-même ne se lit que dans le journal de systemd.

## Observed drift

Aucune.
