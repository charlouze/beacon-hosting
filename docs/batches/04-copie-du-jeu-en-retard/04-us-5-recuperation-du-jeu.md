# La récupération du jeu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `game-depot:update` amène lui-même, par `steamcmd`, l'installation locale à la version que l'éditeur publie, puis la dépose ; quand la version installée est déjà celle de la copie enregistrée, il le dit et demande s'il dépose quand même ; il propose les jeux du catalogue qui passent par une copie.

**Architecture:** Le catalogue dit, pour un jeu qui passe par une copie, l'exécutable que son installation porte (`copyExecutable`), celui que `sunkenland.ts` lance. `libs/session-record` remplace `GameCopyRecord.reach` par `depositedVersion`, une lecture qui prouve aussi que l'enregistrement répond. `tools/game-depot` lit l'application et l'exécutable dans le catalogue (`copyApplicationOf`), contrôle chaque dossier par le manifeste puis l'exécutable (`installedCopy`), dans `push` comme dans `update`. Le parcours guidé gagne trois ports — un terminal qui répond, le choix d'un jeu, `steamcmd` — trouve l'installation par son manifeste ou en ouvre une sous `beacon-<jeu>`, lance `steamcmd` sans `validate` et cesse d'imprimer une commande.

**Tech Stack:** TypeScript, Vitest, Nx, `node:child_process` (`spawn`), `firebase-admin`, émulateur Firestore.

**Spec:** docs/specs/session.md
**Batch:** docs/batches/04-copie-du-jeu-en-retard/README.md
**Sections:** none
**Blocks:** none

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

### Ce que la story s'interdit

- Aucune commande de cette story ne lance `game-depot:update` ni `game-depot:push` contre le projet de production ou le seau `beacon-games`, et aucune ne lance `steamcmd` : un dépôt écrit dans un seau facturé et dans le Firestore de production, et `steamcmd` télécharge 8,69 Gio avec le compte de l'exploitant. L'essai du port `steamcmd` réel revient à un humain (Task 5).
- Aucune tâche ne touche `libs/session` ni `package-lock.json` : la story ne change pas l'empreinte de l'image du compagnon, dont le bundle n'inline ni `deploy/cloud-init` ni `libs/session-record`.
- Les tests de `session-record` tournent contre l'émulateur, par leur cible Nx.

## Review Focus

- Un dossier d'installation dont le chemin porte des espaces (`C:\Program Files (x86)\Steam\...`) arrive à `steamcmd` en un seul argument, sans guillemets ajoutés : `steamcmdArgumentsFor` le garde entier (Task 4).
- `steamcmd` qui rend `0` sans rien télécharger laisse l'ancienne installation, complète : l'outil la voit à la version de la copie déposée et demande s'il dépose quand même, non par défaut (Task 4).
- `steamcmd` interrompu ou qui ne se lance pas rejette sans code de sortie : rien n'est déposé, et l'outil sort en échec (Task 4).
- Une réponse au choix du jeu qui ne désigne aucun jeu arrête l'outil avant `steamcmd` (Task 4).
- `--from` désigne le dossier où `steamcmd` installe : un dossier vide passé par `--from` reçoit l'installation, au lieu d'être refusé avant le téléchargement (Task 4).

---

### Task 1: Le catalogue dit l'exécutable que porte la copie d'un jeu

**Files:**
- Modify: `deploy/cloud-init/src/lib/catalog.ts` (interface `GameCatalogEntry`, après `copySteamApp`)
- Modify: `deploy/cloud-init/src/lib/sunkenland.ts:71-81` (commentaire de `SERVER_BINARY`) et l'entrée `sunkenland`
- Modify: `deploy/cloud-init/src/lib/enshrouded.ts` (entrée `enshrouded`, à côté de `copySteamApp: null`)
- Test: `deploy/cloud-init/src/lib/catalog.spec.ts` (describe `the copy a game goes through`)
- Test: `deploy/cloud-init/src/lib/sunkenland.spec.ts:320-333`

**Interfaces:**
- Produces: `GameCatalogEntry.copyExecutable: string | null`, nul exactement quand `copySteamApp` l'est ; `catalogFor('sunkenland').copyExecutable === 'Sunkenland-DedicatedServer.exe'`.

- [ ] **Step 1: Write the failing tests**

Dans `catalog.spec.ts`, `GAMES` rejoint l'import de `@beacon/session` (`import { GAMES, isSetupStepOrder, type Game } from '@beacon/session';`), et le describe `the copy a game goes through` gagne :

```ts
  it('names the executable the copy of sunkenland carries', () => {
    expect(catalogFor('sunkenland').copyExecutable).toBe('Sunkenland-DedicatedServer.exe');
  });

  it('names no executable for enshrouded, which goes through no copy', () => {
    expect(catalogFor('enshrouded').copyExecutable).toBeNull();
  });

  it.each(GAMES)('names an executable for %s exactly when it names an application', (game) => {
    const entry = catalogFor(game);
    expect(entry.copyExecutable === null).toBe(entry.copySteamApp === null);
  });
```

Dans `sunkenland.spec.ts`, le test `launches the very binary the depot refuses to push without` et son commentaire deviennent :

```ts
  // The depot refuses a copy without the executable the catalogue names, and
  // this line launches it. The smoke barrier runs a stub game and never
  // executes it: a drift would reach production mute — no server, no
  // identifier in the log, no join point.
  it('launches the executable the catalogue says the copy carries', () => {
    expect(renderCloudInit('sunkenland', REQUEST)).toContain(
      `wine "$GAME_DIR/${catalogFor('sunkenland').copyExecutable}"`,
    );
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx nx test cloud-init`
Expected: FAIL — `copyExecutable` vaut `undefined` ; le test de `sunkenland.spec.ts` cherche `wine "$GAME_DIR/undefined"`.

- [ ] **Step 3: Write the implementation**

Dans `catalog.ts`, après `readonly copySteamApp: string | null;` :

```ts
  /**
   * The file every install of this game's copy carries, and the one its
   * server launches, or null exactly when `copySteamApp` is. The depot
   * refuses a folder without it, so a copy it deposits is one the server
   * can start.
   */
  readonly copyExecutable: string | null;
```

Dans `sunkenland.ts`, le commentaire de `SERVER_BINARY` (lignes 71-80) devient :

```ts
/** What `wine` launches, and the file the depot refuses to deposit a copy without. */
const SERVER_BINARY = 'Sunkenland-DedicatedServer.exe';
```

et l'entrée gagne, juste après `copySteamApp: '2667530',` :

```ts
  copyExecutable: SERVER_BINARY,
```

Dans `enshrouded.ts`, juste après `copySteamApp: null,` :

```ts
  copyExecutable: null,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx nx run-many -t test,typecheck,lint -p cloud-init`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add deploy/cloud-init/src/lib/catalog.ts deploy/cloud-init/src/lib/sunkenland.ts deploy/cloud-init/src/lib/enshrouded.ts deploy/cloud-init/src/lib/catalog.spec.ts deploy/cloud-init/src/lib/sunkenland.spec.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(cloud-init): dit dans le catalogue l'exécutable que porte la copie d'un jeu

Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 2: L'outil lit la version déposée plutôt que de seulement joindre l'enregistrement

**Files:**
- Modify: `libs/session-record/src/lib/game-copy-record.ts:5-25`
- Test: `libs/session-record/src/lib/game-copy-record.spec.ts:46-52` (describe `reach`)
- Modify: `tools/game-depot/src/lib/game-depot.ts:75-79`
- Modify: `tools/game-depot/src/lib/guided-update.ts:125-131`
- Test: `tools/game-depot/src/lib/game-depot.spec.ts:18-32,138-144`
- Test: `tools/game-depot/src/lib/guided-update.spec.ts:94-155,391-405`

**Interfaces:**
- Produces: `GameCopyRecord.depositedVersion(game: Game): Promise<GameVersion | null>` — la version du dernier dépôt enregistré, ou `null` ; rejette quand l'enregistrement ne se lit pas ; n'écrit rien. `GameCopyRecord.reach` disparaît.

- [ ] **Step 1: Write the failing test**

Dans `game-copy-record.spec.ts`, le describe `reach` est remplacé par :

```ts
describe('depositedVersion', () => {
  it('reads none when nothing was deposited, without writing anything', async () => {
    expect(await record.depositedVersion('sunkenland')).toBeNull();
    expect(await stored()).toBeUndefined();
  });

  it('reads the version the last deposit recorded', async () => {
    await record.recordDeposit('sunkenland', version('23178631'));
    await record.recordDeposit('sunkenland', version('25746735'));

    expect(await record.depositedVersion('sunkenland')).toBe('25746735');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx nx test session-record`
Expected: FAIL — `record.depositedVersion is not a function`.

- [ ] **Step 3: Write the implementation**

Dans `game-copy-record.ts`, `reach` est remplacé, dans l'interface et dans `gameCopyRecord`. `gameCopyFrom` rejoint l'import de `./fields.js` :

```ts
import { gameCopyDocPath, gameCopyFrom } from './fields.js';

export interface GameCopyRecord {
  /**
   * The version the last recorded deposit put in place, or null when none is:
   * the copy exactly as the Functions read it. Rejects when the record cannot
   * be read, which is how the tool learns it could not record either. Writes
   * nothing.
   */
  depositedVersion(game: Game): Promise<GameVersion | null>;
  /** …le commentaire de recordDeposit reste tel quel… */
  recordDeposit(game: Game, version: GameVersion): Promise<void>;
}

export function gameCopyRecord(db: Firestore): GameCopyRecord {
  return {
    async depositedVersion(game): Promise<GameVersion | null> {
      const snapshot = await db.doc(gameCopyDocPath(game)).get();
      return gameCopyFrom(snapshot.data() ?? {})?.version ?? null;
    },

    // recordDeposit inchangé
  };
}
```

`gameCopyFrom` est peut-être déjà importé par ce fichier pour `gameCopyStore` : ne pas le doubler.

Les deux appelants suivent. Dans `tools/game-depot/src/lib/game-depot.ts`, `versionToDeposit` :

```ts
  try {
    await deps.record.depositedVersion(deps.game);
  } catch (error) {
    throw new Error(`the record of the copy cannot be reached (${String(error)}): nothing deposited`);
  }
```

Dans `tools/game-depot/src/lib/guided-update.ts`, l'étape 3 :

```ts
  try {
    await ports.record.depositedVersion(ports.game);
  } catch (error) {
```

(le reste du bloc inchangé).

Leurs doubles suivent. Dans `game-depot.spec.ts`, `recordDouble` :

```ts
function recordDouble(
  options: { depositedVersion?: () => Promise<GameVersion | null>; recordDeposit?: () => Promise<void> } = {},
): RecordDouble {
  const recorded: { game: Game; version: GameVersion }[] = [];
  return {
    recorded,
    depositedVersion: options.depositedVersion ?? (async () => null),
    async recordDeposit(game, version) {
      await options.recordDeposit?.();
      recorded.push({ game, version });
    },
  };
}
```

et le test `refuses when the record cannot be reached, before building anything` passe `recordDouble({ depositedVersion: async () => Promise.reject(new Error('PERMISSION_DENIED')) })`.

Dans `guided-update.spec.ts`, l'option `reach` de `harness` devient `depositedVersion?: () => Promise<GameVersion | null>` (`type GameVersion` rejoint l'import de `@beacon/session`), et le double :

```ts
      record: {
        depositedVersion: async (game) => {
          reached.push(game);
          return (await options.depositedVersion?.()) ?? null;
        },
```

Le test `refuses when the record cannot be reached, without asking` passe `depositedVersion: async () => Promise.reject(new Error('PERMISSION_DENIED'))`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx nx run-many -t test,typecheck,lint -p session-record,game-depot`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/session-record/src/lib/game-copy-record.ts libs/session-record/src/lib/game-copy-record.spec.ts tools/game-depot/src/lib/game-depot.ts tools/game-depot/src/lib/guided-update.ts tools/game-depot/src/lib/game-depot.spec.ts tools/game-depot/src/lib/guided-update.spec.ts
bash ~/.config/github-app/as-agent.sh git commit -m "refactor(session-record): fait lire la version déposée à l'outil de dépôt au lieu de seulement joindre l'enregistrement

Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 3: Le dépôt refuse un dossier sans l'exécutable que le catalogue donne

**Files:**
- Create: `tools/game-depot/src/lib/copy-application.ts`
- Create: `tools/game-depot/src/lib/copy-application.spec.ts`
- Modify: `tools/game-depot/src/lib/steam-manifest.ts` (retire `copySteamAppOf` et l'import de `@beacon/cloud-init`, ajoute `installedCopy`)
- Test: `tools/game-depot/src/lib/steam-manifest.spec.ts` (retire le describe `copySteamAppOf`, ajoute `installedCopy`)
- Modify: `tools/game-depot/src/lib/game-depot.ts:56-81`
- Test: `tools/game-depot/src/lib/game-depot.spec.ts:101-111`
- Modify: `tools/game-depot/src/lib/guided-update.ts:16,117,122,184` (les trois appels à `copySteamAppOf`)

**Interfaces:**
- Consumes: `catalogFor(game).copySteamApp`, `catalogFor(game).copyExecutable` (Task 1) ; `GameCopyRecord.depositedVersion` (Task 2).
- Produces:
  - `interface CopyApplication { readonly steamApp: string; readonly executable: string }` et `copyApplicationOf(game: Game): CopyApplication`, qui lève une erreur contenant `no copy` pour un jeu qui ne passe par aucune copie — dans `copy-application.ts` ;
  - `installedCopy(files: Pick<LocalFiles, 'exists' | 'readText'>, installDir: string, copy: CopyApplication): InstalledVersion` — le manifeste d'abord, puis l'exécutable — dans `steam-manifest.ts`.

- [ ] **Step 1: Write the failing tests**

`tools/game-depot/src/lib/copy-application.spec.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { catalogFor } from '@beacon/cloud-init';
import { copyApplicationOf } from './copy-application.js';

describe('copyApplicationOf', () => {
  it('names the application and the executable the catalogue gives the copy of a game', () => {
    const entry = catalogFor('sunkenland');
    expect(copyApplicationOf('sunkenland')).toEqual({ steamApp: entry.copySteamApp, executable: entry.copyExecutable });
  });

  it('refuses a game that goes through no copy', () => {
    expect(() => copyApplicationOf('enshrouded')).toThrow(/no copy/);
  });
});
```

Dans `steam-manifest.spec.ts`, l'import devient `import { installedCopy, installedVersion, manifestPathFor } from './steam-manifest.js';`, le describe `copySteamAppOf` disparaît, et ce describe s'ajoute :

```ts
describe('installedCopy', () => {
  const COPY = { steamApp: APP, executable: 'Server.exe' };
  const onDisk = (tree: Record<string, string>) => ({
    exists: (path: string) => tree[path] !== undefined,
    readText: (path: string) => tree[path],
  });

  it('reads the build of a complete install that holds the executable', () => {
    const files = onDisk({ [manifestPathFor(INSTALL, APP)]: COMPLETE, [join(INSTALL, 'Server.exe')]: 'MZ' });

    expect(installedCopy(files, INSTALL, COPY)).toEqual({ version: gameVersionFrom('25746735') });
  });

  it('refuses a complete install that does not hold the executable, naming it', () => {
    const files = onDisk({ [manifestPathFor(INSTALL, APP)]: COMPLETE });

    expect(installedCopy(files, INSTALL, COPY)).toEqual({ refusal: expect.stringContaining('Server.exe') });
  });

  it('refuses on the manifest before it looks for the executable', () => {
    const files = onDisk({ [join(INSTALL, 'Server.exe')]: 'MZ' });

    expect(installedCopy(files, INSTALL, COPY)).toEqual({ refusal: expect.stringContaining('appmanifest_2667530.acf') });
  });
});
```

Dans `game-depot.spec.ts`, le test `refuses a source folder that does not hold the server` devient :

```ts
  // Depositing from the wrong folder costs a transfer and an evening of doubt
  // over the one set of files nobody can push again without the Steam account.
  it('refuses a folder without the executable the catalogue names for the game, before building anything', async () => {
    rmSync(join(sunkenlandInstall, 'Sunkenland-DedicatedServer.exe'));
    const api = fakeObjectApi();

    await expect(pushGameFiles({ api, record: recordDouble(), game: 'sunkenland', from: sunkenlandInstall })).rejects.toThrow(
      /Sunkenland-DedicatedServer\.exe/,
    );
    expect(await api.list('sunkenland/')).toEqual([]);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx nx test game-depot`
Expected: FAIL — `copy-application.js` introuvable, `installedCopy` non exporté.

- [ ] **Step 3: Write the implementation**

`tools/game-depot/src/lib/copy-application.ts` :

```ts
import type { Game } from '@beacon/session';
import { catalogFor } from '@beacon/cloud-init';

/** What the catalogue says the copy of a game is made of. */
export interface CopyApplication {
  /** The Steam application whose files the copy holds. */
  readonly steamApp: string;
  /** The file every install of it carries, and the one its server launches. */
  readonly executable: string;
}

/** The copy of a game, as the catalogue describes it. A game that goes through no copy has nothing to deposit here. */
export function copyApplicationOf(game: Game): CopyApplication {
  const { copySteamApp, copyExecutable } = catalogFor(game);
  if (copySteamApp === null || copyExecutable === null) {
    throw new Error(`${game} goes through no copy: nothing of it is deposited`);
  }
  return { steamApp: copySteamApp, executable: copyExecutable };
}
```

Dans `steam-manifest.ts`, `copySteamAppOf` et l'import de `catalogFor` disparaissent ; `type Game` quitte l'import de `@beacon/session` s'il n'y sert plus. S'ajoutent :

```ts
import type { CopyApplication } from './copy-application.js';
import type { LocalFiles } from './steam-install.js';

/**
 * The version of an install of a game's copy, or why it is refused: its
 * manifest first, then the executable the catalogue says it carries. A folder
 * that passes both is one a server of that game can start.
 */
export function installedCopy(
  files: Pick<LocalFiles, 'exists' | 'readText'>,
  installDir: string,
  copy: CopyApplication,
): InstalledVersion {
  const installed = installedVersion(files.readText, installDir, copy.steamApp);
  if ('refusal' in installed) return installed;
  if (!files.exists(join(installDir, copy.executable))) {
    return { refusal: `${installDir} holds no ${copy.executable}, so it is not an install of this copy` };
  }
  return installed;
}
```

Dans `game-depot.ts`, `versionToDeposit` passe par `installedCopy`, et l'import de `./steam-manifest.js` devient `import { installedCopy } from './steam-manifest.js';` à côté de `import { copyApplicationOf } from './copy-application.js';`. `SERVER_BINARY` reste exporté jusqu'à la Task 4, qui le retire avec ses derniers lecteurs.

```ts
const onDisk = {
  exists: (path: string) => existsSync(path),
  readText: (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : undefined),
};

/** The version of the install, once nothing is left that could refuse the push. */
async function versionToDeposit(deps: PushGameFilesDeps): Promise<GameVersion> {
  const installed = installedCopy(onDisk, deps.from, copyApplicationOf(deps.game));
  if ('refusal' in installed) throw new Error(`${installed.refusal}: refusing to push`);
  try {
    await deps.record.depositedVersion(deps.game);
  } catch (error) {
    throw new Error(`the record of the copy cannot be reached (${String(error)}): nothing deposited`);
  }
  return installed.version;
}
```

Le commentaire de `PushGameFilesDeps.from` devient `/** The local folder holding an install of the game's copy. */`.

Dans `guided-update.ts`, l'import `copySteamAppOf` de `./steam-manifest.js` est retiré, `import { copyApplicationOf } from './copy-application.js';` s'ajoute, et les trois appels `copySteamAppOf(ports.game)` deviennent `copyApplicationOf(ports.game).steamApp`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx nx run-many -t test,typecheck,lint -p game-depot`
Expected: PASS. Le test `refuses a game that goes through no copy` de `game-depot.spec.ts` passe toujours : `copyApplicationOf` lève `no copy`.

- [ ] **Step 5: Commit**

```bash
git add tools/game-depot/src/lib/copy-application.ts tools/game-depot/src/lib/copy-application.spec.ts tools/game-depot/src/lib/steam-manifest.ts tools/game-depot/src/lib/steam-manifest.spec.ts tools/game-depot/src/lib/game-depot.ts tools/game-depot/src/lib/game-depot.spec.ts tools/game-depot/src/lib/guided-update.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(game-depot): refuse un dossier sans l'exécutable que le catalogue donne à la copie du jeu

Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 4: `update` amène l'installation à la version publiée par `steamcmd`, puis la dépose

**Files:**
- Modify: `tools/game-depot/src/lib/copy-application.ts` (ajoute `gamesWithACopy`)
- Test: `tools/game-depot/src/lib/copy-application.spec.ts`
- Modify: `tools/game-depot/src/lib/steam-install.ts` (réécrit en partie)
- Test: `tools/game-depot/src/lib/steam-install.spec.ts` (réécrit en partie)
- Modify: `tools/game-depot/src/lib/steam-manifest.ts:36-40` (texte du refus d'un manifeste absent)
- Modify: `tools/game-depot/src/lib/guided-update.ts` (réécrit)
- Test: `tools/game-depot/src/lib/guided-update.spec.ts` (réécrit)
- Modify: `tools/game-depot/src/lib/game-depot.ts` (retire `SERVER_BINARY`)
- Test: `tools/game-depot/src/lib/game-depot.spec.ts` (retire le describe `the server binary` et l'import de `SERVER_BINARY`)
- Modify: `tools/game-depot/src/update.ts` (réécrit)
- Modify: `tools/game-depot/README.md`
- Modify: `STACK.md` (section `Outillage`)

**Interfaces:**
- Consumes: `copyApplicationOf`, `CopyApplication`, `installedCopy` (Task 3) ; `GameCopyRecord.depositedVersion` (Task 2) ; `GAMES` de `@beacon/session`.
- Produces:
  - `gamesWithACopy(): readonly Game[]` — `copy-application.ts` ;
  - `interface SteamcmdTarget { readonly installDir: string; readonly account: string; readonly app: string }`, `findInstall(files, libraries, app): string | undefined`, `installDirFor(libraries, game): string`, `steamcmdArgumentsFor(target): readonly string[]`, `findSteamcmd(pathVariable: string | undefined, exists: (path: string) => boolean): string | undefined` — `steam-install.ts` ;
  - `interface Steamcmd { present(): boolean; install(target: SteamcmdTarget): Promise<number> }`, `GuidedUpdatePorts` réécrit, `GuidedUpdateOutcome = 'deposited' | 'declined' | 'refused'` — `guided-update.ts`.
- Removes: `SERVER_BINARY`, `findDedicatedServer`, `suggestedInstallDir`, `steamcmdCommandFor`, `sayHowToInstall`, l'issue `not-installed`, le seuil `WEIGHT_THAT_IS_NO_LONGER_A_SERVER` et son avertissement, `RESUME_QUESTION`, le compte `<your-steam-account>`, la garde de `update.ts` qui ne connaît que sunkenland.

- [ ] **Step 1: Write the failing tests of the pure functions**

Dans `copy-application.spec.ts`, l'import devient `import { copyApplicationOf, gamesWithACopy } from './copy-application.js';` et s'ajoute :

```ts
describe('gamesWithACopy', () => {
  it('offers the games of the catalogue that go through a copy, and only those', () => {
    expect(gamesWithACopy()).toEqual(['sunkenland']);
  });
});
```

Dans `steam-install.spec.ts` : l'import de `SERVER_BINARY` disparaît ; l'import de `./steam-install.js` devient :

```ts
import { delimiter, join } from 'node:path';
import {
  discoverSteamAccount,
  findInstall,
  findSteamcmd,
  installDirFor,
  steamLibraries,
  steamcmdArgumentsFor,
} from './steam-install.js';
import { manifestPathFor } from './steam-manifest.js';
```

(la ligne `import { join } from 'node:path';` est remplacée par celle qui importe aussi `delimiter`). Le describe `recognising an install of the dedicated server` est remplacé par :

```ts
const APP = '2667530';

describe('finding the install of an application', () => {
  it('finds the folder whose own manifest names the application', () => {
    const install = commonFolder(SECOND_LIBRARY, 'Sunkenland Dedicated Server');
    const files = inMemoryFiles({ [manifestPathFor(install, APP)]: '"AppState" {}' });
    expect(findInstall(files, [SECOND_LIBRARY], APP)).toBe(install);
  });

  // The client sits next to the server in the same `common/`, and once held a
  // file that looked like the server's. Only the manifest steamcmd writes
  // inside the folder it installs tells the two apart.
  it('never takes a folder without that manifest, whatever it holds', () => {
    const client = commonFolder(DEFAULT_STEAM, 'Sunkenland');
    const files = inMemoryFiles({
      [join(client, 'Sunkenland.exe')]: 8_060_000,
      [join(client, 'Sunkenland-DedicatedServer.exe')]: 1_000,
    });
    expect(findInstall(files, [DEFAULT_STEAM], APP)).toBeUndefined();
  });

  it('ignores the manifest of another application', () => {
    const other = commonFolder(DEFAULT_STEAM, 'Something');
    const files = inMemoryFiles({ [manifestPathFor(other, '999')]: '"AppState" {}' });
    expect(findInstall(files, [DEFAULT_STEAM], APP)).toBeUndefined();
  });

  it('looks past the library holding the client, into the one holding the install', () => {
    const install = commonFolder(SECOND_LIBRARY, 'Sunkenland Dedicated Server');
    const files = inMemoryFiles({
      [join(commonFolder(DEFAULT_STEAM, 'Sunkenland'), 'Sunkenland.exe')]: 8_060_000,
      [manifestPathFor(install, APP)]: '"AppState" {}',
    });
    expect(findInstall(files, [DEFAULT_STEAM, SECOND_LIBRARY], APP)).toBe(install);
  });
});

describe('where a first install goes', () => {
  it('goes in the first library, under a name no Steam client takes', () => {
    expect(installDirFor([DEFAULT_STEAM, SECOND_LIBRARY], 'sunkenland')).toBe(
      commonFolder(DEFAULT_STEAM, 'beacon-sunkenland'),
    );
  });

  it('is where the next search finds it', () => {
    const target = installDirFor([DEFAULT_STEAM, SECOND_LIBRARY], 'sunkenland');
    const files = inMemoryFiles({ [manifestPathFor(target, APP)]: '"AppState" {}' });
    expect(findInstall(files, [DEFAULT_STEAM, SECOND_LIBRARY], APP)).toBe(target);
  });
});
```

Le describe `the steamcmd command an operator is handed` est remplacé par :

```ts
describe('what steamcmd is launched with', () => {
  const args = (installDir = 'D:\\SteamLibrary\\steamapps\\common\\srv'): readonly string[] =>
    steamcmdArgumentsFor({ installDir, account: 'someone', app: APP });

  // Steam fixes its install root at login. A `+force_install_dir` that comes
  // after is not refused — it is ignored, and the download lands in steamcmd's
  // own folder where the next run of this tool will never look.
  it('puts +force_install_dir before +login', () => {
    expect(args().indexOf('+force_install_dir')).toBeLessThan(args().indexOf('+login'));
  });

  it('updates the application it is given, without validate', () => {
    expect(args()).toContain('+app_update');
    expect(args()[args().indexOf('+app_update') + 1]).toBe(APP);
    expect(args()).not.toContain('validate');
  });

  // `+login` accepts a password as a second word. steamcmd asks for it in the
  // terminal, and Steam Guard asks again regardless.
  it('carries the account name and nothing behind it', () => {
    expect(args().slice(args().indexOf('+login'), args().indexOf('+login') + 3)).toEqual([
      '+login',
      'someone',
      '+app_update',
    ]);
  });

  it('passes a folder with spaces as one argument, unquoted', () => {
    const folder = 'C:\\Program Files (x86)\\Steam\\steamapps\\common\\beacon-sunkenland';
    expect(args(folder)[args(folder).indexOf('+force_install_dir') + 1]).toBe(folder);
  });

  it('quits once the update is done', () => {
    expect(args().at(-1)).toBe('+quit');
  });
});

describe('finding steamcmd', () => {
  const at = (...paths: string[]) => (path: string) => paths.includes(path);

  it('takes steamcmd.exe in the first folder of the PATH that holds it', () => {
    const pathVariable = ['C:\\Windows', 'C:\\steamcmd', 'D:\\other'].join(delimiter);
    expect(findSteamcmd(pathVariable, at(join('C:\\steamcmd', 'steamcmd.exe'), join('D:\\other', 'steamcmd.exe')))).toBe(
      join('C:\\steamcmd', 'steamcmd.exe'),
    );
  });

  it('finds nothing when no folder of the PATH holds it', () => {
    expect(findSteamcmd(['C:\\Windows', 'C:\\tools'].join(delimiter), at())).toBeUndefined();
  });

  it('finds nothing without a PATH, and skips its empty entries', () => {
    expect(findSteamcmd(undefined, at(join('', 'steamcmd.exe')))).toBeUndefined();
    expect(findSteamcmd(['', 'C:\\steamcmd'].join(delimiter), at(join('', 'steamcmd.exe')))).toBeUndefined();
  });
});
```

Le describe `the Steam account` et le describe `the Steam libraries` restent tels quels.

- [ ] **Step 2: Run them to verify they fail**

Run: `npx nx test game-depot`
Expected: FAIL — `gamesWithACopy`, `findInstall`, `installDirFor`, `steamcmdArgumentsFor`, `findSteamcmd` ne sont pas exportés.

- [ ] **Step 3: Write the pure functions**

Dans `copy-application.ts`, `GAMES` rejoint l'import (`import { GAMES, type Game } from '@beacon/session';`) et s'ajoute :

```ts
/** The games this tool deposits a copy of, in the catalogue's order. */
export function gamesWithACopy(): readonly Game[] {
  return GAMES.filter((game) => catalogFor(game).copySteamApp !== null);
}
```

Dans `steam-install.ts` : l'import de `SERVER_BINARY`, `DEDICATED_SERVER_FOLDER`, `findDedicatedServer`, `suggestedInstallDir` et `steamcmdCommandFor` disparaissent. Les imports deviennent :

```ts
import { delimiter, join } from 'node:path';
import type { Game } from '@beacon/session';
import { manifestPathFor } from './steam-manifest.js';
```

Le commentaire de `LocalFiles` dit `the case this whole flow exists for` d'une installation absente : il devient `and cannot be made to *not* hold the install — the case where the tool installs it itself.` S'ajoutent, à la place de `findDedicatedServer` et `suggestedInstallDir` :

```ts
/**
 * The install of an application, recognised by the manifest steamcmd writes
 * inside the folder it installs. A game client sitting next to it in the same
 * `common/` carries no such file, whatever it is named.
 */
export function findInstall(files: LocalFiles, libraries: readonly string[], app: string): string | undefined {
  for (const library of libraries) {
    for (const candidate of files.subdirectories(join(library, 'steamapps', 'common'))) {
      if (files.exists(manifestPathFor(candidate, app))) return candidate;
    }
  }
  return undefined;
}

/**
 * Where a first install of a game's copy goes: in the first library's
 * `common/`, where `findInstall` looks next time, under a name no Steam client
 * takes for an application of its own.
 */
export function installDirFor(libraries: readonly string[], game: Game): string {
  return join(libraries[0] ?? DEFAULT_STEAM_ROOT, 'steamapps', 'common', `beacon-${game}`);
}
```

Le commentaire de `discoverSteamAccount` perd ce qui parlait d'une commande à coller : son premier paragraphe devient `The account Steam is most likely logged in as, which steamcmd logs in with unless --steam-account names another.`, et dans le second, `the first account in the file is still returned so the command stays pasteable, but` devient `the first account in the file is still returned, but`.

À la place de `steamcmdCommandFor` :

```ts
export interface SteamcmdTarget {
  readonly installDir: string;
  readonly account: string;
  readonly app: string;
}

/**
 * What steamcmd is launched with, one argument per element: the install
 * folder stays whole whatever spaces it holds. Two properties cost an evening
 * each when they are wrong, and neither is visible in the result:
 *
 * `+force_install_dir` comes **before** `+login` because Steam fixes its
 * install root at login — placed after, the option is not refused, it is
 * ignored, and the download lands in steamcmd's own folder where nothing looks.
 *
 * There is no password here, and there cannot be one: steamcmd asks for it in
 * the operator's terminal, and Steam Guard asks again regardless.
 *
 * No `validate`, which would reread every local file at each update.
 */
export function steamcmdArgumentsFor(target: SteamcmdTarget): readonly string[] {
  return ['+force_install_dir', target.installDir, '+login', target.account, '+app_update', target.app, '+quit'];
}

/**
 * steamcmd.exe in the first folder of the PATH that holds it. The `.exe` and
 * nothing else: it is the one file `spawn` launches without a shell.
 */
export function findSteamcmd(
  pathVariable: string | undefined,
  exists: (path: string) => boolean,
): string | undefined {
  for (const folder of (pathVariable ?? '').split(delimiter)) {
    if (folder === '') continue;
    const candidate = join(folder, 'steamcmd.exe');
    if (exists(candidate)) return candidate;
  }
  return undefined;
}
```

Dans `steam-manifest.ts`, le refus d'un manifeste absent cesse de renvoyer à une commande imprimée :

```ts
    return { refusal: `${path} is missing, so the version of this install cannot be read` };
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx nx test game-depot -- src/lib/steam-install.spec.ts src/lib/copy-application.spec.ts src/lib/steam-manifest.spec.ts`
Expected: PASS. `guided-update.ts` ne compile plus (il importe `findDedicatedServer`) : les étapes suivantes le réécrivent.

- [ ] **Step 5: Write the failing tests of the guided flow**

`tools/game-depot/src/lib/guided-update.spec.ts` est réécrit en entier :

```ts
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ObjectApi } from '@beacon/scaleway-storage';
import type { AdminCredentials } from '@beacon/admin-key';
import { gameVersionFrom, type Game, type GameVersion } from '@beacon/session';
import { gameArchiveKeyFor } from './game-depot.js';
import { inMemoryFiles } from './local-files.spec-helper.js';
import { type GuidedUpdatePorts, runGuidedUpdate } from './guided-update.js';
import type { SteamcmdTarget } from './steam-install.js';

const DEFAULT_STEAM = 'C:\\Program Files (x86)\\Steam';
const SERVER_DIR = join(DEFAULT_STEAM, 'steamapps', 'common', 'Sunkenland Dedicated Server');
const CLIENT_DIR = join(DEFAULT_STEAM, 'steamapps', 'common', 'Sunkenland');
const FIRST_INSTALL_DIR = join(DEFAULT_STEAM, 'steamapps', 'common', 'beacon-sunkenland');
const EXECUTABLE = 'Sunkenland-DedicatedServer.exe';
const APP = '2667530';
const OLD_BUILD = '25746735';
const NEW_BUILD = '25800001';

const ADMIN_SECRET = 'the-admin-secret-nothing-may-ever-print';
const MACHINE_SECRET = 'the-machine-secret-that-cannot-write';

const DUMP_WITH_BOTH_REMOTES = JSON.stringify({
  'scw-machine': {
    endpoint: 'https://s3.fr-par.scw.cloud',
    region: 'fr-par',
    access_key_id: 'MACHINE-ACCESS-KEY',
    secret_access_key: MACHINE_SECRET,
  },
  'scw-admin': {
    endpoint: 'https://s3.fr-par.scw.cloud',
    region: 'fr-par',
    access_key_id: 'ADMIN-ACCESS-KEY',
    secret_access_key: ADMIN_SECRET,
  },
});

const LOGIN_USERS_VDF = `"users"
{
\t"76561190000000002"
\t{
\t\t"AccountName"\t\t"the-one-who-owns-the-game"
\t\t"MostRecent"\t\t"1"
\t}
}
`;

/** The ordinary state of a Steam client signed into more than one account: neither is flagged. */
const LOGIN_USERS_TWO_UNFLAGGED = `"users"
{
\t"76561190000000001"
\t{
\t\t"AccountName"\t\t"an-old-account"
\t}
\t"76561190000000002"
\t{
\t\t"AccountName"\t\t"the-one-who-owns-the-game"
\t}
}
`;

const LOGIN_USERS_ONE_UNFLAGGED = `"users"
{
\t"76561190000000002"
\t{
\t\t"AccountName"\t\t"the-one-who-owns-the-game"
\t}
}
`;

const LOGIN_USERS = join(DEFAULT_STEAM, 'config', 'loginusers.vdf');

const manifestPath = (dir: string): string => join(dir, 'steamapps', `appmanifest_${APP}.acf`);

const manifestOf = (build: string, stateFlags = '4'): string => `"AppState"
{
\t"appid"\t\t"${APP}"
\t"StateFlags"\t\t"${stateFlags}"
\t"buildid"\t\t"${build}"
}
`;

type Tree = Record<string, number | string>;

/** A complete install of the copy, at a build. */
function installAt(dir: string, build: string): Tree {
  return {
    [join(dir, EXECUTABLE)]: 60_000_000,
    [join(dir, 'Sunkenland-DedicatedServer_Data', 'data.pak')]: 2_240_000_000,
    [manifestPath(dir)]: manifestOf(build),
  };
}

/** Steam logged in, the game client installed, and the copy installed at the old build. */
function machine(): Tree {
  return {
    [LOGIN_USERS]: LOGIN_USERS_VDF,
    [join(CLIENT_DIR, 'Sunkenland.exe')]: 8_060_000_000,
    ...installAt(SERVER_DIR, OLD_BUILD),
  };
}

/** The same machine before any install of the copy. */
function machineWithoutTheCopy(): Tree {
  return {
    [LOGIN_USERS]: LOGIN_USERS_VDF,
    [join(CLIENT_DIR, 'Sunkenland.exe')]: 8_060_000_000,
  };
}

type SteamcmdDouble = (target: SteamcmdTarget, tree: Tree) => number | Promise<number>;

/** steamcmd as measured: it brings the folder it is given to the build Steam publishes, and exits 0. */
const updatesTo =
  (build: string): SteamcmdDouble =>
  (target, tree) => {
    Object.assign(tree, installAt(target.installDir, build));
    return 0;
  };

const version = (digits: string): GameVersion => {
  const built = gameVersionFrom(digits);
  if (built === null) throw new Error(`not a version: ${digits}`);
  return built;
};

const RECORD_DESTINATION = 'Firestore of project beacon-test';

interface Harness {
  readonly said: string[];
  readonly asked: string[];
  /** In order: `read the record`, `steamcmd`, `ask`, `push`. */
  readonly events: string[];
  readonly choices: (readonly Game[])[];
  readonly installs: SteamcmdTarget[];
  readonly opened: AdminCredentials[];
  readonly bucket: Map<string, number>;
  readonly recorded: string[];
  readonly ports: GuidedUpdatePorts;
}

function harness(
  options: {
    readonly tree?: Tree;
    readonly configDump?: string;
    readonly requestedGame?: string;
    readonly games?: readonly Game[];
    readonly choice?: Game;
    readonly installDir?: string;
    readonly steamAccount?: string;
    readonly steamcmdPresent?: boolean;
    readonly steamcmd?: SteamcmdDouble;
    readonly canAnswer?: boolean;
    /** The version on record; `null` for none. Defaults to the old build. */
    readonly deposited?: string | null;
    readonly recordUnreachable?: boolean;
    readonly answer?: (question: string) => boolean;
  } = {},
): Harness {
  const tree = options.tree ?? machine();
  const said: string[] = [];
  const asked: string[] = [];
  const events: string[] = [];
  const choices: (readonly Game[])[] = [];
  const installs: SteamcmdTarget[] = [];
  const opened: AdminCredentials[] = [];
  const bucket = new Map<string, number>();
  const recorded: string[] = [];

  const api: ObjectApi = {
    async list(prefix: string) {
      return [...bucket]
        .filter(([key]) => key.startsWith(prefix))
        .map(([key, sizeBytes]) => ({ key, sizeBytes, lastModified: new Date(0) }));
    },
    async put() {
      throw new Error('the guided flow deposits through pushGameFiles, never through put');
    },
    async get() {
      throw new Error('the guided flow downloads nothing');
    },
  };

  return {
    said,
    asked,
    events,
    choices,
    installs,
    opened,
    bucket,
    recorded,
    ports: {
      requestedGame: options.requestedGame,
      games: options.games ?? ['sunkenland'],
      bucketName: 'beacon-games',
      steamRoot: DEFAULT_STEAM,
      recordDestination: RECORD_DESTINATION,
      installDir: options.installDir,
      steamAccount: options.steamAccount,
      files: inMemoryFiles(tree),
      canAnswer: options.canAnswer ?? true,
      steamcmd: {
        present: () => options.steamcmdPresent ?? true,
        install: async (target) => {
          events.push('steamcmd');
          installs.push(target);
          return (options.steamcmd ?? updatesTo(NEW_BUILD))(target, tree);
        },
      },
      record: {
        depositedVersion: async () => {
          events.push('read the record');
          if (options.recordUnreachable === true) throw new Error('PERMISSION_DENIED');
          const deposited = options.deposited === undefined ? OLD_BUILD : options.deposited;
          return deposited === null ? null : version(deposited);
        },
        recordDeposit: async (_game, deposited) => {
          recorded.push(deposited);
        },
      },
      rcloneConfigDump: async () => options.configDump ?? DUMP_WITH_BOTH_REMOTES,
      openBucket: (credentials) => {
        opened.push(credentials);
        return api;
      },
      pushArchive: async ({ game, record, from }) => {
        events.push('push');
        bucket.set(gameArchiveKeyFor(game), 2_480_000_000);
        const build = /"buildid"\s+"(\d+)"/.exec(String(tree[manifestPath(from)]))?.[1];
        if (build === undefined) throw new Error(`no manifest in ${from}`);
        await record.recordDeposit(game, version(build));
        return version(build);
      },
      ask: async (question) => {
        events.push('ask');
        asked.push(question);
        return options.answer?.(question) ?? true;
      },
      choose: async (_question, games) => {
        choices.push(games);
        return options.choice;
      },
      say: (line) => said.push(line),
    },
  };
}

const printed = (flow: Harness): string => flow.said.join('\n');
const lineIndex = (flow: Harness, pattern: RegExp): number => flow.said.findIndex((line) => pattern.test(line));

describe('the download, by steamcmd', () => {
  it('has steamcmd bring the install to the published build, then deposits it', async () => {
    const flow = harness();

    expect(await runGuidedUpdate(flow.ports)).toBe('deposited');
    expect(flow.installs).toEqual([{ installDir: SERVER_DIR, account: 'the-one-who-owns-the-game', app: APP }]);
    expect(flow.recorded).toEqual([NEW_BUILD]);
    expect(flow.events).toEqual(['read the record', 'steamcmd', 'ask', 'push']);
  });

  it('deposits nothing when steamcmd exits on a code other than 0', async () => {
    const flow = harness({ steamcmd: () => 5 });

    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(printed(flow)).toMatch(/code 5/);
    expect(flow.asked).toEqual([]);
    expect(flow.bucket.size).toBe(0);
    expect(flow.recorded).toEqual([]);
  });

  it('deposits nothing when steamcmd ends without an exit code', async () => {
    const flow = harness({ steamcmd: () => Promise.reject(new Error('spawn EACCES')) });

    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(printed(flow)).toContain('spawn EACCES');
    expect(flow.bucket.size).toBe(0);
  });

  it('stops before reading the record or downloading when steamcmd is not on the PATH', async () => {
    const flow = harness({ steamcmdPresent: false });

    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(printed(flow)).toContain('PATH');
    expect(flow.events).toEqual([]);
  });

  // steamcmd asks for a password and a Steam Guard code: launched with nobody
  // to answer, it would wait for ever, or fail in a way that says nothing.
  it('launches nothing without a terminal to answer in', async () => {
    const flow = harness({ canAnswer: false });

    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(printed(flow)).toMatch(/terminal/i);
    expect(flow.events).toEqual([]);
  });

  it('says steamcmd may ask for the password, and hands it none', async () => {
    const flow = harness();
    await runGuidedUpdate(flow.ports);

    expect(lineIndex(flow, /password/i)).toBeGreaterThan(-1);
    expect(lineIndex(flow, /password/i)).toBeLessThan(lineIndex(flow, /steamcmd exited with code 0/));
    expect(Object.keys(flow.installs[0] ?? {})).toEqual(['installDir', 'account', 'app']);
  });

  it('refuses an install steamcmd left incomplete, without asking', async () => {
    const flow = harness({
      steamcmd: (target, tree) => {
        tree[manifestPath(target.installDir)] = manifestOf(NEW_BUILD, '1026');
        return 0;
      },
    });

    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(printed(flow)).toMatch(/not complete/);
    expect(flow.asked).toEqual([]);
  });
});

describe('the game', () => {
  it('announces the only game whose copy is deposited, without asking', async () => {
    const flow = harness();
    await runGuidedUpdate(flow.ports);

    expect(flow.choices).toEqual([]);
    expect(lineIndex(flow, /sunkenland/)).toBeGreaterThan(lineIndex(flow, /^4\./));
  });

  // The catalogue holds one game with a copy: only the choice is played here.
  it('asks which game when several have a copy, and names it once chosen', async () => {
    const flow = harness({ games: ['sunkenland', 'enshrouded'], choice: 'sunkenland' });

    expect(await runGuidedUpdate(flow.ports)).toBe('deposited');
    expect(flow.choices).toEqual([['sunkenland', 'enshrouded']]);
    expect(lineIndex(flow, /sunkenland/)).toBeGreaterThan(lineIndex(flow, /^4\./));
  });

  it('stops before steamcmd when the answer names no game', async () => {
    const flow = harness({ games: ['sunkenland', 'enshrouded'], choice: undefined });

    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(flow.installs).toEqual([]);
  });

  it('takes the game --game names, without asking', async () => {
    const flow = harness({ games: ['sunkenland', 'enshrouded'], requestedGame: 'sunkenland' });

    expect(await runGuidedUpdate(flow.ports)).toBe('deposited');
    expect(flow.choices).toEqual([]);
  });

  it('refuses a --game that goes through no copy, saying why', async () => {
    const flow = harness({ requestedGame: 'enshrouded' });

    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(printed(flow)).toMatch(/enshrouded goes through no copy/);
    expect(flow.events).toEqual([]);
  });

  it('refuses a --game that names no game', async () => {
    const flow = harness({ requestedGame: 'tetris' });

    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(printed(flow)).toContain('tetris');
    expect(flow.events).toEqual([]);
  });
});

describe('the install folder', () => {
  // The old recogniser took any folder holding the server's file name. The
  // manifest steamcmd writes inside the folder is what names the application.
  it('finds the install by its manifest, and never takes the client next to it', async () => {
    const flow = harness({
      tree: {
        [LOGIN_USERS]: LOGIN_USERS_VDF,
        [join(CLIENT_DIR, EXECUTABLE)]: 1_000,
        [join(CLIENT_DIR, 'Sunkenland.exe')]: 8_060_000_000,
        ...installAt(SERVER_DIR, OLD_BUILD),
      },
    });
    await runGuidedUpdate(flow.ports);

    expect(flow.installs[0]?.installDir).toBe(SERVER_DIR);
  });

  it('installs into a folder of its own when no install exists, then deposits it', async () => {
    const flow = harness({ tree: machineWithoutTheCopy(), deposited: null });

    expect(await runGuidedUpdate(flow.ports)).toBe('deposited');
    expect(flow.installs[0]?.installDir).toBe(FIRST_INSTALL_DIR);
    expect(flow.recorded).toEqual([NEW_BUILD]);
  });

  it('installs into the folder --from names', async () => {
    const elsewhere = 'D:\\elsewhere';
    const flow = harness({ tree: machineWithoutTheCopy(), installDir: elsewhere });

    expect(await runGuidedUpdate(flow.ports)).toBe('deposited');
    expect(flow.installs[0]?.installDir).toBe(elsewhere);
  });

  it('refuses a folder without the executable the catalogue names, without asking', async () => {
    const flow = harness({
      tree: machineWithoutTheCopy(),
      steamcmd: (target, tree) => {
        tree[manifestPath(target.installDir)] = manifestOf(NEW_BUILD);
        return 0;
      },
    });

    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(printed(flow)).toContain(EXECUTABLE);
    expect(flow.asked).toEqual([]);
    expect(flow.bucket.size).toBe(0);
  });

  it('names the folder, its weight and its file count before asking', async () => {
    const flow = harness();
    await runGuidedUpdate(flow.ports);

    const beforeTheQuestion = flow.said.slice(0, lineIndex(flow, /^8\./)).join('\n');
    expect(beforeTheQuestion).toContain(SERVER_DIR);
    expect(beforeTheQuestion).toContain('3 files');
    expect(beforeTheQuestion).toMatch(/2\.\d\d GB/);
  });
});

describe('the Steam account', () => {
  it('stops before steamcmd when no account is found and none is named', async () => {
    const tree = machine();
    delete tree[LOGIN_USERS];
    const flow = harness({ tree });

    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(printed(flow)).toContain('--steam-account=');
    expect(flow.installs).toEqual([]);
  });

  it('takes the account --steam-account names, without judging it', async () => {
    const flow = harness({ steamAccount: 'someone-else' });
    await runGuidedUpdate(flow.ports);

    expect(flow.installs[0]?.account).toBe('someone-else');
    expect(printed(flow)).not.toMatch(/flagged|guess|likely/);
  });

  it('says the account it takes before steamcmd runs', async () => {
    const flow = harness();
    await runGuidedUpdate(flow.ports);

    expect(lineIndex(flow, /the-one-who-owns-the-game/)).toBeGreaterThan(-1);
    expect(lineIndex(flow, /the-one-who-owns-the-game/)).toBeLessThan(lineIndex(flow, /^6\./));
  });

  it('says a flagged account is the one the Steam client flagged, not a guess', async () => {
    const flow = harness();
    await runGuidedUpdate(flow.ports);

    expect(printed(flow)).toMatch(/the one the Steam client itself flagged/);
    expect(printed(flow)).not.toMatch(/guess/);
    expect(printed(flow)).toContain('--steam-account=');
  });

  it('says it took the first of several accounts, only because none is flagged', async () => {
    const flow = harness({ tree: { ...machine(), [LOGIN_USERS]: LOGIN_USERS_TWO_UNFLAGGED } });
    await runGuidedUpdate(flow.ports);

    expect(printed(flow)).toMatch(/is a guess: 2 accounts are in the/);
    expect(printed(flow)).toMatch(/none flagged as logged in/);
    expect(flow.installs[0]?.account).toBe('an-old-account');
  });

  it('says the only account in the client is likely right', async () => {
    const flow = harness({ tree: { ...machine(), [LOGIN_USERS]: LOGIN_USERS_ONE_UNFLAGGED } });
    await runGuidedUpdate(flow.ports);

    expect(printed(flow)).toMatch(/the only one in the Steam client/);
  });
});

describe('the version of the copy', () => {
  it('stops before the download when the record cannot be reached', async () => {
    const flow = harness({ recordUnreachable: true });

    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(printed(flow)).toMatch(/record of the copy cannot be reached/);
    expect(flow.installs).toEqual([]);
  });

  it('says what the record holds, and where', async () => {
    const flow = harness();
    await runGuidedUpdate(flow.ports);

    expect(printed(flow)).toContain(`the record of the copy answers, in ${RECORD_DESTINATION}: build ${OLD_BUILD} deposited`);
  });

  it('says no copy is deposited yet when the record holds none', async () => {
    const flow = harness({ deposited: null });
    await runGuidedUpdate(flow.ports);

    expect(printed(flow)).toContain('no copy deposited yet');
  });

  it('says the installed build is already the deposited copy, and deposits nothing on a no', async () => {
    const flow = harness({ steamcmd: updatesTo(OLD_BUILD), answer: () => false });

    expect(await runGuidedUpdate(flow.ports)).toBe('declined');
    expect(printed(flow)).toContain(`build ${OLD_BUILD} is already the deposited copy of sunkenland`);
    expect(flow.asked).toEqual([`deposit build ${OLD_BUILD} again anyway?`]);
    expect(flow.bucket.size).toBe(0);
    expect(flow.recorded).toEqual([]);
  });

  it('deposits the same build again on a yes', async () => {
    const flow = harness({ steamcmd: updatesTo(OLD_BUILD) });

    expect(await runGuidedUpdate(flow.ports)).toBe('deposited');
    expect(flow.recorded).toEqual([OLD_BUILD]);
  });

  it('asks the usual question when the build is new', async () => {
    const flow = harness();
    await runGuidedUpdate(flow.ports);

    expect(flow.asked).toEqual(['build the archive and deposit it as sunkenland/game.tar in beacon-games?']);
  });

  it('says the build it is about to deposit, before asking', async () => {
    const flow = harness();
    await runGuidedUpdate(flow.ports);

    expect(flow.said.slice(0, lineIndex(flow, /^8\./)).join('\n')).toContain(`build ${NEW_BUILD}`);
  });

  it('announces the version it recorded, and where', async () => {
    const flow = harness();
    expect(await runGuidedUpdate(flow.ports)).toBe('deposited');

    expect(printed(flow)).toContain(`build ${NEW_BUILD} recorded as the copy of sunkenland, in ${RECORD_DESTINATION}`);
  });
});

describe('the deposit', () => {
  it('reads back what the bucket then holds, and announces it', async () => {
    const flow = harness();
    expect(await runGuidedUpdate(flow.ports)).toBe('deposited');

    expect(printed(flow)).toContain('sunkenland/game.tar in beacon-games, 2.31 GB');
  });

  // The machine's key can only read this bucket. Taking it would fail at the
  // end of a multi-gigabyte upload rather than before it starts.
  it('opens the bucket with the administrator key, never the machine one', async () => {
    const flow = harness();
    await runGuidedUpdate(flow.ports);

    expect(flow.opened.map((credentials) => credentials.accessKeyId)).toEqual(['ADMIN-ACCESS-KEY']);
  });

  // Told apart from a refusal on purpose: an operator who answers no has been
  // served, and a task runner that paints that red teaches him to ignore red.
  it('deposits nothing when the operator declines, and calls that neither a failure nor a deposit', async () => {
    const flow = harness({ answer: () => false });

    expect(await runGuidedUpdate(flow.ports)).toBe('declined');
    expect(flow.bucket.size).toBe(0);
    expect(flow.recorded).toEqual([]);
  });

  it('says what it deliberately left alone', async () => {
    const flow = harness();
    await runGuidedUpdate(flow.ports);

    expect(printed(flow)).toMatch(/nothing was deleted/i);
  });
});

describe('the credentials', () => {
  it('names the missing remote and stops before anything else', async () => {
    const flow = harness({ configDump: JSON.stringify({ 'scw-machine': {} }) });

    expect(await runGuidedUpdate(flow.ports)).toBe('refused');
    expect(printed(flow)).toContain('scw-admin');
    expect(flow.events).toEqual([]);
  });

  // The flow reads a secret out of rclone on every run, in a terminal whose
  // scrollback is shared in a chat the day something goes wrong.
  it('lets no part of a credential reach the output', async () => {
    const flow = harness();
    await runGuidedUpdate(flow.ports);
    const everything = [...flow.said, ...flow.asked].join('\n');

    expect(everything).not.toContain(ADMIN_SECRET);
    expect(everything).not.toContain(MACHINE_SECRET);
    expect(everything).not.toContain('ADMIN-ACCESS-KEY');
    expect(everything).not.toContain('MACHINE-ACCESS-KEY');
    expect(flow.opened[0]?.secretAccessKey).toBe(ADMIN_SECRET);
  });
});
```

- [ ] **Step 6: Run them to verify they fail**

Run: `npx nx test game-depot -- src/lib/guided-update.spec.ts`
Expected: FAIL — `guided-update.ts` importe encore `findDedicatedServer`, et ses ports n'ont ni `steamcmd`, ni `games`, ni `choose`.

- [ ] **Step 7: Rewrite the guided flow**

`tools/game-depot/src/lib/guided-update.ts` est réécrit en entier :

```ts
import { isGame, type Game, type GameVersion } from '@beacon/session';
import type { GameCopyRecord } from '@beacon/session-record';
import type { ObjectApi } from '@beacon/scaleway-storage';
import { ADMIN_REMOTE, type AdminCredentials, adminCredentialsFrom, describeRemote } from '@beacon/admin-key';
import { type PushGameFilesDeps, gameArchiveKeyFor } from './game-depot.js';
import { type CopyApplication, copyApplicationOf } from './copy-application.js';
import {
  type DiscoveredSteamAccount,
  type LocalFiles,
  type SteamcmdTarget,
  discoverSteamAccount,
  findInstall,
  installDirFor,
  steamLibraries,
} from './steam-install.js';
import { installedCopy } from './steam-manifest.js';

/**
 * Three states rather than two, because the caller turns them into an exit
 * code and only one of them is a fault. Taking the operator's `no` is this
 * command doing its job — painting it red is how a task runner teaches him to
 * ignore red.
 */
export type GuidedUpdateOutcome =
  /** The archive is in the bucket, was read back, and its version is recorded. */
  | 'deposited'
  /** The operator was asked and answered no. */
  | 'declined'
  /** Something is wrong, and nothing was deposited. */
  | 'refused';

/** steamcmd, as this flow uses it. */
export interface Steamcmd {
  /** Whether it is on this machine. Looks without launching: a launch updates steamcmd itself. */
  present(): boolean;
  /** Runs it in the operator's terminal and resolves with its exit code. Rejects when it ends without one. */
  install(target: SteamcmdTarget): Promise<number>;
}

export interface GuidedUpdatePorts {
  /** What `--game` names, if anything. */
  readonly requestedGame?: string;
  /** The games whose copy this tool deposits. */
  readonly games: readonly Game[];
  readonly bucketName: string;
  readonly steamRoot: string;
  /** Where the version is recorded, worded for the operator. */
  readonly recordDestination: string;
  /** An install folder named on the command line, which skips the search. */
  readonly installDir?: string;
  /** Overrides what `loginusers.vdf` says, on a machine with several accounts. */
  readonly steamAccount?: string;
  readonly files: LocalFiles;
  readonly record: GameCopyRecord;
  readonly steamcmd: Steamcmd;
  /** Whether someone can answer at a keyboard: steamcmd asks for a password and a Steam Guard code. */
  readonly canAnswer: boolean;
  readonly rcloneConfigDump: () => Promise<string>;
  readonly openBucket: (credentials: AdminCredentials) => ObjectApi;
  /** `pushGameFiles` itself. A port only so a test does not need gigabytes on disk. */
  readonly pushArchive: (deps: PushGameFilesDeps) => Promise<GameVersion>;
  /** A yes or no, no by default. */
  readonly ask: (question: string) => Promise<boolean>;
  /** The game the operator picks, or undefined for an answer that names none. */
  readonly choose: (question: string, games: readonly Game[]) => Promise<Game | undefined>;
  readonly say: (line: string) => void;
}

/** A refusal: its lines are said under `STOP`, and nothing is deposited. */
class Stop extends Error {
  constructor(readonly lines: readonly string[]) {
    super(lines.join(' '));
  }
}

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function gigabytes(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/**
 * The gesture an administrator repeats at every game update, guided from end
 * to end. It has steamcmd bring the install on this machine to the build the
 * publisher publishes, with the operator's own Steam account, because only a
 * machine owning the game may download it; then it deposits that install,
 * reads it back and records its version.
 *
 * It has no verb that removes, here or anywhere below. The objects of the older
 * file-by-file deposit outlive every run: dropping them is the administrator's
 * call, and these files under licence can only be deposited again from a
 * machine that owns the game.
 */
export async function runGuidedUpdate(ports: GuidedUpdatePorts): Promise<GuidedUpdateOutcome> {
  try {
    return await guide(ports);
  } catch (error) {
    if (!(error instanceof Stop)) throw error;
    const [first, ...rest] = error.lines;
    ports.say(`  STOP  ${first}`);
    for (const line of rest) ports.say(`        ${line}`);
    return 'refused';
  }
}

async function guide(ports: GuidedUpdatePorts): Promise<GuidedUpdateOutcome> {
  const { say } = ports;
  say(`beacon: game files, from this machine into ${ports.bucketName}`);

  say('');
  say('1. The administrator key, never the machine one');
  const credentials = await adminKey(ports);

  say('');
  say('2. steamcmd, which downloads the game with your Steam account');
  if (!ports.steamcmd.present()) {
    throw new Stop(['steamcmd.exe is not on the PATH.', 'Install steamcmd, put its folder on the PATH, then run this again.']);
  }
  say('  ok    steamcmd.exe is on the PATH');

  say('');
  say('3. A terminal to answer in');
  if (!ports.canAnswer) {
    throw new Stop([
      'no terminal to answer in: steamcmd would ask for a password and a Steam Guard',
      'code nobody could type. Run this from a terminal.',
    ]);
  }
  say('  ok    steamcmd and this command ask their questions here');

  say('');
  say('4. The game');
  const game = await gameToDeposit(ports);
  const copy = copyApplicationOf(game);

  say('');
  say(`5. Where ${game} is installed, and with which Steam account`);
  const libraries = steamLibraries(ports.files, ports.steamRoot);
  say(`  ok    ${libraries.length} Steam ${libraries.length === 1 ? 'library' : 'libraries'}: ${libraries.join(', ')}`);
  const target: SteamcmdTarget = {
    installDir: chooseInstallDir(ports, libraries, game, copy.steamApp),
    account: steamAccount(ports),
    app: copy.steamApp,
  };
  const deposited = await depositedVersion(ports, game);

  say('');
  say('6. The download, by steamcmd');
  await download(ports, target);

  say('');
  say('7. What is about to be deposited');
  const installed = inspect(ports, target.installDir, copy);

  say('');
  say('8. The deposit');
  if (!(await operatorAgrees(ports, game, installed, deposited))) {
    say('  !     nothing deposited');
    return 'declined';
  }
  await deposit(ports, credentials, game, target.installDir);

  say('');
  say('9. What this command did not do');
  say('  !     nothing was deleted. The objects of the older file-by-file deposit are');
  say('        where they were: dropping them is your call, and only once a real session');
  say('        has booted on this archive. These files are under licence, and only a');
  say('        machine that owns the game can ever deposit them again.');
  return 'deposited';
}

async function adminKey(ports: GuidedUpdatePorts): Promise<AdminCredentials> {
  let credentials: AdminCredentials;
  try {
    credentials = adminCredentialsFrom(await ports.rcloneConfigDump(), ADMIN_REMOTE);
  } catch (error) {
    throw new Stop([reasonOf(error), `rclone config show ${ADMIN_REMOTE}   says whether it exists at all.`]);
  }
  ports.say(`  ok    ${describeRemote(ADMIN_REMOTE, credentials)}`);
  ports.say('  ok    no credential value is printed by this command, here or below');
  return credentials;
}

async function gameToDeposit(ports: GuidedUpdatePorts): Promise<Game> {
  const { requestedGame, games, say } = ports;
  if (requestedGame !== undefined) {
    if (!isGame(requestedGame)) throw new Stop([`--game names no game: "${requestedGame}".`]);
    if (!games.includes(requestedGame)) {
      throw new Stop([`${requestedGame} goes through no copy: nothing of it is deposited here.`]);
    }
    say(`  ok    ${requestedGame}, as --game says`);
    return requestedGame;
  }
  if (games.length === 1) {
    say(`  ok    ${games[0]}, the only game whose copy is deposited here`);
    return games[0];
  }
  const chosen = await ports.choose('which game?', games);
  if (chosen === undefined) throw new Stop(['that answer names none of the games above.']);
  say(`  ok    ${chosen}`);
  return chosen;
}

function chooseInstallDir(ports: GuidedUpdatePorts, libraries: readonly string[], game: Game, app: string): string {
  if (ports.installDir !== undefined) {
    ports.say(`  ok    ${ports.installDir}, as --from says`);
    return ports.installDir;
  }
  const found = findInstall(ports.files, libraries, app);
  if (found !== undefined) {
    ports.say(`  ok    ${found}, found by its manifest`);
    return found;
  }
  const first = installDirFor(libraries, game);
  ports.say(`  ok    no install yet: steamcmd will install into ${first}`);
  return first;
}

function steamAccount(ports: GuidedUpdatePorts): string {
  if (ports.steamAccount !== undefined) {
    ports.say(`  ok    Steam account ${ports.steamAccount}, as --steam-account says`);
    return ports.steamAccount;
  }
  const discovered = discoverSteamAccount(ports.files, ports.steamRoot);
  if (discovered === undefined) {
    throw new Stop([
      'no account was found in the Steam client on this machine.',
      'Pass --steam-account=<name> to say which one owns the game.',
    ]);
  }
  sayAccountConfidence(ports.say, discovered);
  return discovered.name;
}

/**
 * Says exactly what the pick is worth, and nothing more than that: a flagged
 * account is a real answer from the Steam client, not a coin flip, and saying
 * "it is a guess" about it would be as false as staying silent about a real
 * coin flip between two unflagged accounts — the ordinary state of a client
 * signed into more than one account over the years.
 */
function sayAccountConfidence(say: (line: string) => void, discovered: DiscoveredSteamAccount): void {
  if (discovered.flagged) {
    say(`  ok    Steam account ${discovered.name}, the one the Steam client itself flagged as`);
    say('        logged in. Pass --steam-account=<name> if this machine owns the game under');
    say('        another account.');
  } else if (discovered.accountCount > 1) {
    say(`  !     Steam account ${discovered.name} is a guess: ${discovered.accountCount} accounts are in the`);
    say('        Steam client, none flagged as logged in, so the first one found was taken.');
    say('        Pass --steam-account=<name> to say which one owns the game.');
  } else {
    say(`  ok    Steam account ${discovered.name}, the only one in the Steam client on this`);
    say('        machine, so it is likely right. Pass --steam-account=<name> if it owns the');
    say('        game under another.');
  }
}

/** Read before the download: an unreachable record would otherwise be learnt after gigabytes. */
async function depositedVersion(ports: GuidedUpdatePorts, game: Game): Promise<GameVersion | null> {
  let deposited: GameVersion | null;
  try {
    deposited = await ports.record.depositedVersion(game);
  } catch (error) {
    throw new Stop([
      `the record of the copy cannot be reached: ${reasonOf(error)}`,
      'BEACON_FIREBASE_PROJECT names the project, and gcloud auth application-default login the identity.',
    ]);
  }
  const holds = deposited === null ? 'no copy deposited yet' : `build ${deposited} deposited`;
  ports.say(`  ok    the record of the copy answers, in ${ports.recordDestination}: ${holds}`);
  return deposited;
}

async function download(ports: GuidedUpdatePorts, target: SteamcmdTarget): Promise<void> {
  const { say } = ports;
  say(`  !     steamcmd runs below, in this terminal. It may ask for the password of`);
  say(`        ${target.account} and for a Steam Guard code: they go to steamcmd, never to this command.`);
  say('');
  let exitCode: number;
  try {
    exitCode = await ports.steamcmd.install(target);
  } catch (error) {
    throw new Stop([`steamcmd did not run to the end: ${reasonOf(error)}.`, 'Nothing deposited.']);
  }
  say('');
  if (exitCode !== 0) throw new Stop([`steamcmd exited with code ${exitCode}.`, 'Nothing deposited.']);
  say('  ok    steamcmd exited with code 0');
}

/** The build steamcmd left in the folder, once the folder is an install of the copy. */
function inspect(ports: GuidedUpdatePorts, installDir: string, copy: CopyApplication): GameVersion {
  const installed = installedCopy(ports.files, installDir, copy);
  if ('refusal' in installed) throw new Stop([`${installed.refusal}.`, 'Nothing deposited.']);
  const measure = ports.files.measure(installDir);
  ports.say(`  ok    ${installDir}`);
  ports.say(
    `  ok    ${gigabytes(measure.sizeBytes)}, ${measure.fileCount} files, ${copy.executable} present, build ${installed.version}`,
  );
  return installed.version;
}

/**
 * The one question before the upload, no by default. A build that is already
 * the deposited copy is said, and asked about on its own terms: depositing it
 * again buys nothing but the upload.
 */
async function operatorAgrees(
  ports: GuidedUpdatePorts,
  game: Game,
  installed: GameVersion,
  deposited: GameVersion | null,
): Promise<boolean> {
  if (installed === deposited) {
    ports.say(`  !     build ${installed} is already the deposited copy of ${game}.`);
    return ports.ask(`deposit build ${installed} again anyway?`);
  }
  return ports.ask(`build the archive and deposit it as ${gameArchiveKeyFor(game)} in ${ports.bucketName}?`);
}

async function deposit(ports: GuidedUpdatePorts, credentials: AdminCredentials, game: Game, from: string): Promise<void> {
  const key = gameArchiveKeyFor(game);
  const bucket = ports.openBucket(credentials);
  const version = await ports.pushArchive({ api: bucket, record: ports.record, game, from });

  // Read back rather than trust. `pushGameFiles` already compares the size it
  // deposited; this second look is what the operator gets to see, and it costs
  // a `list` — never a second `get` over gigabytes.
  const inBucket = (await bucket.list(key)).find((summary) => summary.key === key);
  if (inBucket === undefined) {
    throw new Error(`${key} is not in ${ports.bucketName} after a push that claimed success`);
  }
  ports.say(`  ok    ${key} in ${ports.bucketName}, ${gigabytes(inBucket.sizeBytes)}`);
  ports.say(`  ok    build ${version} recorded as the copy of ${game}, in ${ports.recordDestination}`);
}
```

Dans `game-depot.ts`, `SERVER_BINARY` et son commentaire disparaissent ; dans `game-depot.spec.ts`, le describe `the server binary` et `SERVER_BINARY` dans l'import disparaissent. Le commentaire de `pushGameFiles` parle de `2.3 GB` : il devient `downloading the archive back would double the price of every push to catch a fault a \`ListObjectsV2\` already reports.`

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx nx test game-depot`
Expected: PASS.

- [ ] **Step 9: Rewrite `update.ts`, the README and STACK.md**

`tools/game-depot/src/update.ts` est réécrit en entier :

```ts
import { type ExecSyncOptionsWithStringEncoding, execSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { S3Client } from '@aws-sdk/client-s3';
import { adminFirestore } from '@beacon/admin-firestore';
import { fromS3 } from '@beacon/scaleway-storage';
import { gameCopyRecord } from '@beacon/session-record';
import type { Game } from '@beacon/session';
import { gamesWithACopy } from './lib/copy-application.js';
import { pushGameFiles } from './lib/game-depot.js';
import { type Steamcmd, runGuidedUpdate } from './lib/guided-update.js';
import { recordDestinationFrom } from './lib/record-destination.js';
import { DEFAULT_STEAM_ROOT, type LocalFiles, findSteamcmd, steamcmdArgumentsFor } from './lib/steam-install.js';

function argValue(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

const onDisk: LocalFiles = {
  // …inchangé…
};

/**
 * …le commentaire de rcloneConfigDump inchangé…
 */
function rcloneConfigDump(): string {
  // …inchangé…
}

/**
 * steamcmd.exe as found on the PATH, and launched as that very file in the
 * operator's terminal. `spawn` runs an `.exe` without a shell, so the install
 * folder reaches steamcmd as one argument whatever spaces it holds.
 */
function steamcmdOnThisMachine(): Steamcmd {
  const path = findSteamcmd(process.env['PATH'], existsSync);
  return {
    present: () => path !== undefined,
    install: (target) =>
      new Promise((resolve, reject) => {
        if (path === undefined) {
          reject(new Error('steamcmd.exe is not on the PATH'));
          return;
        }
        const child = spawn(path, [...steamcmdArgumentsFor(target)], { stdio: 'inherit' });
        child.on('error', reject);
        child.on('exit', (code, signal) =>
          code === null ? reject(new Error(`steamcmd ended on ${signal}`)) : resolve(code),
        );
      }),
  };
}

async function ask(question: string): Promise<boolean> {
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await terminal.question(`  ?     ${question} [y/N] `);
    return ['y', 'yes', 'o', 'oui'].includes(answer.trim().toLowerCase());
  } finally {
    terminal.close();
  }
}

async function choose(question: string, games: readonly Game[]): Promise<Game | undefined> {
  games.forEach((game, index) => console.log(`        ${index + 1}. ${game}`));
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = await terminal.question(`  ?     ${question} [1-${games.length}] `);
    return games[Number(answer.trim()) - 1];
  } finally {
    terminal.close();
  }
}

/**
 * The gesture repeated at every game update, guided from end to end: it finds
 * the key, has steamcmd bring the install to the build the publisher
 * publishes, shows what it is about to send, deposits it, reads it back and
 * records its version. Runs on a machine that owns the game — never a runner,
 * never the VM, which only reads this bucket.
 *
 * `push` stays next door for the scripted case: same deposit, no download, no
 * questions.
 */
try {
  const bucketName = process.env['BEACON_GAMES_BUCKET'] ?? 'beacon-games';

  const outcome = await runGuidedUpdate({
    requestedGame: argValue('game'),
    games: gamesWithACopy(),
    bucketName,
    steamRoot: argValue('steam-root') ?? DEFAULT_STEAM_ROOT,
    recordDestination: recordDestinationFrom(process.env),
    installDir: argValue('from'),
    steamAccount: argValue('steam-account'),
    files: onDisk,
    record: gameCopyRecord(adminFirestore(process.env)),
    steamcmd: steamcmdOnThisMachine(),
    canAnswer: process.stdin.isTTY === true,
    rcloneConfigDump: async () => rcloneConfigDump(),
    openBucket: (credentials) =>
      fromS3(
        new S3Client({
          endpoint: credentials.endpoint,
          region: credentials.region,
          credentials: { accessKeyId: credentials.accessKeyId, secretAccessKey: credentials.secretAccessKey },
          // Scaleway serves the bucket as a subdomain of the endpoint, which is
          // the path style the sdk defaults away from (mirrors push.ts).
          forcePathStyle: false,
        }),
        bucketName,
      ),
    pushArchive: pushGameFiles,
    ask,
    choose,
    say: (line) => console.log(line),
  });

  // Only a fault is red. Taking a `no` is this command doing its job, and a
  // task runner that reports it as a failed target teaches its operator to
  // read past failed targets.
  if (outcome === 'refused') process.exitCode = 1;
} catch (error) {
  console.error(`beacon: ${String(error)}`);
  process.exitCode = 1;
}
```

Les parties marquées `…inchangé…` gardent exactement le code et les commentaires actuels.

Dans `tools/game-depot/README.md`, la section `game-depot:update` devient :

```markdown
## `game-depot:update` — le geste de chaque mise à jour

```bash
BEACON_FIREBASE_PROJECT=<projet> npx nx run game-depot:update
```

Guidé de bout en bout : il lit la clé d'administration dans le remote rclone
`scw-admin` (aucune valeur n'est jamais affichée), propose les jeux du catalogue
qui passent par une copie, trouve leur installation par son manifeste dans
**toutes** les bibliothèques Steam, puis lance `steamcmd` pour l'amener à la
version que l'éditeur publie. Il dépose ensuite l'installation, la relit, et
enregistre dans Firestore la version de ce qu'il a déposé.

`steamcmd` doit être dans le `PATH`, sous le nom `steamcmd.exe`, et l'outil doit
tourner dans un terminal : `steamcmd` y demande le mot de passe du compte Steam
et le code Steam Guard. Sans installation trouvée, il installe dans
`steamapps/common/beacon-<jeu>` de la première bibliothèque. Un code de sortie
de `steamcmd` autre que `0` arrête tout, sans rien déposer.

La version est le `buildid` du manifeste que `steamcmd` écrit dans
l'installation, `steamapps/appmanifest_<application>.acf`. L'outil refuse une
installation sans manifeste, que son manifeste dit incomplète, ou qui ne porte
pas l'exécutable que le catalogue donne au jeu, et refuse de déposer quand
l'enregistrement ne répond pas. Quand la version installée est déjà celle de la
copie enregistrée, il le dit et demande s'il dépose quand même.
`BEACON_FIREBASE_PROJECT` n'a aucune valeur par défaut, et l'identité est celle
que `gcloud auth application-default login` a laissée sur le poste.

Options, toutes facultatives : `--game=<jeu>` pour ne pas avoir à choisir,
`--from=<dossier>` pour désigner l'installation à la main,
`--steam-account=<nom>` quand la machine porte plusieurs comptes Steam,
`--steam-root=<dossier>` si Steam n'est pas à son emplacement habituel.
```

(sans la fence extérieure : le bloc ci-dessus remplace le texte du README entre le titre `## \`game-depot:update\`` et `## \`game-depot:push\``). La section `game-depot:push` gagne, après sa première phrase : `Il ne lance pas \`steamcmd\` : le dossier doit déjà porter une installation complète.`

Dans `STACK.md`, section `Outillage`, après le paragraphe sur `rclone` et le CLI Scaleway :

```markdown
**`steamcmd`** amène l'installation locale d'un jeu à la version que son
éditeur publie, avant que `tools/game-depot` la dépose. Il n'est pas pin : il
se met à jour lui-même à son lancement. L'outil le cherche dans le `PATH`, sous
le nom `steamcmd.exe`.
```

- [ ] **Step 10: Run every check of the touched projects**

Run: `npx nx run-many -t test,typecheck,lint -p game-depot,cloud-init,session-record`
Expected: PASS. `update` lui-même ne se lance pas : il lit la clé d'administration réelle du poste (Task 5).

- [ ] **Step 11: Commit**

```bash
git add tools/game-depot STACK.md
bash ~/.config/github-app/as-agent.sh git commit -m "feat(game-depot): amène l'installation à la version publiée par steamcmd avant de la déposer

Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 5: L'essai du port `steamcmd` réel, par un humain

Le lot ne fait éprouver par aucun test la recherche de `steamcmd.exe` dans le `PATH` ni son lancement par `spawn` sur un dossier à espaces. Cet essai télécharge avec le compte Steam de l'exploitant et peut déposer en production : il revient au commanditaire, et la pull request le demande.

- [ ] **Step 1: Write the command into the pull request body**

Le corps de la pull request porte, sous une section `Essai à la main` :

```bash
BEACON_FIREBASE_PROJECT=<projet> npx nx run game-depot:update
```

et ce qu'on attend de lui : `steamcmd` trouvé dans le `PATH`, l'installation actuelle trouvée par son manifeste dans `Sunkenland Dedicated Server`, le compte annoncé, `steamcmd` qui demande mot de passe et Steam Guard dans le terminal, un code de sortie `0`, puis soit la question « déposer quand même ? » si la version n'a pas bougé, soit la question du dépôt. Répondre non suffit à éprouver le port.

## Rulings log

Ruling: le `const GAMES` local de `catalog.spec.ts` disparaît au profit du `GAMES` de `@beacon/session` — le plan importe celui-ci, et le local collisionne avec lui — si c'est faux, rien : les deux listes portent les deux mêmes jeux.

Ruling: le commentaire du describe `the Steam account` de `steam-install.spec.ts`, que le plan gardait tel quel, dit désormais ce que le test épingle — il disait qu'une commande est imprimée, ce qui n'est plus vrai — si c'est faux, une ligne de commentaire de test change sans nécessité.

Ruling: `findSteamcmd` retire la paire de guillemets qui entoure une entrée du `PATH` — Windows les admet, et une entrée citée ferait dire à l'outil que `steamcmd` manque — si c'est faux, deux lignes et un test de trop.

Ruling: `update` résout `--from` en chemin absolu avant de le donner à `steamcmd` — ce que `steamcmd` fait d'un `+force_install_dir` relatif n'est pas mesuré, et un téléchargement ailleurs ne se découvrirait qu'au refus qui le suit — si c'est faux, une ligne de trop.

Ruling: une réponse au choix du jeu qui ne désigne aucun jeu arrête l'outil avant `steamcmd`, sans reposer la question — le design ne dit rien de ce cas, inatteignable tant qu'un seul jeu passe par une copie — si c'est faux, l'exploitant relance l'outil.

Technical design ruling: le champ du catalogue qui dit l'exécutable s'appelle `copyExecutable`, nul exactement quand `copySteamApp` l'est, et un test l'épingle pour chaque jeu — le design le demande sans le nommer, et garder `copySteamApp` tel quel laisse intacts ses lecteurs dans `apps/functions` — si c'est faux, deux champs nullables se regroupent en un objet `copy`, et ses lecteurs changent.

Technical design ruling: la première ligne du parcours guidé ne nomme plus le jeu, et l'étape 4 le nomme une fois choisi — le design veut l'en-tête qui nomme le jeu imprimé après ce choix, et imprimer l'en-tête au milieu des étapes numérotées le rendrait illisible — si c'est faux, une ligne change de place.

Technical design ruling: `depositedVersion` rend la version d'une copie que les Functions liraient, donc `null` pour une version enregistrée sans son heure de dépôt — le design ne dit pas ce que la lecture rend, et l'outil doit juger « déjà la copie déposée » comme la vérification préalable la juge — si c'est faux, un document à moitié écrit fait proposer un dépôt au lieu de « déposer quand même ? ».

## Observed drift
