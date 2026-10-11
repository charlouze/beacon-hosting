# Le fichier des admins en jeu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un serveur `sunkenland` démarre avec tous les admins en jeu que son monde désigne, quel que soit leur nombre : le point d'entrée les écrit dans `AdminSteamIDs.txt` et ne passe plus `-adminSteamIDs`.

**Architecture:** `deploy/cloud-init/src/lib/sunkenland.ts` exporte `adminFile`, le fragment bash qui supprime puis écrit `AdminSteamIDs.txt` dans le dossier du monde, rendu pour une liste d'identifiants. `startSh` l'insère après `beacon: opening` et avant le lancement du serveur, et `_terminate` supprime le fichier une fois le serveur arrêté. `BootRequest.adminSteamIds`, `refuseAnythingButDigits` et ce que `apps/functions` passe au catalogue gardent leur code.

**Tech Stack:** TypeScript, bash, Vitest, émulateur Firestore, Nx.

**Spec:** docs/specs/session.md
**Batch:** docs/batches/02-admins-en-jeu-par-fichier/README.md
**Sections:** Running a game
**Blocks:** none

## Global Constraints

### Ce que le lot impose

none

### Le périmètre de cette story

Cette story ne modifie que les fichiers que ses tâches nomment, et ce document.

`deploy/companion` ne change pas : un changement de ses sources, même d'un commentaire, change l'empreinte que `companion:test` compare à l'image épinglée.

`probe/` ne change pas.

`BootRequest.adminSteamIds`, `refuseAnythingButDigits` et l'appel de `renderCloudInit` dans `apps/functions/src/provisioning.ts` gardent leur code.

Le rendu de `enshrouded` ne change pas.

Aucune commande n'atteint la production : ni `firebase deploy`, ni appel à un fournisseur, ni tag git. Les tests tournent contre l'émulateur.

### Les commits

Chaque commit passe par `bash ~/.config/github-app/as-agent.sh git commit`, et son message finit par `Co-Authored-By: Charlouze <me@charlouze.com>`.

Aucun commit, commentaire ni document ne mentionne un assistant ou un outil d'IA.

Le sujet d'un commit suit Conventional Commits, en français, à l'impératif, en minuscule, sans point final.

Le code et ses commentaires sont en anglais. Ce document est en français.

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

> If, while bringing code into conformance with a spec, you discover that it is the **spec** that is wrong and the code that is right, stop. The batch is no longer corrective and must be requalified.

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

- Un seul identifiant déclaré, le cas d'un monde dont un seul membre a déclaré son compte : le fichier porte une ligne finie par un LF.
- Un fichier laissé par une session précédente et plus long que la nouvelle liste : aucune de ses lignes ne reste.
- Le conteneur relance le script quand le serveur tombe : la deuxième exécution laisse le même fichier et sort à zéro.
- Un dossier nommé `AdminSteamIDs.txt` alors que des identifiants sont déclarés : le script s'arrête avec un code non nul, avant d'imprimer le nombre d'identifiants.

Chacun a son test dans la tâche 2.

---

### Task 1: Les tests du provisionnement n'épinglent plus la forme

**Files:**
- Modify: `apps/functions/src/provisioning.spec.ts:263-282`

**Interfaces:**
- Consumes: rien.
- Produces: deux tests de `provisioning.spec.ts` qui passent que les identifiants voyagent en argument ou dans un fichier.

- [ ] **Step 1: Vérifier que la suite passe avant le changement**

Run: `npx nx run @beacon/functions:test`
Expected: PASS. La commande démarre l'émulateur Firestore elle-même.

- [ ] **Step 2: Récrire les deux tests**

Dans `describe('the steam ids the game is told about', …)`, remplacer le test `names any member who declared an identifier` et le test `leaves the option out when nobody declared one`, avec leurs commentaires, par :

```ts
    // A `player`, and that is the point: §2 gives the in-game administrator
    // role to every member. What reaches the cloud-init is a member's declared
    // identifier, never a Beacon role. `alice` must be one of the world's
    // players (§4 delimits the world to them): `defaultWorld` names `u1` alone.
    //
    // The identifier and not the form it travels in: how a game is told about
    // its admins is the catalogue's business, and its own suite pins it.
    it('names any member who declared an identifier', async () => {
      await db.doc(`${MEMBERS}/u1`).set({ role: 'player', steamId: '76561197965918116' });

      await runStateChange(deps, WORLD_ID, provisioningSunkenland());

      expect(bootstrapOf(deps)).toContain('76561197965918116');
    });

    // A steam id is seventeen digits standing alone, and nothing else in a
    // bootstrap is: none may appear when no member declared one.
    it('names nobody when nobody declared an identifier', async () => {
      await db.doc(`${MEMBERS}/u1`).set({ role: 'player' });

      await runStateChange(deps, WORLD_ID, provisioningSunkenland());

      expect(bootstrapOf(deps)).not.toMatch(/\b[0-9]{17}\b/);
    });
```

- [ ] **Step 3: Vérifier que la suite passe encore**

Run: `npx nx run @beacon/functions:test`
Expected: PASS, le même nombre de tests qu'au Step 1.

- [ ] **Step 4: Commit**

```bash
git add apps/functions/src/provisioning.spec.ts
bash ~/.config/github-app/as-agent.sh git commit -F - <<'EOF'
test(functions): cesse d'épingler la forme sous laquelle un identifiant atteint le serveur

Co-Authored-By: Charlouze <me@charlouze.com>
EOF
```

### Task 2: Le point d'entrée écrit le fichier des admins

**Files:**
- Modify: `deploy/cloud-init/src/lib/sunkenland.ts`
- Modify: `deploy/cloud-init/src/lib/catalog.ts:32-43,179-192,228-231`
- Test: `deploy/cloud-init/src/lib/sunkenland.spec.ts`
- Test: `deploy/cloud-init/src/lib/enshrouded.spec.ts:45-50`
- Modify: `deploy/cloud-init/src/lib/catalog.spec.ts:61-66`
- Modify: `deploy/cloud-init/src/lib/catalogue-fixtures.spec-helper.ts:15-16`
- Modify: `apps/functions/src/provisioning.ts:89-95`
- Modify: `apps/functions/src/provisioning.spec.ts:29,256-260`
- Modify: `libs/membership-record/src/lib/admin-membership.ts:21-24,35-38`
- Modify: `libs/membership-record/src/lib/admin-membership.spec.ts:74-77`
- Modify: `apps/web/src/app/session/steam-declaration.component.ts:6-10`

**Interfaces:**
- Consumes: `REQUEST` et `request` de `catalogue-fixtures.spec-helper.ts`, `renderCloudInit` de `catalog.ts`.
- Produces: `export const adminFile: (adminSteamIds: readonly string[]) => string`, dans `sunkenland.ts`, et `writeAdmins`, de même signature, que seul `adminFile` appelle. Le fragment bash lit `WORLD_DIR` et `world`, pose `admin_file`, et imprime `beacon: <n> in-game admins`.

- [ ] **Step 1: Écrire les tests du fragment, qui échouent**

Dans `deploy/cloud-init/src/lib/sunkenland.spec.ts`, remplacer l'import de `./sunkenland.js` par :

```ts
import { adminFile, SERVERID_FILTER, sunkenland } from './sunkenland.js';
```

Ajouter, après la fonction `runWorldDerivation` et avant `const GUID` :

```ts
/**
 * The admin file is laid down by bash too, and it gets run for the same
 * reason: what it must survive is a real folder — a name with a space and an
 * apostrophe, a file an earlier session left, something in the way. `body` is
 * the fragment exactly as exported; the two variables are the ones the entry
 * point has set by the time it reaches it.
 */
function runAdminFile(
  body: string,
  prepare: (adminFilePath: string) => void = () => undefined,
): { status: number | null; output: string; written: string | null } {
  const dir = mkdtempSync(join(tmpdir(), 'beacon-admins-'));
  const world = `Beacon's World~${GUID}`;
  mkdirSync(join(dir, 'worlds', world), { recursive: true });
  const adminFilePath = join(dir, 'worlds', world, 'AdminSteamIDs.txt');
  prepare(adminFilePath);

  writeFileSync(
    join(dir, 'admins.sh'),
    ['set -euo pipefail', 'WORLD_DIR=worlds', `world="${world}"`, body, ''].join('\n'),
  );
  const run = spawnSync('bash', ['admins.sh'], { cwd: dir, encoding: 'utf8' });
  const result = { status: run.status, output: run.stdout + run.stderr };
  try {
    return { ...result, written: readFileSync(adminFilePath, 'utf8') };
  } catch {
    return { ...result, written: null };
  }
}
```

Ajouter, après le `describe('la derivation du monde sur la machine', …)` :

```ts
describe('the admin file on the machine', () => {
  const TWO = ['11111111111111111', '76561197965918116'];

  // Measured, `probe/RESULTS.md` section A: one identifier per line, a LF at
  // the end of each, and the account on the second line is an admin.
  it('writes one identifier per line, each ended by a LF, in a folder named with a space and an apostrophe', () => {
    const run = runAdminFile(adminFile(TWO));
    expect(run.status).toBe(0);
    expect(run.written).toBe('11111111111111111\n76561197965918116\n');
  });

  it('writes a single identifier on a single line', () => {
    const run = runAdminFile(adminFile(['76561197965918116']));
    expect(run.status).toBe(0);
    expect(run.written).toBe('76561197965918116\n');
  });

  // An automatic save carries the file, so a restored folder may hold the one
  // of an earlier session: a member since removed from the world must not stay
  // an admin through a line nobody rewrote.
  it('replaces the file an earlier session left, down to its last line', () => {
    const run = runAdminFile(adminFile(TWO), (path) =>
      writeFileSync(path, '22222222222222222\n33333333333333333\n44444444444444444\n'),
    );
    expect(run.status).toBe(0);
    expect(run.written).toBe('11111111111111111\n76561197965918116\n');
  });

  // The container runs the entry point again when the server dies mid-session.
  it('leaves the same file when the script runs a second time', () => {
    const run = runAdminFile(`${adminFile(TWO)}\n${adminFile(TWO)}`);
    expect(run.status).toBe(0);
    expect(run.written).toBe('11111111111111111\n76561197965918116\n');
  });

  it('removes the file an earlier session left when nobody declared an identifier', () => {
    const run = runAdminFile(adminFile([]), (path) => writeFileSync(path, '76561197965918116\n'));
    expect(run.status).toBe(0);
    expect(run.written).toBeNull();
  });

  it('writes no file at all when nobody declared an identifier', () => {
    const run = runAdminFile(adminFile([]));
    expect(run.status).toBe(0);
    expect(run.written).toBeNull();
  });

  // A folder is the one thing `rm -f` refuses the same way on every machine
  // this suite runs on. A server started without the admins its world names is
  // the defect, so the boot stops instead.
  const IN_THE_WAY: readonly (readonly [string, readonly string[]])[] = [
    ['nobody declared an identifier', []],
    ['identifiers are declared', TWO],
  ];
  for (const [situation, ids] of IN_THE_WAY) {
    it(`stops the boot when the file cannot be removed and ${situation}`, () => {
      const run = runAdminFile(adminFile(ids), (path) => {
        mkdirSync(path);
      });
      expect(run.status).not.toBe(0);
      expect(run.output).not.toContain('in-game admins');
    });
  }

  it('prints how many identifiers it wrote, zero included, and never one of them', () => {
    const two = runAdminFile(adminFile(TWO));
    expect(two.output).toContain('beacon: 2 in-game admins');
    expect(two.output).not.toMatch(/[0-9]{17}/);
    expect(runAdminFile(adminFile([])).output).toContain('beacon: 0 in-game admins');
  });
});
```

- [ ] **Step 2: Lancer les tests et vérifier qu'ils échouent**

Run: `npx nx run cloud-init:test`
Expected: FAIL, `adminFile` n'est pas exporté par `./sunkenland.js`.

- [ ] **Step 3: Écrire le fragment**

Dans `deploy/cloud-init/src/lib/sunkenland.ts`, écrire au-dessus du commentaire de documentation de `adminOption`, que le Step 6 supprime :

```ts
/** Where this game reads its in-game admins from, inside the world folder. */
const ADMIN_FILE = 'AdminSteamIDs.txt';

/**
 * No file at all when nobody declared an account: it is what a server with no
 * admin has always booted on, and nothing measures what the game makes of an
 * empty one.
 */
const writeAdmins = (adminSteamIds: readonly string[]): string =>
  adminSteamIds.length === 0
    ? '# Nobody declared an account: no file at all.'
    : `printf '%s\\n' ${adminSteamIds.join(' ')} > "$admin_file"`;

/**
 * Who administers the server inside the game, laid down as the file the server
 * reads. Measured, `probe/RESULTS.md` section A: the argument refuses a list of
 * two and the server then boots with no admin at all, while this file is read
 * without the argument, one identifier per line, each ended by a LF. It is the
 * only way a human has of asking this game to save.
 *
 * Exported as a value, like `SERVERID_FILTER` and for the same reason: it is
 * bash, so a test runs it on a real folder instead of reading it. It expects
 * `WORLD_DIR` and `world`, which the entry point has set by the time it gets
 * here, and leaves `admin_file` for the teardown.
 *
 * The identifiers land unquoted: `renderCloudInit` refuses anything but digits.
 */
export const adminFile = (adminSteamIds: readonly string[]): string => `# The world folder travels in every save, so it may carry the file of an
# earlier session: it is replaced on every boot and never read. Removed first,
# because a file this user cannot open for writing still goes with \`rm\` —
# deleting only takes the right to write in the folder.
#
# Either line failing stops the boot under \`set -e\`, before the server
# starts: a server running without the admins its world names is the defect
# this exists to close.
admin_file="$WORLD_DIR/$world/${ADMIN_FILE}"
rm -f "$admin_file"
${writeAdmins(adminSteamIds)}
# The count, never the identifiers.
printf 'beacon: %s in-game admins\\n' ${adminSteamIds.length}`;
```

- [ ] **Step 4: Lancer les tests du fragment et vérifier qu'ils passent**

Run: `npx nx run cloud-init:test`
Expected: PASS.

- [ ] **Step 5: Écrire les tests du script rendu, qui échouent**

Dans `deploy/cloud-init/src/lib/sunkenland.spec.ts`, dans `describe('the sunkenland catalogue entry', …)`, remplacer les trois tests `renders one administrator exactly as the constant did`, `joins several administrators with a comma` et `leaves the option out when nobody declared an identifier`, avec leurs commentaires, par :

```ts
  /** The entry point as the machine reads it, out of its block scalar. */
  const entryPoint = (adminSteamIds: readonly string[]): string =>
    renderCloudInit('sunkenland', { ...REQUEST, adminSteamIds })
      .split('\n')
      .map((line) => line.replace(/^ {6}/, ''))
      .join('\n');

  const ADMIN_LISTS: readonly (readonly string[])[] = [
    [],
    ['76561197965918116'],
    ['11111111111111111', '76561197965918116'],
  ];

  // After the guid check, because the fragment writes inside the folder that
  // check has just accepted. Before the server, because the server reads the
  // file when a player arrives.
  for (const ids of ADMIN_LISTS) {
    it(`lays the admin file down once the world is checked, and before the server starts, for ${ids.length} admins`, () => {
      const script = entryPoint(ids);
      const at = script.indexOf(adminFile(ids));
      expect(at).toBeGreaterThan(script.indexOf('does not end in a guid'));
      expect(at).toBeLessThan(script.indexOf('wine "$GAME_DIR/'));
    });

    // Measured in production on 2026-09-17: the argument refuses a list of
    // two, and the server then starts with no admin at all.
    it(`never passes the admins as an argument, for ${ids.length} admins`, () => {
      expect(entryPoint(ids)).not.toContain('-adminSteamIDs');
    });
  }

  // The end-of-session save is never deleted, so the file goes once the server
  // is down. `|| true`, because under `set -e` a refused removal would cut the
  // teardown before the X server stops.
  it('removes the admin file once the server is down, without letting a refusal cut the teardown', () => {
    expect(entryPoint([])).toMatch(
      /_terminate\(\) \{\n[^}]*wineserver -k -w\n[^}]*rm -f "\$admin_file" \|\| true\n[^}]*\}/,
    );
  });
```

Run: `npx nx run cloud-init:test`
Expected: FAIL sur les tests du Step 5, le script rendu ne portant pas encore le fragment.

- [ ] **Step 6: Brancher le fragment dans `startSh` et dans `_terminate`**

Dans `deploy/cloud-init/src/lib/sunkenland.ts`, supprimer `adminOption` et son commentaire de documentation.

Dans `startSh`, remplacer :

```ts
printf 'beacon: opening %s\\n' "$world"

args=(
  -batchmode
  -nographics
  -worldGuid "$WORLD_GUID"
  -region ${REGION}
  -maxPlayerCapacity "\${MAX_PLAYERS:-4}"
  -autoSaveIntervalInSeconds ${AUTOSAVE_SECONDS}${adminOption(adminSteamIds)}
)
```

par :

```ts
printf 'beacon: opening %s\\n' "$world"

${adminFile(adminSteamIds)}

args=(
  -batchmode
  -nographics
  -worldGuid "$WORLD_GUID"
  -region ${REGION}
  -maxPlayerCapacity "\${MAX_PLAYERS:-4}"
  -autoSaveIntervalInSeconds ${AUTOSAVE_SECONDS}
)
```

Dans le même `startSh`, remplacer :

```ts
# And its teardown, for the same reason plus one of our own: as PID 1 a process
# with no handler never receives SIGTERM at all, so an \`exec\` here would turn
# every \`docker stop\` into a ten-second wait then a SIGKILL — possibly in the
# middle of an autosave, on the one folder this system cannot rebuild.
_terminate() {
  echo 'beacon: caught TERM, stopping'
  wineserver -k -w
  /etc/init.d/xvfb stop
}
```

par :

```ts
# Upstream's teardown, with one line of ours in it. A handler and never an
# \`exec\`: as PID 1 a process with no handler never receives SIGTERM at all, so
# every \`docker stop\` would be a ten-second wait then a SIGKILL — possibly in
# the middle of an autosave, on the one folder this system cannot rebuild.
_terminate() {
  echo 'beacon: caught TERM, stopping'
  wineserver -k -w
  # Ours, once the server is down: the end-of-session save is never deleted,
  # and should not keep the members' Steam accounts. An improvement and not a
  # guarantee — it holds because the companion archives after its
  # \`shutdownGraceMs\` (180 s, \`deploy/companion/src/agent.ts\`), longer than
  # this container's \`stop_grace_period\`, and no contract carries that gap.
  # Never fatal: under \`set -e\` a refused removal would cut the teardown here.
  rm -f "$admin_file" || true
  /etc/init.d/xvfb stop
}
```

Dans `COMPOSE`, remplacer la ligne `    stop_grace_period: 90s` du service du jeu par :

```ts
    # Shorter than the companion's \`shutdownGraceMs\` (180 s,
    # \`deploy/companion/src/agent.ts\`), and the entry point leans on that gap:
    # it removes the admin file once the server is down, before the companion
    # archives. No contract carries it — whoever moves one value reads the other.
    stop_grace_period: 90s
```

- [ ] **Step 7: Récrire ce que le changement rend faux dans `deploy/cloud-init`**

Dans `sunkenland.spec.ts`, remplacer le test `keeps the upstream trap, and never execs into the server` et son commentaire par :

```ts
  // Measured: as PID 1 a process with no handler never receives SIGTERM. An
  // `exec` would turn every docker stop into ten seconds then a SIGKILL,
  // possibly in the middle of a save. The teardown is upstream's, with the
  // removal of the admin file added to it.
  it('keeps a trap that stops the server, and never execs into it', () => {
    const rendered = renderCloudInit('sunkenland', REQUEST);
    expect(rendered).toContain('trap _terminate HUP INT QUIT TERM');
    expect(rendered).toContain('wineserver -k -w');
    expect(rendered).not.toMatch(/exec wine /);
  });
```

Dans le test `lays both scripts inside their block scalars, every line at its own depth`, remplacer :

```ts
    // An argument, at the depth arguments sit at. It used to be
    // `-adminSteamIDs`, which no longer belongs to a fixture — the test that
    // renders one administrator now pins that line at this very depth.
    expect(rendered).toContain('\n        -region eu\n');
```

par :

```ts
    // An argument, at the depth arguments sit at, and a line of the admin
    // fragment at the depth of the script.
    expect(rendered).toContain('\n        -region eu\n');
    expect(rendered).toContain('\n      rm -f "$admin_file"\n');
```

Dans `enshrouded.spec.ts`, remplacer le test `ignores the administrators, an option this game does not know` et son commentaire par :

```ts
  // The request is common to both games, and the shared fixture carries an
  // identifier: nothing in this entry tells its server about in-game admins,
  // so none of the declared accounts may reach its machine.
  it('carries none of the declared steam ids', () => {
    const rendered = renderCloudInit('enshrouded', REQUEST);
    for (const steamId of REQUEST.adminSteamIds) {
      expect(rendered).not.toContain(steamId);
    }
  });
```

Dans `catalogue-fixtures.spec-helper.ts`, remplacer :

```ts
  // The account of the 2026-09-05 measurement, so a suite that does not care
  // about administrators still renders the boot that was actually observed.
```

par :

```ts
  // The account measured as an in-game admin, by argument on 2026-09-05 and by
  // file on 2026-10-10, so a suite that does not care about administrators
  // still renders a boot that names one.
```

Dans `catalog.ts`, dans le commentaire de `BootRequest.adminSteamIds`, remplacer :

```ts
   * declared an identifier — and an entry for a game that does not know the
   * option ignores the field, as it ignores every other one it has no use for.
```

par :

```ts
   * declared an identifier — and an entry for a game that is told nothing about
   * its admins ignores the field, as it ignores every other one it has no use
   * for.
```

Dans le commentaire de `refuseAnythingButDigits`, remplacer :

```ts
 * description: `adminSteamIds` is the one field of a request that reaches a
 * machine as **shell** — unquoted, inside the `args=( … )` of an entry point —
 * so `$(…)` in it runs as root on a billed machine, and it travelled all the
 * way from a browser. Quoting buys nothing: bash substitutes inside double
```

par :

```ts
 * description: `adminSteamIds` is the one field of a request that reaches a
 * machine as **shell** — unquoted, as the arguments of a `printf` in an entry
 * point — so `$(…)` in it runs on a billed machine, and it travelled all the
 * way from a browser. Quoting buys nothing: bash substitutes inside double
```

Dans le commentaire de `renderCloudInit`, remplacer :

```ts
 * The third is `refuseAnythingButDigits` above, and it is held here for the
 * same reason as the `$`: one entry writes that option today, the request is
 * common to both, and a guard living in that entry would protect nothing the
 * day a second game learns the option.
```

par :

```ts
 * The third is `refuseAnythingButDigits` above, and it is held here for the
 * same reason as the `$`: one entry writes those identifiers into a script
 * today, the request is common to both, and a guard living in that entry would
 * protect nothing the day a second game does the same.
```

Dans `catalog.spec.ts`, remplacer :

```ts
    // The one field of a request that reaches a machine as shell, unquoted,
    // inside an `args=( … )`. It travelled from a browser: a member writes it
    // on its own document. Double quotes would buy nothing — bash substitutes
    // inside them — so anything but digits is refused, and refused here rather
    // than in the entry that writes the option, because the request is common
    // to both games and only one of them carries that option today.
```

par :

```ts
    // The one field of a request that reaches a machine as shell, unquoted, as
    // the arguments of a `printf`. It travelled from a browser: a member writes
    // it on its own document. Double quotes would buy nothing — bash
    // substitutes inside them — so anything but digits is refused, and refused
    // here rather than in the entry that writes it, because the request is
    // common to both games and only one of them writes it today.
```

- [ ] **Step 8: Lancer les tests de `cloud-init` et vérifier qu'ils passent**

Run: `npx nx run cloud-init:test`
Expected: PASS.

Run: `npx nx run cloud-init:render` avec `GAME=sunkenland SERVER_PASSWORD=x ADMIN_STEAM_IDS=11111111111111111,76561197965918116` dans l'environnement.
Expected: le script rendu porte `printf '%s\n' 11111111111111111 76561197965918116 > "$admin_file"` et ne porte pas `-adminSteamIDs`.

- [ ] **Step 9: Récrire les commentaires que le changement rend faux hors de `deploy/cloud-init`**

Dans `apps/functions/src/provisioning.ts`, remplacer :

```ts
    // The seam between the two vocabularies, and the only line that crosses it:
    // what `members` holds is a list of declared Steam accounts, what the game
    // is handed is its `-adminSteamIDs`. §2 makes the two the same list — every
```

par :

```ts
    // The seam between the two vocabularies, and the only line that crosses it:
    // what `members` holds is a list of declared Steam accounts, what the game
    // is handed is its in-game admins. §2 makes the two the same list — every
```

Dans `apps/functions/src/provisioning.spec.ts`, remplacer :

```ts
/** The one game whose cloud-init carries `-adminSteamIDs` at all. */
```

par :

```ts
/** The one game whose cloud-init carries the declared steam ids at all. */
```

et remplacer :

```ts
    // all. A member left behind here would arm it a `-adminSteamIDs` depending
    // on the order the files ran in — the shape of red that shows up once in
```

par :

```ts
    // all. A member left behind here would arm it an in-game admin depending
    // on the order the files ran in — the shape of red that shows up once in
```

Dans `libs/membership-record/src/lib/admin-membership.ts`, remplacer :

```ts
 * That is also what keeps this value out of a shell. It reaches the game on a
 * launch line, unquoted, and a member writes it: `$(…)` there would run on a
 * machine the rules never let that member near. The shape is checked here
```

par :

```ts
 * That is also what keeps this value out of a shell. It reaches the game's
 * machine in a script, unquoted, and a member writes it: `$(…)` there would run
 * on a machine the rules never let that member near. The shape is checked here
```

et remplacer :

```ts
 * the administrator of a game is what a launch line grants — and §2 grants that
 * one to every member, whatever their role.
```

par :

```ts
 * the administrator of a game is what the game's own list of admins grants —
 * and §2 grants that one to every member, whatever their role.
```

Dans `libs/membership-record/src/lib/admin-membership.spec.ts`, remplacer :

```ts
  // does — and it is also what keeps this value out of a shell: it lands
  // unquoted in the game's launch line, where `$(…)` would run on the machine.
```

par :

```ts
  // does — and it is also what keeps this value out of a shell: it lands
  // unquoted in the script that starts the game, where `$(…)` would run on the
  // machine.
```

Dans `apps/web/src/app/session/steam-declaration.component.ts`, remplacer :

```ts
 * It exists although no comp shows it: §2 gives every member the administrator
 * role *inside the game*, through `-adminSteamIDs`, and that is the only way a
 * human can trigger a save on the game where §8 measured that nothing else
 * can. The driver carried a bare field; dropping it without a replacement
 * would take that away from every member arriving after this tranche.
```

par :

```ts
 * It exists although no comp shows it: §2 gives every member the administrator
 * role *inside the game*, through the list of admins its server reads, and that
 * is the only way a human can trigger a save on the game where §8 measured that
 * nothing else can. The driver carried a bare field; dropping it without a
 * replacement would take that away from every member arriving after this
 * tranche.
```

- [ ] **Step 10: Vérifier qu'aucun code ne nomme plus l'argument**

Run: `git grep -n -e '-adminSteamIDs' -- apps libs deploy/cloud-init`
Expected: une ligne, l'assertion du test `never passes the admins as an argument` dans `deploy/cloud-init/src/lib/sunkenland.spec.ts`. Une occurrence ailleurs se récrit.

- [ ] **Step 11: Lancer les suites et la vérification statique**

Run: `npx nx run-many -t test -p cloud-init @beacon/functions @beacon/membership-record`
Expected: PASS.

Run: `npx nx run-many -t lint typecheck -p cloud-init @beacon/functions @beacon/membership-record web`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add deploy/cloud-init apps/functions/src/provisioning.ts apps/functions/src/provisioning.spec.ts libs/membership-record/src/lib/admin-membership.ts libs/membership-record/src/lib/admin-membership.spec.ts apps/web/src/app/session/steam-declaration.component.ts
bash ~/.config/github-app/as-agent.sh git commit -F - <<'EOF'
fix(cloud-init): écrit les admins en jeu dans le fichier que le serveur lit

L'argument refuse une liste de deux identifiants, et le serveur démarre
alors sans aucun admin. Le point d'entrée supprime puis écrit
`AdminSteamIDs.txt` dans le dossier du monde, et s'arrête si l'un des
deux gestes est refusé.

Le fichier est supprimé à l'arrêt du serveur pour ne pas rester dans la
sauvegarde de fin de session. Rien ne le garantit : le compagnon archive
après un délai plus long que celui du conteneur, sans contrat entre les
deux.

Co-Authored-By: Charlouze <me@charlouze.com>
EOF
```

## Rulings log

Technical design ruling: le commentaire sur l'écart entre les 180 s du compagnon et les 90 s d'arrêt du conteneur n'est écrit que dans `sunkenland.ts`, à `_terminate` et à `stop_grace_period`, et pas dans `deploy/companion/src/agent.ts` — toucher une source du compagnon change l'empreinte que `companion:test` compare à l'image épinglée, donc oblige à publier une image pour un commentaire ; décidé par le commanditaire avant le plan — qui change `shutdownGraceMs` dans `agent.ts`, ou l'attente de `push.ts`, ne lit pas que la suppression du fichier à l'arrêt en dépend.

Open ruling: `_terminate` garde `wineserver -k -w` tel que l'image amont l'écrit, sans le rendre non fatal — le lot demande un mieux et non une garantie, et rien ne mesure ce que cette commande renvoie sur l'image — si elle sort non nulle, `set -e` quitte `_terminate` avant la suppression, et les comptes Steam restent dans la sauvegarde de fin de session, un cas que les risques du lot ne nomment pas. Reste à trancher : rendre `wineserver -k -w` non fatal dans cette story, ou accepter ce cas avec les autres.

Ruling: le commentaire bash en tête du fragment `adminFile` s'écarte du texte du Step 3 — la revue finale a relevé que « it is replaced on every boot and never read » avait un sujet ambigu, et que « Either line failing » était faux sans identifiant déclaré — le plan et le code ne disent plus ce commentaire dans les mêmes mots.

Ruling: aucun test ne rend le fichier d'une session précédente illisible en écriture avant de lancer le fragment — le lot l'écarte, la sonde l'a mesuré, et un tel test ne se comporte pas de la même façon sur un poste Windows et sur un serveur de jeu — la raison de supprimer avant d'écrire n'est tenue que par la mesure.

Ruling: la correction de commentaire issue de la revue finale a été relue par le contrôleur sur son diff, sans relecteur dédié — sept lignes de commentaire dans un fichier, tests et lint de `cloud-init` relancés — une erreur dans ce commentaire n'aurait eu qu'un lecteur avant la revue de livraison.

## Observed drift
