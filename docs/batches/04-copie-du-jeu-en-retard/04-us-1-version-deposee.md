# La version déposée Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** L'outil de dépôt lit la version de l'installation qu'il dépose, refuse celle qu'il ne peut pas lire ou dont il ne peut pas enregistrer la version, et enregistre cette version dans `gameCopies/{game}` une fois son dépôt relu.

**Architecture:** `libs/session` gagne `GameVersion` et la seule fonction qui la construit. Le catalogue dit pour chaque jeu quelle application Steam sa copie contient, et `tools/game-depot` y lit le numéro qu'il nommait lui-même. `libs/session-record` écrit la version déposée et l'heure du serveur Firestore dans `gameCopies/{game}`, par fusion. `adminFirestore` sort de `tools/world-depot` dans une bibliothèque `libs/admin-firestore`, par laquelle `update` et `push` ouvrent l'enregistrement. `pushGameFiles` lit le manifeste de l'installation, vérifie que l'enregistrement répond, dépose, relit, puis enregistre ; le parcours guidé fait les deux vérifications avant sa question.

**Tech Stack:** TypeScript, Vitest, Nx, `firebase-admin`, émulateur Firestore.

**Spec:** docs/specs/session.md
**Batch:** docs/batches/04-copie-du-jeu-en-retard/README.md
**Sections:** none
**Blocks:** none

## Global Constraints

### Ce que le lot impose

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
lui. D1 est transcrit avec le premier des trois autres blocs.

### Le périmètre de cette story

Cette story ne modifie que les fichiers que ses tâches nomment, et ce document.

`docs/specs/`, `firestore.rules`, `apps/`, `deploy/companion` et `probe/` ne changent pas.

Aucun client ne lit ni n'écrit `gameCopies/{game}` dans cette story : aucune règle ne s'y ajoute.

L'outil de dépôt n'écrit dans `gameCopies/{game}` que `depositedVersion` et `depositedAt`, par fusion.

`depositedAt` est l'heure du serveur Firestore, jamais celle du poste.

L'outil de dépôt ne gagne aucun verbe qui supprime, ni dans le seau ni dans Firestore.

`BEACON_FIREBASE_PROJECT` n'a aucune valeur par défaut.

La garde de `update.ts` qui refuse un autre jeu que `sunkenland`, l'ordre des étapes du catalogue et `gameArchiveKeyFor` restent tels quels : le lot ne réunit pas les façons dont le code dit qu'un jeu passe par une copie.

Aucune tâche ne modifie `deploy/cloud-init/src/lib/companion-image.ts`, ne lance `companion:pin`, ni ne pose de tag git.

À partir de la tâche 1, `companion:test` échoue sur le seul test `names an image built from the sources in the tree` de `deploy/companion/src/pin/catalogue-pin.spec.ts`, parce que l'empreinte du compagnon couvre `libs/session` et `package-lock.json`. Cet échec est attendu jusqu'à l'épinglage décrit sous `Before the merge`, et aucune tâche ne le corrige.

Aucune commande n'atteint la production : ni `firebase deploy`, ni appel à un fournisseur, ni `game-depot:update` ou `game-depot:push` sans émulateur, ni tag git. Les tests tournent contre l'émulateur.

### Les commandes

Les tests se lancent par Nx, un projet à la fois :

```bash
npx nx run @beacon/session:test
npx nx run cloud-init:test
npx nx run admin-firestore:test
npx nx run @beacon/session-record:test
npx nx run world-depot:test
npx nx run game-depot:test
npx nx run companion:test
```

`@beacon/session-record:test` démarre l'émulateur Firestore lui-même.

Chaque tâche finit par le typecheck et le lint des projets qu'elle touche, que son dernier pas nomme.

Après tout changement des dépendances d'un `package.json`, `npx nx sync` remet à jour les références TypeScript avant le typecheck.

### Les commits

Chaque commit passe par `bash ~/.config/github-app/as-agent.sh git commit`, et son message finit par `Co-Authored-By: Charlouze <me@charlouze.com>`.

Aucun commit, commentaire ni document ne mentionne un assistant ou un outil d'IA.

Le sujet d'un commit suit Conventional Commits, en français, à l'impératif, en minuscule, sans point final. La portée est le projet Nx touché.

Le code, ses commentaires et les mots que l'outil imprime sont en anglais. Ce document est en français.

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

- Un manifeste écrit avec des fins de ligne `\r\n`, comme sur le poste Windows qui dépose : la version se lit. Test dans la tâche 5.
- Une installation dont `steamapps/` ne porte que le manifeste d'une autre application : l'outil refuse, au lieu de lire la version d'un autre programme. Test dans la tâche 5.
- L'exploitant répond non à la question du dépôt : rien n'est écrit dans `gameCopies/{game}`. Test dans la tâche 6.
- L'enregistrement échoue après un dépôt relu : l'outil dit que l'archive est déposée, que sa version ne l'est pas, et qu'il faut le relancer, et sort en erreur. Test dans la tâche 6.
- Un dépôt dont la relecture échoue n'enregistre aucune version, pour que la version enregistrée ne décrive jamais une archive que l'outil n'a pas vérifiée. Test dans la tâche 6.

---

### Task 1: La version d'un jeu

**Files:**
- Create: `libs/session/src/lib/game-version.ts`
- Create: `libs/session/src/lib/game-version.spec.ts`
- Modify: `libs/session/src/index.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `type GameVersion` (une `string` marquée, qu'aucun littéral ne satisfait) et `gameVersionFrom(platformValue: unknown): GameVersion | null`, exportés par `@beacon/session`.

- [ ] **Step 1: Write the failing test**

`libs/session/src/lib/game-version.spec.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { gameVersionFrom } from './game-version.js';

describe('gameVersionFrom', () => {
  it('builds a version from the digits a platform returns', () => {
    expect(gameVersionFrom('25746735')).toBe('25746735');
  });

  it('builds equal versions from equal digits, and different ones from different digits', () => {
    expect(gameVersionFrom('25746735')).toBe(gameVersionFrom('25746735'));
    expect(gameVersionFrom('25746735')).not.toBe(gameVersionFrom('23178631'));
  });

  it.each([
    ['an empty string', ''],
    ['a space inside', '25 746'],
    ['a sign', '-1'],
    ['a dot', '1.2'],
    ['surrounding blanks', ' 25746735 '],
    ['letters', 'abc'],
  ])('refuses %s', (_, value) => {
    expect(gameVersionFrom(value)).toBeNull();
  });

  it.each([
    ['a number', 25746735],
    ['undefined', undefined],
    ['null', null],
    ['an object', { buildid: '25746735' }],
  ])('refuses %s, which is not what a platform spells a version with', (_, value) => {
    expect(gameVersionFrom(value)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx run @beacon/session:test`
Expected: FAIL, `game-version.js` introuvable.

- [ ] **Step 3: Write minimal implementation**

`libs/session/src/lib/game-version.ts` :

```ts
declare const publication: unique symbol;

/**
 * What identifies one publication of a game by its publisher. Opaque: two
 * publications never share one, and two versions are only ever compared for
 * equality, never ordered.
 */
export type GameVersion = string & { readonly [publication]: true };

/**
 * The only way to build a `GameVersion`, from what a platform returns. Every
 * producer of a version goes through here, because the value of one producer is
 * compared for equality with the value of another.
 */
export function gameVersionFrom(platformValue: unknown): GameVersion | null {
  if (typeof platformValue !== 'string' || !/^[0-9]+$/.test(platformValue)) return null;
  return platformValue as GameVersion;
}
```

Dans `libs/session/src/index.ts`, après `export * from './lib/game.js';` :

```ts
export * from './lib/game-version.js';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx run @beacon/session:test`
Expected: PASS.

Run: `npx nx run-many -t typecheck lint -p @beacon/session`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/session/src/lib/game-version.ts libs/session/src/lib/game-version.spec.ts libs/session/src/index.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(session): nomme la version d'un jeu et la seule façon de la construire" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

### Task 2: L'application Steam de la copie d'un jeu

**Files:**
- Modify: `deploy/cloud-init/src/lib/catalog.ts` (interface `GameCatalogEntry`)
- Modify: `deploy/cloud-init/src/lib/sunkenland.ts` (entrée `sunkenland`)
- Modify: `deploy/cloud-init/src/lib/enshrouded.ts` (entrée `enshrouded`)
- Test: `deploy/cloud-init/src/lib/catalog.spec.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `GameCatalogEntry.copySteamApp: string | null`, lu par `catalogFor(game).copySteamApp`.

- [ ] **Step 1: Write the failing test**

À la fin de `deploy/cloud-init/src/lib/catalog.spec.ts` :

```ts
describe('the copy a game goes through', () => {
  it('names the Steam application whose files the copy of sunkenland holds', () => {
    expect(catalogFor('sunkenland').copySteamApp).toBe('2667530');
  });

  it('names none for enshrouded, whose server fetches the game itself', () => {
    expect(catalogFor('enshrouded').copySteamApp).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx run cloud-init:test`
Expected: FAIL, `copySteamApp` vaut `undefined`.

- [ ] **Step 3: Write minimal implementation**

Dans `GameCatalogEntry` (`catalog.ts`), après `generatesWorlds` :

```ts
  /**
   * The Steam application whose files the copy of this game holds, or null for
   * a game that goes through no copy because its server fetches it. Steam's own
   * identifier, and named as such: another platform would need a field of its
   * own.
   */
  readonly copySteamApp: string | null;
```

Dans `sunkenland.ts`, après `generatesWorlds: false,` :

```ts
  // The dedicated server, a Steam application distinct from the game client.
  copySteamApp: '2667530',
```

Dans `enshrouded.ts`, après `generatesWorlds: true,` :

```ts
  copySteamApp: null,
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx run cloud-init:test`
Expected: PASS.

Run: `npx nx run-many -t typecheck lint -p cloud-init`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add deploy/cloud-init/src/lib/catalog.ts deploy/cloud-init/src/lib/sunkenland.ts deploy/cloud-init/src/lib/enshrouded.ts deploy/cloud-init/src/lib/catalog.spec.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(cloud-init): dit quelle application Steam la copie d'un jeu contient" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

### Task 3: L'accès d'administration à Firestore, hors de `world-depot`

**Files:**
- Create (par le générateur) : `libs/admin-firestore/`
- Create: `libs/admin-firestore/src/lib/admin-firestore.ts` (contenu de `tools/world-depot/src/lib/admin-firestore.ts`)
- Create: `libs/admin-firestore/src/lib/admin-firestore.spec.ts` (contenu de `tools/world-depot/src/lib/admin-firestore.spec.ts`)
- Modify: `libs/admin-firestore/src/index.ts`, `libs/admin-firestore/package.json`
- Delete: `tools/world-depot/src/lib/admin-firestore.ts`, `tools/world-depot/src/lib/admin-firestore.spec.ts`
- Modify: `tools/world-depot/src/adopt.ts:8`, `tools/world-depot/package.json`
- Modify: `STACK.md:62-63`
- Modify: `package-lock.json` (par `npm install`)

**Interfaces:**
- Consumes: rien.
- Produces: `adminFirestore(env: Record<string, string | undefined>): Firestore`, exporté par `@beacon/admin-firestore`, inchangé dans son comportement.

- [ ] **Step 1: Generate the library**

Run: `npx nx g @nx/js:library libs/admin-firestore --name=admin-firestore --importPath=@beacon/admin-firestore --bundler=none --unitTestRunner=vitest --linter=eslint --dry-run`
Expected: la liste des fichiers sous `libs/admin-firestore/`, et la référence ajoutée à `tsconfig.json`.

Run: `npx nx g @nx/js:library libs/admin-firestore --name=admin-firestore --importPath=@beacon/admin-firestore --bundler=none --unitTestRunner=vitest --linter=eslint`

Puis supprimer les fichiers d'exemple que le générateur a écrits sous `libs/admin-firestore/src/lib/`.

- [ ] **Step 2: Move the code and its test**

```bash
git mv tools/world-depot/src/lib/admin-firestore.ts libs/admin-firestore/src/lib/admin-firestore.ts
git mv tools/world-depot/src/lib/admin-firestore.spec.ts libs/admin-firestore/src/lib/admin-firestore.spec.ts
```

Dans `libs/admin-firestore/src/lib/admin-firestore.ts`, le nom de l'application passée à `initializeApp` ne nomme plus `world-depot` :

```ts
  const app = initializeApp({ credential: applicationDefault(), projectId }, `admin-firestore-${projectId}`);
```

Et le début du commentaire de la fonction devient :

```ts
/**
 * The identity a tool writes to Firestore with, and never a new secret (§8):
```

`libs/admin-firestore/src/index.ts` :

```ts
export * from './lib/admin-firestore.js';
```

`libs/admin-firestore/package.json` porte le tag et la dépendance :

```json
  "nx": {
    "name": "admin-firestore",
    "tags": ["scope:adapter"]
  },
  "dependencies": {
    "firebase-admin": "^13.10.0"
  }
```

Dans `tools/world-depot/src/adopt.ts`, la ligne 8 devient :

```ts
import { adminFirestore } from '@beacon/admin-firestore';
```

Dans `tools/world-depot/package.json`, `dependencies` gagne `"@beacon/admin-firestore": "*"` et perd `"firebase-admin"` si plus aucun fichier de `tools/world-depot/src` ne l'importe (`grep -rn "firebase-admin" tools/world-depot/src`).

Dans `STACK.md`, la phrase des lignes 62-63 devient :

```markdown
`gcloud` porte aussi l'identité par laquelle `tools/world-depot` et
`tools/game-depot` écrivent dans Firestore, par `gcloud auth application-default login` : le même poste, le
```

en gardant la fin de la phrase telle qu'elle est.

- [ ] **Step 3: Link the workspace and sync references**

Run: `npm install`
Expected: `package-lock.json` gagne l'entrée de `libs/admin-firestore`, et `node_modules/@beacon/admin-firestore` existe.

Run: `npx nx sync`

- [ ] **Step 4: Run the tests**

Run: `npx nx run admin-firestore:test`
Expected: PASS, les deux tests de `adminFirestore`.

Run: `npx nx run world-depot:test`
Expected: PASS.

Run: `npx nx run-many -t typecheck lint -p admin-firestore world-depot`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A libs/admin-firestore tools/world-depot STACK.md package-lock.json tsconfig.json
git status --short   # tout autre fichier que le dry-run a listé s'ajoute aussi
bash ~/.config/github-app/as-agent.sh git commit -m "refactor(admin-firestore): sort de world-depot l'accès d'administration à Firestore" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

`git status --short` ne doit plus rien montrer sous `libs/`, `tools/`, `STACK.md`, `package-lock.json` ni `tsconfig.json`.

### Task 4: L'enregistrement de la version déposée

**Files:**
- Create: `libs/session-record/src/lib/game-copy-record.ts`
- Create: `libs/session-record/src/lib/game-copy-record.spec.ts`
- Modify: `libs/session-record/src/lib/fields.ts` (après `completedSetupsDocument`)
- Modify: `libs/session-record/src/index.ts`

**Interfaces:**
- Consumes: `GameVersion` (tâche 1), `Game` de `@beacon/session`.
- Produces, exportés par `@beacon/session-record` :
  - `GAME_COPIES = 'gameCopies'` et `gameCopyDocPath(game: Game): string`, qui rend `gameCopies/{game}` ;
  - `interface GameCopyRecord { reach(game: Game): Promise<void>; recordDeposit(game: Game, version: GameVersion): Promise<void>; }` ;
  - `gameCopyRecord(db: Firestore): GameCopyRecord`.

- [ ] **Step 1: Write the failing test**

`libs/session-record/src/lib/game-copy-record.spec.ts` :

```ts
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { gameVersionFrom, type GameVersion } from '@beacon/session';
import { gameCopyRecord, type GameCopyRecord } from './game-copy-record.js';
import { gameCopyDocPath } from './fields.js';

process.env['FIRESTORE_EMULATOR_HOST'] ??= '127.0.0.1:8080';

const SUNKENLAND = gameCopyDocPath('sunkenland');

let app: ReturnType<typeof initializeApp>;
let db: Firestore;
let record: GameCopyRecord;

const version = (digits: string): GameVersion => {
  const built = gameVersionFrom(digits);
  if (built === null) throw new Error(`not a version: ${digits}`);
  return built;
};

const stored = async () => (await db.doc(SUNKENLAND).get()).data();

beforeAll(() => {
  app = initializeApp({ projectId: 'demo-beacon' }, 'game-copy-record-spec');
  db = getFirestore(app);
  record = gameCopyRecord(db);
});

afterAll(async () => {
  await deleteApp(app);
});

beforeEach(async () => {
  await db.doc(SUNKENLAND).delete();
});

describe('the document of a copy', () => {
  it('is one document per game, under gameCopies', () => {
    expect(gameCopyDocPath('sunkenland')).toBe('gameCopies/sunkenland');
  });
});

describe('reach', () => {
  it('answers without writing anything', async () => {
    await record.reach('sunkenland');

    expect(await stored()).toBeUndefined();
  });
});

describe('recordDeposit', () => {
  it('records the deposited version, at the time of the Firestore server', async () => {
    const before = Date.now();
    await record.recordDeposit('sunkenland', version('25746735'));

    const data = await stored();
    expect(data?.['depositedVersion']).toBe('25746735');
    expect(data?.['depositedAt']).toBeInstanceOf(Timestamp);
    expect((data?.['depositedAt'] as Timestamp).toMillis()).toBeGreaterThanOrEqual(before - 5_000);
  });

  it('replaces the version of an earlier deposit', async () => {
    await record.recordDeposit('sunkenland', version('23178631'));
    await record.recordDeposit('sunkenland', version('25746735'));

    expect((await stored())?.['depositedVersion']).toBe('25746735');
  });

  it('leaves every field it does not own as it found it', async () => {
    const readAt = Timestamp.fromMillis(1_791_303_546_000);
    await db.doc(SUNKENLAND).set({ publishedVersion: '25746735', readAt });

    await record.recordDeposit('sunkenland', version('23178631'));

    expect(await stored()).toMatchObject({ publishedVersion: '25746735', readAt, depositedVersion: '23178631' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx run @beacon/session-record:test`
Expected: FAIL, `game-copy-record.js` introuvable.

- [ ] **Step 3: Write minimal implementation**

Dans `libs/session-record/src/lib/fields.ts`, après `completedSetupsDocument` :

```ts
export const GAME_COPIES = 'gameCopies';

/** `gameCopies/{game}` — the copy Beacon keeps of one game, and what its publisher last published. */
export function gameCopyDocPath(game: Game): string {
  return `${GAME_COPIES}/${game}`;
}
```

`libs/session-record/src/lib/game-copy-record.ts` :

```ts
import type { Game, GameVersion } from '@beacon/session';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { gameCopyDocPath } from './fields.js';

export interface GameCopyRecord {
  /** Rejects when the record of the copy cannot be read. Writes nothing. */
  reach(game: Game): Promise<void>;
  /**
   * Records the version a verified deposit put in place, at the time of the
   * Firestore server. Leaves every other field of the document as it is: the
   * version read from the publisher is written by someone else.
   */
  recordDeposit(game: Game, version: GameVersion): Promise<void>;
}

export function gameCopyRecord(db: Firestore): GameCopyRecord {
  return {
    async reach(game): Promise<void> {
      await db.doc(gameCopyDocPath(game)).get();
    },

    async recordDeposit(game, version): Promise<void> {
      await db
        .doc(gameCopyDocPath(game))
        .set({ depositedVersion: version, depositedAt: FieldValue.serverTimestamp() }, { merge: true });
    },
  };
}
```

Dans `libs/session-record/src/index.ts`, après `export * from './lib/deployment-record.js';` :

```ts
export * from './lib/game-copy-record.js';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx run @beacon/session-record:test`
Expected: PASS.

Run: `npx nx run-many -t typecheck lint -p @beacon/session-record`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/session-record/src/lib/game-copy-record.ts libs/session-record/src/lib/game-copy-record.spec.ts libs/session-record/src/lib/fields.ts libs/session-record/src/index.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(session-record): enregistre la version de la copie déposée d'un jeu" -m "Le document porte aussi la version lue chez l'éditeur, que d'autres écrivent : l'écriture fusionne et ne touche que les deux champs du dépôt." -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

### Task 5: La version de l'installation, lue dans son manifeste

**Files:**
- Create: `tools/game-depot/src/lib/steam-manifest.ts`
- Create: `tools/game-depot/src/lib/steam-manifest.spec.ts`
- Modify: `tools/game-depot/src/lib/steam-install.ts` (suppression de `DEDICATED_SERVER_APP_ID`, `steamcmdCommandFor`)
- Modify: `tools/game-depot/src/lib/steam-install.spec.ts:6,186-210`
- Modify: `tools/game-depot/src/lib/guided-update.ts:158`
- Modify: `tools/game-depot/package.json`

**Interfaces:**
- Consumes: `gameVersionFrom`, `GameVersion` (tâche 1) ; `catalogFor(game).copySteamApp` (tâche 2).
- Produces :
  - `manifestPathFor(installDir: string, app: string): string`, qui rend `<installDir>/steamapps/appmanifest_<app>.acf` ;
  - `type InstalledVersion = { readonly version: GameVersion } | { readonly refusal: string }` ;
  - `installedVersion(readText: (path: string) => string | undefined, installDir: string, app: string): InstalledVersion` ;
  - `copySteamAppOf(game: Game): string`, qui lève une erreur pour un jeu qui ne passe par aucune copie ;
  - `steamcmdCommandFor(target: { readonly installDir: string; readonly account: string; readonly app: string }): string`.

- [ ] **Step 1: Write the failing test**

`tools/game-depot/src/lib/steam-manifest.spec.ts` :

```ts
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { gameVersionFrom } from '@beacon/session';
import { catalogFor } from '@beacon/cloud-init';
import { installedVersion, manifestPathFor } from './steam-manifest.js';

const INSTALL = join('D:', 'SteamLibrary', 'steamapps', 'common', 'Sunkenland Dedicated Server');
const APP = '2667530';

/** As steamcmd writes it after `+force_install_dir`, measured on the depositing machine. */
const COMPLETE = `"AppState"
{
\t"appid"\t\t"2667530"
\t"StateFlags"\t\t"4"
\t"LastUpdated"\t\t"1791464955"
\t"buildid"\t\t"25746735"
\t"TargetBuildID"\t\t"25746735"
}
`;

const reading = (files: Record<string, string>) => (path: string) => files[path];

describe('the manifest of an install', () => {
  it('sits in the install folder itself, named after the application', () => {
    expect(manifestPathFor(INSTALL, APP)).toBe(join(INSTALL, 'steamapps', 'appmanifest_2667530.acf'));
  });
});

describe('installedVersion', () => {
  it('reads the build of a complete install', () => {
    const read = reading({ [manifestPathFor(INSTALL, APP)]: COMPLETE });

    expect(installedVersion(read, INSTALL, APP)).toEqual({ version: '25746735' });
  });

  // The value compared for equality with what the publisher publishes: both
  // go through the one constructor, and this pins that the tool's does.
  it('builds the version the domain builds from the same digits', () => {
    const read = reading({ [manifestPathFor(INSTALL, APP)]: COMPLETE });

    expect(installedVersion(read, INSTALL, APP)).toEqual({ version: gameVersionFrom('25746735') });
  });

  it('reads a manifest written with Windows line endings', () => {
    const read = reading({ [manifestPathFor(INSTALL, APP)]: COMPLETE.replaceAll('\n', '\r\n') });

    expect(installedVersion(read, INSTALL, APP)).toEqual({ version: '25746735' });
  });

  it('refuses an install that carries no manifest', () => {
    const outcome = installedVersion(reading({}), INSTALL, APP);

    expect(outcome).toHaveProperty('refusal');
    expect((outcome as { refusal: string }).refusal).toContain('appmanifest_2667530.acf');
  });

  it('refuses an install whose only manifest is that of another application', () => {
    const read = reading({ [manifestPathFor(INSTALL, '2278520')]: COMPLETE.replace('2667530', '2278520') });

    expect(installedVersion(read, INSTALL, APP)).toHaveProperty('refusal');
  });

  it('refuses an install the manifest says is still downloading', () => {
    const read = reading({ [manifestPathFor(INSTALL, APP)]: COMPLETE.replace('"4"', '"1026"') });
    const outcome = installedVersion(read, INSTALL, APP);

    expect(outcome).toHaveProperty('refusal');
    expect((outcome as { refusal: string }).refusal).toMatch(/not complete/);
  });

  it('refuses a manifest that carries no state', () => {
    const read = reading({ [manifestPathFor(INSTALL, APP)]: COMPLETE.replace(/\t"StateFlags".*\n/, '') });

    expect(installedVersion(read, INSTALL, APP)).toHaveProperty('refusal');
  });

  it.each([
    ['no build', COMPLETE.replace(/\t"buildid".*\n/, '')],
    ['an empty build', COMPLETE.replace('"buildid"\t\t"25746735"', '"buildid"\t\t""')],
    ['a build that is not digits', COMPLETE.replace('"buildid"\t\t"25746735"', '"buildid"\t\t"v1.2"')],
  ])('refuses a manifest with %s', (_, manifest) => {
    const read = reading({ [manifestPathFor(INSTALL, APP)]: manifest });

    expect(installedVersion(read, INSTALL, APP)).toHaveProperty('refusal');
  });
});

describe('the application this tool installs and reads', () => {
  it('is the one the catalogue names for the copy of sunkenland', () => {
    expect(catalogFor('sunkenland').copySteamApp).toBe(APP);
  });
});
```

Dans `tools/game-depot/src/lib/steam-install.spec.ts`, l'import de `DEDICATED_SERVER_APP_ID` (ligne 6) disparaît, chaque appel à `steamcmdCommandFor` reçoit `app: '2667530'` en plus de `installDir` et `account`, et le test des lignes 195-198 devient :

```ts
  it('installs the application it is given', () => {
    expect(command()).toContain('+app_update 2667530 validate');
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx run game-depot:test`
Expected: FAIL, `steam-manifest.js` introuvable, et `steam-install.spec.ts` ne compile plus sur `app`.

- [ ] **Step 3: Write minimal implementation**

`tools/game-depot/src/lib/steam-manifest.ts` :

```ts
import { join } from 'node:path';
import { gameVersionFrom, type GameVersion } from '@beacon/session';

export type InstalledVersion = { readonly version: GameVersion } | { readonly refusal: string };

/**
 * Where `steamcmd +force_install_dir` writes the manifest of what it installed:
 * inside the folder this tool archives, measured in `probe/RESULTS.md`,
 * section E. An install made by the Steam client keeps it in its library
 * instead, and is refused for it.
 */
export function manifestPathFor(installDir: string, app: string): string {
  return join(installDir, 'steamapps', `appmanifest_${app}.acf`);
}

/** Measured: 1026 while steamcmd downloads, 4 once it is done. */
const FULLY_INSTALLED = '4';

function field(manifest: string, name: string): string | undefined {
  return new RegExp(`"${name}"\\s+"([^"]*)"`).exec(manifest)?.[1];
}

/**
 * The version of an install, read in its own manifest, or why it cannot be. A
 * folder whose version cannot be read is never deposited: the copy would then
 * be at a version nobody could name.
 */
export function installedVersion(
  readText: (path: string) => string | undefined,
  installDir: string,
  app: string,
): InstalledVersion {
  const path = manifestPathFor(installDir, app);
  const manifest = readText(path);
  if (manifest === undefined) {
    return {
      refusal: `${path} is missing, so the version of this install cannot be read. Install it with steamcmd +force_install_dir, as the command this tool prints does`,
    };
  }

  const state = field(manifest, 'StateFlags');
  if (state !== FULLY_INSTALLED) {
    return { refusal: `${path} says the install is not complete (StateFlags ${state ?? 'absent'}). Let steamcmd finish it` };
  }

  const version = gameVersionFrom(field(manifest, 'buildid'));
  if (version === null) return { refusal: `${path} names no build, so the version of this install cannot be read` };
  return { version };
}
```

Dans `tools/game-depot/src/lib/steam-install.ts`, supprimer `DEDICATED_SERVER_APP_ID` et son commentaire, et remplacer `steamcmdCommandFor` par :

```ts
export function steamcmdCommandFor(target: {
  readonly installDir: string;
  readonly account: string;
  readonly app: string;
}): string {
  return [
    'steamcmd',
    `+force_install_dir "${target.installDir}"`,
    `+login ${target.account}`,
    `+app_update ${target.app} validate`,
    '+quit',
  ].join(' ');
}
```

en gardant le commentaire qui la précède.

À la fin de `steam-manifest.ts`, avec `import { catalogFor } from '@beacon/cloud-init';` et `Game` ajouté à l'import de `@beacon/session` :

```ts
/** The application the copy of a game holds. A game that goes through no copy has nothing to deposit here. */
export function copySteamAppOf(game: Game): string {
  const app = catalogFor(game).copySteamApp;
  if (app === null) throw new Error(`${game} goes through no copy: nothing of it is deposited`);
  return app;
}
```

Et à la fin de `steam-manifest.spec.ts` :

```ts
describe('copySteamAppOf', () => {
  it('names the application of a game that goes through a copy', () => {
    expect(copySteamAppOf('sunkenland')).toBe(APP);
  });

  it('refuses a game that goes through no copy', () => {
    expect(() => copySteamAppOf('enshrouded')).toThrow(/no copy/);
  });
});
```

`copySteamAppOf` rejoint l'import de `./steam-manifest.js` dans ce fichier de test.

Dans `tools/game-depot/src/lib/guided-update.ts`, `sayHowToInstall` lit l'application dans le catalogue. Ajouter l'import :

```ts
import { copySteamAppOf } from './steam-manifest.js';
```

et la ligne 158 devient :

```ts
  say(`          ${steamcmdCommandFor({ installDir: suggestedInstallDir(libraries), account, app: copySteamAppOf(ports.game) })}`);
```

Dans `tools/game-depot/package.json`, `dependencies` gagne `"@beacon/cloud-init": "*"`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm install && npx nx sync`

Run: `npx nx run game-depot:test`
Expected: PASS, dont `hands over the exact steamcmd command instead of failing` de `guided-update.spec.ts`, qui attend toujours `+app_update 2667530 validate +quit`.

Run: `npx nx run-many -t typecheck lint -p game-depot`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tools/game-depot/src/lib/steam-manifest.ts tools/game-depot/src/lib/steam-manifest.spec.ts tools/game-depot/src/lib/steam-install.ts tools/game-depot/src/lib/steam-install.spec.ts tools/game-depot/src/lib/guided-update.ts tools/game-depot/package.json package-lock.json tools/game-depot/tsconfig.lib.json
bash ~/.config/github-app/as-agent.sh git commit -m "feat(game-depot): lit la version d'une installation dans son manifeste" -m "L'application vient désormais du catalogue. Le manifeste est celui que steamcmd écrit dans le dossier archivé ; une installation incomplète, ou sans build lisible, est refusée." -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

### Task 6: Le dépôt enregistre sa version

**Files:**
- Modify: `tools/game-depot/src/lib/game-depot.ts` (`PushGameFilesDeps`, `pushGameFiles`)
- Modify: `tools/game-depot/src/lib/game-depot.spec.ts`
- Modify: `tools/game-depot/src/lib/guided-update.ts` (`GuidedUpdatePorts`, étapes 3 et 4)
- Modify: `tools/game-depot/src/lib/guided-update.spec.ts`
- Modify: `tools/game-depot/src/update.ts`, `tools/game-depot/src/push.ts`
- Modify: `tools/game-depot/package.json`, `tools/game-depot/README.md`

**Interfaces:**
- Consumes: `GameCopyRecord` (tâche 4) ; `adminFirestore` (tâche 3) ; `installedVersion`, `copySteamAppOf` (tâche 5) ; `GameVersion` (tâche 1).
- Produces :
  - `PushGameFilesDeps` gagne `readonly record: GameCopyRecord` ;
  - `pushGameFiles(deps: PushGameFilesDeps): Promise<GameVersion>`, qui rend la version enregistrée ;
  - `GuidedUpdatePorts` gagne `readonly record: GameCopyRecord`, et `pushArchive` devient `(deps: PushGameFilesDeps) => Promise<GameVersion>`.

- [ ] **Step 1: Write the failing tests**

Dans `tools/game-depot/src/lib/game-depot.spec.ts`, un double de l'enregistrement et un manifeste dans l'installation de test. Ajouter aux imports :

```ts
import type { GameCopyRecord } from '@beacon/session-record';
import type { Game, GameVersion } from '@beacon/session';
```

Ajouter, au-dessus de `beforeEach` :

```ts
const MANIFEST = `"AppState"
{
\t"appid"\t\t"2667530"
\t"StateFlags"\t\t"4"
\t"buildid"\t\t"25746735"
}
`;

interface RecordDouble extends GameCopyRecord {
  readonly recorded: { game: Game; version: GameVersion }[];
}

function recordDouble(options: { reach?: () => Promise<void>; recordDeposit?: () => Promise<void> } = {}): RecordDouble {
  const recorded: { game: Game; version: GameVersion }[] = [];
  return {
    recorded,
    reach: options.reach ?? (async () => undefined),
    async recordDeposit(game, version) {
      await options.recordDeposit?.();
      recorded.push({ game, version });
    },
  };
}
```

Dans `beforeEach`, après l'écriture du binaire :

```ts
  mkdirSync(join(sunkenlandInstall, 'steamapps'));
  writeFileSync(join(sunkenlandInstall, 'steamapps', 'appmanifest_2667530.acf'), MANIFEST);
```

Chaque appel existant à `pushGameFiles({ api, game: 'sunkenland', from })` reçoit `record: recordDouble()`. Puis ajouter dans `describe('pushing game files', ...)` :

```ts
  it('records the version of what it deposited, once the deposit is read back', async () => {
    const record = recordDouble();

    expect(await pushGameFiles({ api: fakeObjectApi(), record, game: 'sunkenland', from: sunkenlandInstall })).toBe('25746735');
    expect(record.recorded).toEqual([{ game: 'sunkenland', version: '25746735' }]);
  });

  it('records nothing when the deposit it reads back disagrees', async () => {
    const record = recordDouble();
    const api = apiThatUndersellsWhatItStored(fakeObjectApi());

    await expect(pushGameFiles({ api, record, game: 'sunkenland', from: sunkenlandInstall })).rejects.toThrow(/size/);
    expect(record.recorded).toEqual([]);
  });

  it('refuses an install whose version cannot be read, before building anything', async () => {
    rmSync(join(sunkenlandInstall, 'steamapps'), { recursive: true });
    const api = fakeObjectApi();

    await expect(pushGameFiles({ api, record: recordDouble(), game: 'sunkenland', from: sunkenlandInstall })).rejects.toThrow(
      /appmanifest_2667530\.acf/,
    );
    expect(await api.list('sunkenland/')).toEqual([]);
  });

  it('refuses when the record cannot be reached, before building anything', async () => {
    const api = fakeObjectApi();
    const record = recordDouble({ reach: async () => Promise.reject(new Error('PERMISSION_DENIED')) });

    await expect(pushGameFiles({ api, record, game: 'sunkenland', from: sunkenlandInstall })).rejects.toThrow(/record/);
    expect(await api.list('sunkenland/')).toEqual([]);
  });

  it('says the archive is deposited and its version is not, when recording fails after the deposit', async () => {
    const api = fakeObjectApi();
    const record = recordDouble({ recordDeposit: async () => Promise.reject(new Error('UNAVAILABLE')) });

    await expect(pushGameFiles({ api, record, game: 'sunkenland', from: sunkenlandInstall })).rejects.toThrow(
      /deposited.*25746735.*not recorded.*again/s,
    );
    expect(await api.list('sunkenland/game.tar')).toHaveLength(1);
  });

  it('refuses a game that goes through no copy', async () => {
    await expect(
      pushGameFiles({ api: fakeObjectApi(), record: recordDouble(), game: 'enshrouded', from: sunkenlandInstall }),
    ).rejects.toThrow(/no copy/);
  });
```

`rmSync` s'ajoute à l'import de `node:fs`.

Dans `tools/game-depot/src/lib/guided-update.spec.ts` : `steamWithTheServer()` gagne le manifeste,

```ts
const SERVER_MANIFEST = `"AppState"
{
\t"appid"\t\t"2667530"
\t"StateFlags"\t\t"4"
\t"buildid"\t\t"25746735"
}
`;
```

```ts
    [join(SERVER_DIR, 'steamapps', 'appmanifest_2667530.acf')]: SERVER_MANIFEST,
```

`Harness` gagne `readonly recorded: string[]` et `readonly reached: string[]`, `harness` gagne l'option `readonly reach?: () => Promise<void>`, et ses ports deviennent :

```ts
      record: {
        reach: async (game) => {
          reached.push(game);
          await options.reach?.();
        },
        recordDeposit: async (_game, version) => {
          recorded.push(version);
        },
      },
      pushArchive: async ({ game, record }) => {
        bucket.set(gameArchiveKeyFor(game), 2_480_000_000);
        const version = gameVersionFrom('25746735');
        if (version === null) throw new Error('unreachable');
        await record.recordDeposit(game, version);
        return version;
      },
```

avec `const recorded: string[] = [];` et `const reached: string[] = [];` à côté de `bucket`, `recorded` et `reached` rendus par `harness`, et `import { gameVersionFrom } from '@beacon/session';`. Puis ajouter :

```ts
describe('the version of the copy', () => {
  it('says the build it is about to deposit, before asking', async () => {
    const flow = harness({});
    await runGuidedUpdate(flow.ports);

    const beforeTheQuestion = flow.said.slice(0, flow.said.findIndex((line) => line.startsWith('4.')));
    expect(beforeTheQuestion.join('\n')).toContain('25746735');
  });

  it('announces the version it recorded', async () => {
    const flow = harness({});
    expect(await runGuidedUpdate(flow.ports)).toBe('deposited');

    expect(flow.recorded).toEqual(['25746735']);
    expect(flow.said.join('\n')).toMatch(/25746735 recorded/);
  });

  it('refuses an install whose version cannot be read, without asking', async () => {
    const tree = steamWithTheServer();
    delete tree[join(SERVER_DIR, 'steamapps', 'appmanifest_2667530.acf')];
    const flow = harness({ tree });

    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(flow.said.join('\n')).toContain('appmanifest_2667530.acf');
    expect(flow.asked).toEqual([]);
    expect(flow.bucket.size).toBe(0);
  });

  it('refuses when the record cannot be reached, without asking', async () => {
    const flow = harness({ reach: async () => Promise.reject(new Error('PERMISSION_DENIED')) });

    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(flow.said.join('\n')).toMatch(/record/i);
    expect(flow.asked).toEqual([]);
    expect(flow.bucket.size).toBe(0);
  });

  it('checks the record is reachable before asking', async () => {
    const flow = harness({});
    await runGuidedUpdate(flow.ports);

    expect(flow.reached).toEqual(['sunkenland']);
  });

  it('records nothing when the operator declines', async () => {
    const flow = harness({ answer: (question) => !/deposit/i.test(question) });

    expect(await runGuidedUpdate(flow.ports)).toBe('declined');
    expect(flow.recorded).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx run game-depot:test`
Expected: FAIL, `record` absent de `PushGameFilesDeps` et de `GuidedUpdatePorts`.

- [ ] **Step 3: Write minimal implementation**

Dans `tools/game-depot/src/lib/game-depot.ts`, ajouter aux imports :

```ts
import type { GameCopyRecord } from '@beacon/session-record';
import { copySteamAppOf, installedVersion } from './steam-manifest.js';
```

`readFileSync` rejoint l'import existant de `node:fs`, et `type GameVersion` l'import existant de `@beacon/session`.

`PushGameFilesDeps` gagne, après `api` :

```ts
  /** Where the version of the copy is recorded, once the deposit is read back. */
  readonly record: GameCopyRecord;
```

`pushGameFiles` devient :

```ts
/**
 * Builds the archive from a local install, deposits it, reads its own deposit
 * back rather than trusting the upload, then records the version it deposited.
 * Everything that can refuse happens before the archive is built, and the
 * version is recorded only for a deposit that was read back: a recorded
 * version never describes an archive this tool did not verify.
 *
 * The reread costs a `list`, never a second `get` — downloading 2.3 GB back
 * would double the price of every push to catch a fault a `ListObjectsV2`
 * already reports.
 */
export async function pushGameFiles(deps: PushGameFilesDeps): Promise<GameVersion> {
  const version = await versionToDeposit(deps);
  await depositArchive(deps);
  await recordDeposit(deps, version);
  return version;
}

/** The version of the install, once nothing is left that could refuse the push. */
async function versionToDeposit(deps: PushGameFilesDeps): Promise<GameVersion> {
  const app = copySteamAppOf(deps.game);
  if (!existsSync(join(deps.from, SERVER_BINARY))) {
    throw new Error(`${deps.from} does not hold ${SERVER_BINARY}: refusing to push the wrong folder`);
  }
  const installed = installedVersion(
    (path) => (existsSync(path) ? readFileSync(path, 'utf8') : undefined),
    deps.from,
    app,
  );
  if ('refusal' in installed) throw new Error(`${installed.refusal}: refusing to push`);
  try {
    await deps.record.reach(deps.game);
  } catch (error) {
    throw new Error(`the record of the copy cannot be reached (${String(error)}): nothing deposited`);
  }
  return installed.version;
}

async function depositArchive(deps: PushGameFilesDeps): Promise<void> {
  const key = gameArchiveKeyFor(deps.game);
  const workDir = mkdtempSync(join(tmpdir(), 'game-depot-'));
  try {
    const archive = join(workDir, 'game.tar');
    // No gzip: these files are already compressed, and re-compressing 2.3 GB
    // would cost minutes of CPU on both ends for nothing.
    await create({ file: archive, cwd: deps.from }, ['.']);
    const sizeBytes = statSync(archive).size;

    await deps.api.put(key, archive);

    const deposited = (await deps.api.list(key)).find((summary) => summary.key === key);
    // A network that drops mid-upload can leave s3 holding an object shorter
    // than what was sent, without the request itself ever failing. 2.3 GB in
    // one `PutObject` is exactly the size where that silence is expensive.
    if (deposited === undefined || deposited.sizeBytes !== sizeBytes) {
      throw new Error(
        `deposited size disagrees with what was pushed: expected ${sizeBytes} bytes, s3 reports ${deposited?.sizeBytes ?? 'nothing'}`,
      );
    }
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

async function recordDeposit(deps: PushGameFilesDeps, version: GameVersion): Promise<void> {
  try {
    await deps.record.recordDeposit(deps.game, version);
  } catch (error) {
    // The archive is new and the recorded version is the old one: the copy
    // reads as behind until a run of this tool records it.
    throw new Error(
      `${gameArchiveKeyFor(deps.game)} is deposited, but its version ${version} was not recorded (${String(error)}): run this again`,
    );
  }
}
```

Dans `tools/game-depot/src/lib/guided-update.ts` :

- l'import de `./steam-manifest.js` devient `import { copySteamAppOf, installedVersion } from './steam-manifest.js';`, et `type GameVersion` rejoint l'import de `@beacon/session` ;
- `GuidedUpdatePorts` gagne `readonly record: GameCopyRecord;` (avec `import type { GameCopyRecord } from '@beacon/session-record';`), et `pushArchive` devient :

```ts
  /** `pushGameFiles` itself. A port only so a test does not need 2.3 GB on disk. */
  readonly pushArchive: (deps: PushGameFilesDeps) => Promise<GameVersion>;
```

- l'étape 3, après la vérification de `SERVER_BINARY` et avant la mesure du dossier :

```ts
  const installed = installedVersion(ports.files.readText, installDir, copySteamAppOf(ports.game));
  if ('refusal' in installed) {
    say(`  STOP  ${installed.refusal}.`);
    return 'refused';
  }
  try {
    await ports.record.reach(ports.game);
  } catch (error) {
    say(`  STOP  the record of the copy cannot be reached: ${error instanceof Error ? error.message : String(error)}`);
    say('        BEACON_FIREBASE_PROJECT names the project, and gcloud auth application-default login the identity.');
    return 'refused';
  }
```

- dans la ligne `ok` qui suit la mesure, la version s'ajoute :

```ts
  say(`  ok    ${gigabytes(measure.sizeBytes)}, ${measure.fileCount} files, ${SERVER_BINARY} present, build ${installed.version}`);
  say('  ok    the record of the copy answers');
```

- l'étape 4 passe l'enregistrement et annonce la version, après la ligne `ok` du seau :

```ts
  const version = await ports.pushArchive({ api: bucket, record: ports.record, game: ports.game, from: installDir });
```

```ts
  say(`  ok    build ${version} recorded as the copy of ${ports.game}`);
```

Dans `tools/game-depot/src/update.ts`, ajouter les imports :

```ts
import { adminFirestore } from '@beacon/admin-firestore';
import { gameCopyRecord } from '@beacon/session-record';
```

et passer à `runGuidedUpdate`, après `files: onDisk,` :

```ts
    record: gameCopyRecord(adminFirestore(process.env)),
```

`adminFirestore` lève l'erreur qui nomme `BEACON_FIREBASE_PROJECT` quand la variable manque, et le `catch` existant la rend avec le code de sortie 1.

Dans `tools/game-depot/src/push.ts`, les mêmes imports, et l'appel devient :

```ts
  const version = await pushGameFiles({
    api: fromS3(client, requiredEnv('BEACON_GAMES_BUCKET')),
    record: gameCopyRecord(adminFirestore(process.env)),
    game,
    from,
  });
  console.log(`beacon: pushed ${gameArchiveKeyFor(game)}, build ${version} recorded`);
```

Dans `tools/game-depot/package.json`, `dependencies` gagne `"@beacon/admin-firestore": "*"` et `"@beacon/session-record": "*"`.

Dans `tools/game-depot/README.md` :

- la commande de `game-depot:update` devient :

```bash
BEACON_FIREBASE_PROJECT=<projet> npx nx run game-depot:update
```

- le paragraphe qui suit gagne, après « dépose et relit » : « , puis enregistre dans Firestore la version de ce qu'il a déposé » ;
- un paragraphe s'ajoute avant `Options, toutes facultatives` :

```markdown
La version est le `buildid` du manifeste que `steamcmd` écrit dans
l'installation, `steamapps/appmanifest_<application>.acf`. L'outil refuse une
installation sans manifeste, ou que son manifeste dit incomplète, et refuse de
déposer quand l'enregistrement ne répond pas. `BEACON_FIREBASE_PROJECT` n'a
aucune valeur par défaut, et l'identité est celle que
`gcloud auth application-default login` a laissée sur le poste.
```

- la phrase de `game-depot:push` devient « Pour un script qui a déjà résolu son dossier et exporté les cinq variables `BEACON_S3_*` et `BEACON_FIREBASE_PROJECT`. »

- [ ] **Step 4: Run test to verify it passes**

Run: `npm install && npx nx sync`

Run: `npx nx run game-depot:test`
Expected: PASS.

Run: `npx nx run-many -t typecheck lint -p game-depot`
Expected: PASS.

- [ ] **Step 5: Check the refusal without a project**

Run: `BEACON_FIREBASE_PROJECT= npx nx run game-depot:update`
Expected: `beacon: Error: BEACON_FIREBASE_PROJECT is required…` et un code de sortie non nul, avant toute lecture de la clé d'administration. La variable est vidée explicitement, pour que la commande ne puisse rien atteindre.

- [ ] **Step 6: Commit**

```bash
git add tools/game-depot package-lock.json
git status --short
bash ~/.config/github-app/as-agent.sh git commit -m "feat(game-depot): enregistre la version de la copie qu'il dépose" -m "La version s'enregistre après la relecture du dépôt : une interruption entre les deux laisse l'ancienne version sur une archive neuve, que relancer l'outil corrige, et jamais l'inverse. update exige désormais BEACON_FIREBASE_PROJECT." -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

## Before the merge

Cette story change `libs/session` et `package-lock.json`, que l'empreinte de l'image du compagnon couvre. `companion:test` reste rouge sur `names an image built from the sources in the tree` tant que l'image n'est pas republiée.

Une fois la revue accordée et les `fixup!` écrasés :

1. Le commanditaire pose le tag `companion-v0.14` sur la tête de la branche et le pousse. Le workflow `companion` publie l'image.
2. `npx nx run companion:pin -- 0.14` récrit `deploy/cloud-init/src/lib/companion-image.ts`.
3. Le changement est commité sous `build(cloud-init): épingle le compagnon 0.14` et poussé.
4. `npx nx run companion:test` passe.

Un commit qui touche `libs/session`, `libs/agent-protocol`, `libs/scaleway-storage`, `deploy/companion/src` ou `package-lock.json` après le tag demande un nouveau tag.

Après la fusion, le commanditaire lance `BEACON_FIREBASE_PROJECT=<projet> npx nx run game-depot:update` depuis le poste qui possède le jeu, jusqu'à ce que l'outil annonce la version enregistrée.

## Rulings log

## Observed drift
