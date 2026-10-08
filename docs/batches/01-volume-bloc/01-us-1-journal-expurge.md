# Le journal expurgé Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ni un détail d'événement ni `lastError` ne recopient ce qu'un fournisseur ou un serveur de jeu a répondu, et l'erreur entière va au journal de la plateforme.

**Architecture:** `apps/functions` déclare le port `PlatformJournal` et une fonction `expunged`, qui écrit l'erreur entière dans ce journal et rend le texte passé par `sanitizeLastError`. Le watchdog, `provisioning` et `agentReport` passent par elle à chaque endroit où ils reçoivent une erreur, avant de la donner au domaine ou de l'écrire. `container.ts` câble le port sur le logger des Functions.

**Tech Stack:** TypeScript, Vitest, émulateur Firestore, `firebase-functions/logger`, Nx.

**Spec:** docs/specs/session.md
**Batch:** docs/batches/01-volume-bloc/README.md
**Sections:** none
**Blocks:** none

## Global Constraints

### Ce que le lot impose

Un volume porte les deux mêmes tags que l'IP et le serveur de sa session :
`OWNERSHIP_TAG` et `sessionTag(sessionId)`.

La destruction par tag atteint `main` avant que `open()` commande un volume
bloc.

Le choix de l'image `instance_sbs` atteint la production dans la même story que
le volume racine `sbs_volume`.

La clé que les Functions présentent au fournisseur a `BlockStorageFullAccess`
avant qu'une story qui appelle l'API bloc atteigne `main`. Le commanditaire le
vérifie.

Le commanditaire lance la suite de contrat avant que la story qui change
`open()` atteigne `main`.

Un serveur ouvert avant ce lot, sur disque local et sans volume tagué, se ferme
encore sans rien laisser.

### Le périmètre de cette story

Cette story ne modifie que `apps/functions` et ce document.

`libs/scaleway-compute` et `libs/session` ne changent pas.

`destroyed`, `stranded` et le `summary` d'un serveur hébergé ne passent pas par l'expurgation.

Les détails de `AgentContradicted` ne changent pas.

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

### Le dépôt

Le code, ses commentaires et ses noms de tests sont en anglais.

Un commentaire dit ce que le code ne peut pas dire, et ne redit pas la ligne.

Aucun fichier ne mentionne un agent ni un outil d'IA.

Aucune commande n'atteint la production : ni `firebase deploy`, ni appel à un fournisseur, ni écriture hors de l'émulateur.

Prettier ne tourne pas sur les sources.

Toute commande `git` qui écrit un commit passe par `bash ~/.config/github-app/as-agent.sh git …`.

Un message de commit suit Conventional Commits, en français, à l'impératif, en minuscule, sans point final, avec la portée `functions`.

Un message de commit se termine par `Co-Authored-By: Charlouze <me@charlouze.com>` et par aucune autre ligne d'attribution.

Les tests de `apps/functions` se lancent par `npx nx run @beacon/functions:test`, qui démarre l'émulateur ; deux lancements ne tournent pas en même temps.

Le typage se vérifie par `npx nx run @beacon/functions:typecheck`, et le lint par `npx nx run @beacon/functions:lint`.

## Review Focus

- Une valeur lancée qui n'est pas une `Error` : `expunged` rend son texte expurgé et l'écrit au journal, sans lever (tâche 1).
- Une erreur sur plusieurs lignes dont une porte un secret : le secret est masqué dans le texte rendu (tâche 1).
- Une erreur longue sans secret : le détail écrit est borné, le journal garde le texte entier (tâche 1).
- Un balayage qui rend plusieurs refus : chacun est expurgé et écrit une ligne au journal (tâche 2).
- Un `destroyed` qui porte un identifiant long du fournisseur : il atteint l'événement entier (tâche 2).

---

### Task 1: Le port `PlatformJournal` et `expunged`

**Files:**
- Create: `apps/functions/src/platform-journal.ts`
- Create: `apps/functions/src/platform-journal.spec.ts`
- Modify: `apps/functions/src/sanitize-last-error.ts` (commentaire seul)
- Modify: `apps/functions/src/container.ts` (`buildFirestoreDeps`)

**Interfaces:**
- Consumes: `sanitizeLastError(detail: string): string` de `./sanitize-last-error.js`.
- Produces:
  - `type FailureSource = 'watchdog.close' | 'watchdog.sweep' | 'provisioning.setup' | 'provisioning.cleanup' | 'agentReport.dns' | 'agentReport.save' | 'agentReport.cleanup' | 'agentReport.machine'`
  - `interface JournalledFailure { readonly source: FailureSource; readonly sessionId: SessionId | null; readonly error: string }`
  - `interface PlatformJournal { failure(entry: JournalledFailure): void }`
  - `function expunged(journal: PlatformJournal, source: FailureSource, sessionId: SessionId | null, cause: unknown): string`
  - `buildFirestoreDeps()` rend aussi `journal: PlatformJournal`.

- [ ] **Step 1: Write the failing test**

`apps/functions/src/platform-journal.spec.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { expunged, type JournalledFailure, type PlatformJournal } from './platform-journal.js';

const SECRET = 'a'.repeat(64);

const recording = () => {
  const entries: JournalledFailure[] = [];
  const journal: PlatformJournal = { failure: (entry) => entries.push(entry) };
  return { entries, journal };
};

describe('expunged', () => {
  it('hands back the failure without its secret', () => {
    const { journal } = recording();
    const readable = expunged(journal, 'provisioning.setup', 's1', new Error(`user data rejected: BEACON_TOKEN=${SECRET}`));
    expect(readable).not.toContain(SECRET);
    expect(readable).toContain('[redacted]');
  });

  it('writes the whole failure to the platform journal, with where it came from', () => {
    const { entries, journal } = recording();
    expunged(journal, 'watchdog.close', 's1', new Error(`refused: SCW_SECRET_KEY=${SECRET}`));
    expect(entries).toEqual([
      { source: 'watchdog.close', sessionId: 's1', error: `Error: refused: SCW_SECRET_KEY=${SECRET}` },
    ]);
  });

  it('journals a failure no session explains', () => {
    const { entries, journal } = recording();
    expunged(journal, 'watchdog.sweep', null, new Error('the listing was refused'));
    expect(entries[0].sessionId).toBeNull();
  });

  it('takes a thrown value that is not an Error', () => {
    const { entries, journal } = recording();
    expect(expunged(journal, 'agentReport.dns', 's1', `nochg ${SECRET}`)).toBe('nochg [redacted]');
    expect(expunged(journal, 'agentReport.dns', 's1', { code: 503 })).toBe('[object Object]');
    expect(entries).toHaveLength(2);
  });

  it('masks a secret on any line of a multi-line failure', () => {
    const { journal } = recording();
    const readable = expunged(journal, 'provisioning.setup', 's1', new Error(`invalid user data\n  BEACON_TOKEN=${SECRET}\n  at line 12`));
    expect(readable).not.toContain(SECRET);
    expect(readable).toContain('at line 12');
  });

  it('bounds what it hands back and keeps the whole text in the journal', () => {
    const { entries, journal } = recording();
    const long = 'refused '.repeat(200);
    expect(expunged(journal, 'provisioning.cleanup', 's1', long).length).toBeLessThan(600);
    expect(entries[0].error).toBe(long);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx run @beacon/functions:test`
Expected: FAIL, `platform-journal.spec.ts` ne résout pas `./platform-journal.js`.

- [ ] **Step 3: Write minimal implementation**

`apps/functions/src/platform-journal.ts` :

```ts
import type { SessionId } from '@beacon/session';
import { sanitizeLastError } from './sanitize-last-error.js';

/** Where `apps/functions` received the failure it journals. */
export type FailureSource =
  | 'watchdog.close'
  | 'watchdog.sweep'
  | 'provisioning.setup'
  | 'provisioning.cleanup'
  | 'agentReport.dns'
  | 'agentReport.save'
  | 'agentReport.cleanup'
  | 'agentReport.machine';

export interface JournalledFailure {
  readonly source: FailureSource;
  /** Null when no session explains the failure, as in a sweep. */
  readonly sessionId: SessionId | null;
  /** The failure as it was received: nothing bounded, nothing masked. */
  readonly error: string;
}

/**
 * The platform's own log, which only the operator reads. It is the one place
 * that keeps a failure whole: an event detail and `lastError` are read by
 * members, and what a provider or a game server answers can carry what the
 * system entrusted to it.
 */
export interface PlatformJournal {
  failure(entry: JournalledFailure): void;
}

/**
 * The gate every failure crosses before it reaches the domain or a document:
 * the whole text goes to the platform journal, and what comes back is what a
 * member may read. Called where the failure is received, so that no path
 * downstream can copy the original.
 */
export function expunged(
  journal: PlatformJournal,
  source: FailureSource,
  sessionId: SessionId | null,
  cause: unknown,
): string {
  const error = String(cause);
  journal.failure({ source, sessionId, error });
  return sanitizeLastError(error);
}
```

Si `SessionId` n'est pas exporté par `@beacon/session`, l'importer d'où `agent-report.ts` l'importe.

Dans `apps/functions/src/sanitize-last-error.ts`, remplacer le commentaire de documentation de `sanitizeLastError` par :

```ts
/**
 * What a member reads is bounded and redacted: `server/current.lastError` and
 * every event detail reach every member's browser, and the failure they
 * summarise can carry a cloud-init in its text — nothing proves the provider's
 * SDK keeps the agent token or the S3 secret key out of an error message.
 *
 * Two limits, honestly stated rather than hidden by the name: the guarantee
 * is length-based, not credential-based — nothing here knows what a secret
 * looks like, only how long one usually is, so a short human-chosen password
 * would pass through untouched. And the pattern collapses anything that
 * long on sight, credential or not — a UUID, an object key — which is
 * exactly why the full text goes to the platform journal (`expunged`, in
 * platform-journal.ts): what a member reads is not a place to understand
 * what actually failed.
 */
```

Dans `apps/functions/src/container.ts`, ajouter les imports :

```ts
import * as logger from 'firebase-functions/logger';
import type { PlatformJournal } from './platform-journal.js';
```

puis, au-dessus de `buildFirestoreDeps` :

```ts
/** Cloud Logging, through the Functions logger: only the operator reads it. */
const platformJournal: PlatformJournal = {
  failure: (entry) => logger.error(`${entry.source} failed`, entry),
};
```

et ajouter `journal: platformJournal,` à l'objet que `buildFirestoreDeps` rend.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx run @beacon/functions:test` puis `npx nx run @beacon/functions:typecheck` puis `npx nx run @beacon/functions:lint`
Expected: PASS aux trois.

- [ ] **Step 5: Commit**

```bash
git add apps/functions/src/platform-journal.ts apps/functions/src/platform-journal.spec.ts apps/functions/src/sanitize-last-error.ts apps/functions/src/container.ts
bash ~/.config/github-app/as-agent.sh git commit -m "fix(functions): déclare le journal de la plateforme et l'expurgation qui y écrit" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 2: Le watchdog

**Files:**
- Modify: `apps/functions/src/watchdog.ts`
- Modify: `apps/functions/src/watchdog.spec.ts`
- Modify: `apps/functions/src/immediate-pass.spec.ts` (`watchdogDeps`)

**Interfaces:**
- Consumes: `expunged`, `PlatformJournal`, `JournalledFailure` de `./platform-journal.js` (tâche 1).
- Produces: `WatchdogDeps.journal: PlatformJournal`.

- [ ] **Step 1: Write the failing test**

Dans `apps/functions/src/watchdog.spec.ts`, importer `type JournalledFailure` depuis `./platform-journal.js`, déclarer à côté de `let host` :

```ts
let journalled: JournalledFailure[];
```

le vider dans le `beforeEach` existant (`journalled = [];`), et ajouter à `deps()` et à `quietDeps()` :

```ts
  journal: { failure: (entry) => journalled.push(entry) },
```

Ajouter ce bloc dans le `describe` principal :

```ts
  // An event detail and `lastError` are read by every member, and what the
  // provider answers can carry what the system entrusted to it.
  describe('what a member reads of a failure', () => {
    const SECRET = 'a'.repeat(64);
    const details = async () =>
      (await db.collection('events').get()).docs.map((d) => d.data()['detail'] as string);

    it('keeps a refused close out of the event and of lastError, and whole in the platform journal', async () => {
      host.hosted = [hosted('sess1')];
      host.close = async () => {
        throw new Error(`refused: SCW_SECRET_KEY=${SECRET}`);
      };
      await db.doc('provisioning/sess1').set({ closedAt: null });
      await seedWorld('w1', {
        state: 'STOPPING',
        sessionId: 'sess1',
        stateSince: minutesAgo(11),
        instanceId: 'i-1',
      });

      await runWatchdog(deps());

      expect(await eventTypes()).toEqual(['CleanupFailed']);
      const [detail] = await details();
      expect(detail).not.toContain(SECRET);
      expect(detail).toContain('[redacted]');
      const current = (await db.doc('worlds/w1/server/current').get()).data();
      expect(current?.['state']).toBe('FAILED');
      expect(current?.['lastError']).not.toContain(SECRET);
      expect(current?.['lastError']).toContain('[redacted]');
      expect(journalled).toEqual([
        { source: 'watchdog.close', sessionId: 'sess1', error: `Error: refused: SCW_SECRET_KEY=${SECRET}` },
      ]);
    });

    it('keeps a refused close of a session no world claims out of the event', async () => {
      host.hosted = [hosted('ghost')];
      host.close = async () => {
        throw new Error(`refused: SCW_SECRET_KEY=${SECRET}`);
      };

      await runWatchdog(deps());

      const [detail] = await details();
      expect(detail).not.toContain(SECRET);
      expect(journalled.map((entry) => entry.sessionId)).toEqual(['ghost']);
    });

    it('keeps a refused sweep out of the event, and whole in the platform journal', async () => {
      host.sweepUnclaimed = async () => {
        throw new Error(`listing refused: X-Auth-Token ${SECRET}`);
      };

      await runWatchdog(deps());

      expect(await eventTypes()).toEqual(['CleanupFailed']);
      expect((await details())[0]).not.toContain(SECRET);
      expect(journalled).toEqual([
        { source: 'watchdog.sweep', sessionId: null, error: `Error: listing refused: X-Auth-Token ${SECRET}` },
      ]);
    });

    it('expunges every refusal a sweep hands back, one journal line each', async () => {
      const refusals = [`ip 51.15.0.1: refused ${SECRET}`, `server s-2: refused ${SECRET}`];
      host.sweep = { ...QUIET, errors: refusals };

      await runWatchdog(deps());

      const written = await details();
      expect(written).toHaveLength(2);
      for (const detail of written) expect(detail).not.toContain(SECRET);
      expect(journalled.map((entry) => entry.error)).toEqual(refusals);
      expect(journalled.every((entry) => entry.source === 'watchdog.sweep')).toBe(true);
    });

    // The adapter composes these two itself: they carry no provider answer.
    it('leaves what a sweep destroyed and stranded as the adapter wrote it', async () => {
      const destroyed = 'ip 0a1b2c3d-0000-4000-8000-123456789abc';
      const stranded = 'volume 9f8e7d6c-0000-4000-8000-abcdef012345 (80 GB)';
      host.sweep = { destroyed: [destroyed], stranded: [stranded], errors: [] };

      await runWatchdog(deps());

      expect((await details()).sort()).toEqual([destroyed, stranded].sort());
      expect(journalled).toEqual([]);
    });
  });
```

Dans `apps/functions/src/immediate-pass.spec.ts`, ajouter à `watchdogDeps` :

```ts
  journal: { failure: () => undefined },
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx run @beacon/functions:test`
Expected: FAIL, les détails et `lastError` portent le secret et `journalled` reste vide.

- [ ] **Step 3: Write minimal implementation**

Dans `apps/functions/src/watchdog.ts`, importer :

```ts
import { expunged, type PlatformJournal } from './platform-journal.js';
```

ajouter à `WatchdogDeps` :

```ts
  readonly journal: PlatformJournal;
```

remplacer la ligne du `catch` de la boucle des réclamations par :

```ts
      outcomes.push({
        reclamation,
        closed: false,
        error: expunged(deps.journal, 'watchdog.close', reclamation.sessionId, error),
      });
```

et le bloc `try`/`catch` du balayage par :

```ts
  const expungedSweepError = (error: unknown) => expunged(deps.journal, 'watchdog.sweep', null, error);
  try {
    const answered = await deps.host.sweepUnclaimed();
    // `destroyed` and `stranded` are the adapter's own words; `errors` is what
    // the provider answered.
    sweep = { ...answered, errors: answered.errors.map(expungedSweepError) };
  } catch (error) {
    swept = false;
    sweep = { destroyed: [], stranded: [], errors: [expungedSweepError(error)] };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx run @beacon/functions:test` puis `npx nx run @beacon/functions:typecheck` puis `npx nx run @beacon/functions:lint`
Expected: PASS aux trois.

- [ ] **Step 5: Commit**

```bash
git add apps/functions/src/watchdog.ts apps/functions/src/watchdog.spec.ts apps/functions/src/immediate-pass.spec.ts
bash ~/.config/github-app/as-agent.sh git commit -m "fix(functions): expurge ce que le watchdog écrit d'un refus" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 3: `provisioning`

**Files:**
- Modify: `apps/functions/src/provisioning.ts`
- Modify: `apps/functions/src/provisioning.spec.ts`
- Modify: `apps/functions/src/immediate-pass.spec.ts` (`provisionDeps`)
- Modify: `apps/functions/src/container.ts` (`buildProvisionDeps`)

**Interfaces:**
- Consumes: `expunged`, `PlatformJournal` de `./platform-journal.js` (tâche 1) ; `buildFirestoreDeps().journal` (tâche 1).
- Produces: `ProvisionDeps.journal: PlatformJournal`.

- [ ] **Step 1: Write the failing test**

Dans `apps/functions/src/provisioning.spec.ts`, ajouter à l'objet que `fakeDeps` rend :

```ts
    journal: { failure: vi.fn() },
```

Dans `describe('what reaches the client-readable field', …)`, remplacer le test `keeps the full detail in the journalled event` par :

```ts
    it('keeps the secret out of the journalled event, and the whole failure in the platform journal', async () => {
      deps.host.open = vi.fn(async () => {
        throw new Error(`user data rejected: BEACON_TOKEN=${secret}`);
      });
      await runStateChange(deps, WORLD_ID, provisioning());
      const applied = (deps.states.for(WORLD_ID).apply as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(applied.events[0].type).toBe('ProvisioningFailed');
      expect(applied.events[0].detail).not.toContain(secret);
      expect(applied.events[0].detail).toContain('[redacted]');
      expect(deps.journal.failure).toHaveBeenCalledWith({
        source: 'provisioning.setup',
        sessionId: 's1',
        error: `Error: user data rejected: BEACON_TOKEN=${secret}`,
      });
    });

    it('keeps a refused cleanup out of both events and of lastError', async () => {
      deps.host.open = vi.fn(async () => {
        throw new Error(`user data rejected: BEACON_TOKEN=${secret}`);
      });
      deps.host.close = vi.fn(async () => {
        throw new Error(`could not destroy: SCW_SECRET_KEY=${secret}`);
      });
      await runStateChange(deps, WORLD_ID, provisioning());
      const applied = (deps.states.for(WORLD_ID).apply as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(applied.state).toBe('FAILED');
      expect(applied.lastError).not.toContain(secret);
      expect(applied.events.map((event: { type: string }) => event.type)).toEqual([
        'ProvisioningFailed',
        'CleanupFailed',
      ]);
      for (const event of applied.events) expect(event.detail).not.toContain(secret);
      expect(deps.journal.failure).toHaveBeenCalledWith({
        source: 'provisioning.cleanup',
        sessionId: 's1',
        error: `Error: could not destroy: SCW_SECRET_KEY=${secret}`,
      });
      expect(deps.journal.failure).toHaveBeenCalledTimes(2);
    });
```

Dans `apps/functions/src/immediate-pass.spec.ts`, ajouter à `provisionDeps` :

```ts
  journal: { failure: () => undefined },
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx run @beacon/functions:test`
Expected: FAIL, le détail de `ProvisioningFailed` porte le secret.

- [ ] **Step 3: Write minimal implementation**

Dans `apps/functions/src/provisioning.ts`, remplacer l'import de `sanitizeLastError` par :

```ts
import { expunged, type PlatformJournal } from './platform-journal.js';
```

ajouter à `ProvisionDeps` :

```ts
  readonly journal: PlatformJournal;
```

et, dans `failed`, remplacer `const detail = String(cause);` par :

```ts
  const detail = expunged(deps.journal, 'provisioning.setup', sessionId, cause);
```

les deux `lastError: sanitizeLastError(detail)` par `lastError: detail`, et le détail de `CleanupFailed` par :

```ts
          {
            type: 'CleanupFailed',
            sessionId,
            detail: expunged(deps.journal, 'provisioning.cleanup', sessionId, cleanupError),
          },
```

Dans `apps/functions/src/container.ts`, ajouter `journal: shared.journal,` à l'objet que `buildProvisionDeps` rend.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx run @beacon/functions:test` puis `npx nx run @beacon/functions:typecheck` puis `npx nx run @beacon/functions:lint`
Expected: PASS aux trois.

- [ ] **Step 5: Commit**

```bash
git add apps/functions/src/provisioning.ts apps/functions/src/provisioning.spec.ts apps/functions/src/immediate-pass.spec.ts apps/functions/src/container.ts
bash ~/.config/github-app/as-agent.sh git commit -m "fix(functions): expurge ce que la mise en place écrit d'un échec" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

---

### Task 4: `agentReport`

**Files:**
- Modify: `apps/functions/src/agent-report.ts`
- Modify: `apps/functions/src/agent-report.spec.ts`
- Modify: `apps/functions/src/container.ts` (`buildAgentReportDeps`)

**Interfaces:**
- Consumes: `expunged`, `PlatformJournal` de `./platform-journal.js` (tâche 1) ; `buildFirestoreDeps().journal` (tâche 1).
- Produces: `AgentReportDeps.journal: PlatformJournal`.

- [ ] **Step 1: Write the failing test**

Dans `apps/functions/src/agent-report.spec.ts`, ajouter à l'objet que `fakeDeps` rend, à côté de `host` :

```ts
    journal: { failure: vi.fn() },
```

Remplacer le test `sanitises lastError when the destruction itself is refused` par le premier test du bloc ci-dessous, et ajouter le bloc dans le `describe('agentReport', …)` :

```ts
  // An event detail and `lastError` are read by every member, and what a
  // provider or a game server answers can carry what the system entrusted to
  // it.
  describe('what a member reads of a failure', () => {
    const secret = 'a'.repeat(64);

    it('keeps a refused destruction out of the event and of lastError', async () => {
      deps = fakeDeps({ session: stoppingSession('s1') });
      deps.host.close = vi.fn(async () => {
        throw new Error(`could not destroy: BEACON_TOKEN=${secret}`);
      });
      await runAgentReport(deps, TOKEN, {
        sessionId: 's1',
        phase: 'saved',
        save: { objectKey: key('pre-shutdown', 's1'), sizeBytes: 50_000, origin: 'pre-shutdown' },
      });
      const correction = (deps.store.apply as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(correction.state).toBe('FAILED');
      expect(correction.lastError).not.toContain(secret);
      expect(correction.lastError).toContain('[redacted]');
      expect(correction.events[0].type).toBe('CleanupFailed');
      expect(correction.events[0].detail).not.toContain(secret);
      expect(deps.journal.failure).toHaveBeenCalledWith({
        source: 'agentReport.cleanup',
        sessionId: 's1',
        error: `Error: could not destroy: BEACON_TOKEN=${secret}`,
      });
    });

    it('keeps a refused dns update out of the event', async () => {
      deps.dns.point = vi.fn(async () => {
        throw new Error(`http 401 for https://user:${secret}@www.ovh.com/nic/update`);
      });
      await runAgentReport(deps, TOKEN, { sessionId: 's1', phase: 'ready' });
      const [event] = filed(deps);
      expect(event.type).toBe('DnsUpdateFailed');
      expect(event.detail).not.toContain(secret);
      expect(deps.journal.failure).toHaveBeenCalledWith({
        source: 'agentReport.dns',
        sessionId: 's1',
        error: `Error: http 401 for https://user:${secret}@www.ovh.com/nic/update`,
      });
    });

    it('keeps the key of a refused save out of the event', async () => {
      const foreignKey = `auto/another-world/2026-09-15T20-10-00Z-${secret}.tar.gz`;
      await runAgentReport(deps, TOKEN, {
        sessionId: 's1',
        phase: 'saved',
        save: { objectKey: foreignKey, sizeBytes: 50_000, origin: 'auto' },
      });
      const [event] = filed(deps);
      expect(event.type).toBe('SaveRefused');
      expect(event.detail).not.toContain(secret);
      expect(deps.journal.failure).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'agentReport.save', sessionId: 's1' }),
      );
      const [[entry]] = (deps.journal.failure as ReturnType<typeof vi.fn>).mock.calls;
      expect(entry.error).toContain(foreignKey);
    });

    it('keeps what a game server reports of its own failure out of the event', async () => {
      const reported = `restore refused: AWS_SECRET_ACCESS_KEY=${secret}`;
      await runAgentReport(deps, TOKEN, { sessionId: 's1', phase: 'failed', detail: reported });
      const [event] = filed(deps);
      expect(event.type).toBe('ProvisioningFailed');
      expect(event.detail).not.toContain(secret);
      expect(event.detail).toContain('[redacted]');
      expect(deps.journal.failure).toHaveBeenCalledWith({
        source: 'agentReport.machine',
        sessionId: 's1',
        error: reported,
      });
    });

    it('keeps what a running game server reports out of the event too', async () => {
      deps = fakeDeps({ session: runningSession('s1') });
      await runAgentReport(deps, TOKEN, {
        sessionId: 's1',
        phase: 'failed',
        detail: `push refused: ${secret}`,
      });
      const [event] = filed(deps);
      expect(event.type).toBe('AgentReportedFailure');
      expect(event.detail).not.toContain(secret);
    });

    it('journals nothing when the game server says nothing of its failure', async () => {
      await runAgentReport(deps, TOKEN, { sessionId: 's1', phase: 'failed' });
      expect(filed(deps)[0].detail).toBe('the machine reported a failure without saying which');
      expect(deps.journal.failure).not.toHaveBeenCalled();
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx run @beacon/functions:test`
Expected: FAIL, les détails portent le secret et `journal.failure` n'est pas appelé.

- [ ] **Step 3: Write minimal implementation**

Dans `apps/functions/src/agent-report.ts`, remplacer l'import de `sanitizeLastError` par :

```ts
import { expunged, type PlatformJournal } from './platform-journal.js';
```

ajouter à `AgentReportDeps` :

```ts
  readonly journal: PlatformJournal;
```

Dans `becomeRunning`, le détail de `DnsUpdateFailed` devient :

```ts
        detail: expunged(deps.journal, 'agentReport.dns', sessionId, error),
```

Dans `recordSave`, le détail de `SaveRefused` devient :

```ts
      detail: expunged(deps.journal, 'agentReport.save', sessionId, error),
```

Dans `destroy`, le `catch` devient :

```ts
  } catch (error) {
    const detail = expunged(deps.journal, 'agentReport.cleanup', sessionId, error);
    await state.apply(
      {
        state: 'FAILED',
        lastError: detail,
        clearFacts: false,
        deadline: null,
        closeIntents: [],
        events: [{ type: 'CleanupFailed', sessionId, detail }],
      },
      now,
    );
    return;
  }
```

`fileFailure` reçoit `deps` en premier paramètre, et son appel dans `runAgentReport` devient `await fileFailure(deps, state, session, report, now);`. Son calcul du détail devient :

```ts
  const detail =
    report.detail === undefined
      ? 'the machine reported a failure without saying which'
      : expunged(deps.journal, 'agentReport.machine', sessionId, report.detail);
```

Dans le commentaire de `boundedServerId`, remplacer « the same guarantee `sanitizeLastError` gives `lastError` » par « the same bound `sanitizeLastError` applies ».

Dans `apps/functions/src/container.ts`, ajouter `journal: shared.journal,` à l'objet que `buildAgentReportDeps` rend.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx run @beacon/functions:test` puis `npx nx run @beacon/functions:typecheck` puis `npx nx run @beacon/functions:lint`
Expected: PASS aux trois.

- [ ] **Step 5: Commit**

```bash
git add apps/functions/src/agent-report.ts apps/functions/src/agent-report.spec.ts apps/functions/src/container.ts
bash ~/.config/github-app/as-agent.sh git commit -m "fix(functions): expurge ce que agentReport écrit d'un échec" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

## Rulings log

Ruling: le détail `AgentContradicted` d'une adresse contredite passe par `expunged`, contre la contrainte du plan qui gelait ces détails — c'est un texte qu'un serveur de jeu a choisi, que le `Scope` du lot couvre, et une adresse légitime en sort inchangée — si c'est faux, une ligne de `agent-report.ts` et son test se retirent.

Ruling: le détail `AgentContradicted` d'un identifiant de serveur refusé passe par `expunged`, et l'identifiant entier va au journal de la plateforme — le commanditaire l'a décidé en revue : c'est un texte qu'un serveur de jeu a choisi, expurgé comme le reste de ce qu'il déclare — si c'est faux, un membre ne lit plus dans la trace quel identifiant a été refusé, et seul l'exploitant le retrouve.

Technical design ruling: l'adresse qu'un serveur de jeu déclare est expurgée, alors que la conception ne nomme que ce qu'il rapporte de son propre échec — le `Scope` du lot couvre tout ce qu'un serveur de jeu a répondu — si c'est faux, une adresse forgée redevient lisible entière dans la trace.

Technical design ruling: le journal de la plateforme reçoit le texte de l'erreur sans sa pile d'appels — le texte est ce que le détail et `lastError` recopiaient, et une pile ajoute du volume sans rien dire de la réponse du fournisseur — si c'est faux, l'exploitant ne lit pas dans le journal d'où l'erreur est partie.

Technical design ruling: un rapport d'échec sans détail n'écrit rien au journal de la plateforme — le texte écrit est alors une constante du code, qui ne porte aucune réponse — si c'est faux, le journal de la plateforme ne compte pas tous les échecs qu'un serveur de jeu rapporte.

## Observed drift
