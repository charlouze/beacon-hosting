# La vérification préalable Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Une mise en place commence par une vérification préalable, qui réussit toujours, avant qu'aucun serveur de jeu soit créé ; une session qu'on ferme pendant cette vérification cesse d'être en cours dès qu'elle se termine, sans serveur et sans abandon ; l'écran montre la vérification en cours, et l'abandon qui s'y arrête.

**Architecture:** `libs/session` gagne la transition d'une session fermée avant tout serveur, une méthode de l'agrégat `Session` dont la décision s'écrit en `StateCorrection` par une seule fonction, que la Function et la surveillance appellent. `libs/session-record` rend conditionnelles la garde de la première étape et une application de correction : une transaction relit `server/current` et n'écrit que si la session est toujours celle-ci, dans l'état attendu. La Function `provision` termine la vérification préalable par la garde conditionnelle de la première étape, à l'heure où elle réussit, et n'appelle l'hébergeur qu'après elle ; elle remet hors service une session fermée pendant la vérification, ou avant sa revendication. La surveillance remet hors service, sans fermer chez l'hébergeur, une session en fermeture passé son délai pour qui aucune étape n'est gardée et que l'hébergeur ne porte pas. `ShownSetup` devient soit la vérification préalable, soit une étape, et l'écran suit la maquette `.impeccable/mocks/preflight/`.

**Tech Stack:** TypeScript, Vitest, Nx, Angular, `firebase-admin`, émulateur Firestore.

**Spec:** docs/specs/session.md
**Batch:** docs/batches/04-copie-du-jeu-en-retard/README.md
**Sections:** Ubiquitous language, Opening a session, Closing a session, The life of a session
**Blocks:** D1, D2, D5, D6, D7

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

### Ce que la story ne livre pas

La vérification préalable ne lit rien et réussit toujours : la lecture chez
l'éditeur, les deux cas d'échec, la cause portée par la marque d'abandon et
`gameCopies/{game}` côté Function appartiennent à la story qui transcrit D3.
L'annonce avant l'ouverture appartient à celle qui transcrit D4.

L'écran de fermeture ne change pas, même pour une session fermée pendant la
vérification : décidé au tour `.impeccable/mocks/preflight/`.

### Commandes

Chaque tâche lance ses tests par Nx, `supercharlouze` n'en change rien :
`npx nx test session`, `npx nx test session-record` et `npx nx test functions`
tournent contre l'émulateur Firestore que leur cible démarre elle-même,
`npx nx test web` sans émulateur. Avant le commit d'une tâche :
`npx nx run-many -t lint test -p <projets touchés>`. Prettier ne tourne pas sur
les sources.

## Review Focus

- Une session en service qu'on ferme est revendiquée : la Function ne doit jamais la remettre hors service sans fermer son serveur. Épinglé en tâche 3.
- Le déclencheur livre deux fois la même fermeture : la seconde trouve la session hors service et n'écrit rien. Épinglé en tâche 2 (`applyIf` refusé) et en tâche 3.
- Le document de la mise en place est illisible ou absent pour une session en fermeture dont l'hébergeur porte un serveur : la surveillance doit fermer ce serveur. Épinglé en tâche 4.
- Une ouverture suit immédiatement une session remise hors service sans serveur : elle doit pouvoir être revendiquée. Épinglé en tâche 2.
- Une session fermée entre la revendication et la garde de la première étape : aucun jeton, aucune intention au registre, aucun appel à l'hébergeur. Épinglé en tâche 3.

---

### Task 1: La fin d'une session sans serveur, dans le domaine

**Files:**
- Modify: `libs/session/src/lib/session-aggregate.ts`
- Create: `libs/session/src/lib/ended-without-server.ts`
- Modify: `libs/session/src/index.ts`
- Test: `libs/session/src/lib/session-aggregate.spec.ts`, `libs/session/src/lib/ended-without-server.spec.ts`

**Interfaces:**
- Produces: `Session.prototype.endWithoutServer(): SessionDecision` — refuse (`throw`) hors de `STOPPING` ; rend une session hors service et un unique `SessionStopped` à coût nul.
- Produces: `endedWithoutServer(session: Session): StateCorrection` — exportée par `@beacon/session`.

- [ ] **Step 1: Write the failing tests**

Dans `session-aggregate.spec.ts`, à côté des tests de `requestStop`, avec les
fabriques de session que ce fichier emploie déjà :

```ts
describe('endWithoutServer', () => {
  it('puts a session closed before any server out of service, at no cost', () => {
    const decision = stopping().endWithoutServer();

    expect(decision.session.state).toBe('IDLE');
    expect(decision.events).toEqual([
      {
        type: 'SessionStopped',
        sessionId: SESSION_ID,
        detail: 'closed before any server was created',
        costEuros: 0,
      },
    ]);
  });

  it.each(['PROVISIONING', 'RUNNING'] as const)('refuses a %s session', (state) => {
    expect(() => sessionIn(state).endWithoutServer()).toThrow();
  });

  it('refuses when no session is open', () => {
    expect(() => Session.idle().endWithoutServer()).toThrow();
  });
});
```

`stopping()`, `sessionIn(state)` et `SESSION_ID` désignent les fabriques et
l'identifiant que le fichier définit déjà ; s'il n'en a pas, les écrire en tête
du fichier, comme `provisioningSession` dans `apps/functions/src/provisioning.spec.ts`.

Créer `ended-without-server.spec.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { Deadline } from './deadline.js';
import { endedWithoutServer } from './ended-without-server.js';
import { Session } from './session-aggregate.js';

const stopping = () =>
  Session.from({
    state: 'STOPPING',
    sessionId: 's1',
    worldId: 'les-copains',
    game: 'enshrouded',
    startedBy: 'u1',
    startedAt: new Date('2026-10-15T20:00:00Z'),
    deadline: Deadline.at(new Date('2026-10-16T00:00:00Z')),
    instanceSize: null,
    hasJoinInfo: false,
  });

describe('endedWithoutServer', () => {
  it('writes the session out of service, empties what the claim set, and files its stop', () => {
    expect(endedWithoutServer(stopping())).toEqual({
      state: 'IDLE',
      lastError: null,
      clearFacts: true,
      closeIntents: [],
      events: [
        {
          type: 'SessionStopped',
          sessionId: 's1',
          detail: 'closed before any server was created',
          costEuros: 0,
        },
      ],
      deadline: null,
      abandonedSetup: null,
    });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx nx test session`
Expected: FAIL, `endWithoutServer` and `endedWithoutServer` do not exist.

- [ ] **Step 3: Implement**

Dans `session-aggregate.ts`, après `requestStop` :

```ts
  /**
   * A session closed while its setup had created nothing ceases to be under
   * way once that setup ends. No server, so no hour is due.
   */
  endWithoutServer(): SessionDecision {
    const fields = this.required();
    if (fields.state !== 'STOPPING') {
      throw new Error(`cannot end a ${fields.state} session without a server`);
    }
    return {
      session: Session.idle(),
      events: [
        {
          type: 'SessionStopped',
          sessionId: fields.sessionId,
          detail: 'closed before any server was created',
          costEuros: 0,
        },
      ],
    };
  }
```

Créer `ended-without-server.ts` :

```ts
import type { Session } from './session-aggregate.js';
import type { StateCorrection } from './watchdog/reconcile.js';

/**
 * What `server/current` becomes when a session closed before any server ends.
 * The Function and the watchdog both write it, and it is written here once.
 */
export function endedWithoutServer(session: Session): StateCorrection {
  const { events } = session.endWithoutServer();
  return {
    state: 'IDLE',
    lastError: null,
    // What the claim set goes with it, or the next opening could not claim.
    clearFacts: true,
    closeIntents: [],
    events,
    deadline: null,
    abandonedSetup: null,
  };
}
```

Ajouter `export * from './lib/ended-without-server.js';` à `libs/session/src/index.ts`, dans l'ordre alphabétique des lignes voisines.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx nx run-many -t lint test -p session`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/session/src
git commit -m "feat(session): termine sans serveur une session fermée avant d'en avoir un"
```

---

### Task 2: Des écritures conditionnelles à la session attendue

**Files:**
- Modify: `libs/session-record/src/lib/server-state.ts`
- Modify: `libs/session-record/src/lib/setup-record.ts`
- Modify: les faux `ServerStateStore` et `SetupStore` des specs : `apps/functions/src/provisioning.spec.ts`, `apps/functions/src/agent-report.spec.ts`, `apps/functions/src/watchdog.spec.ts`, et tout autre fichier que `grep -rln "claimProvisioning:\|begin: vi.fn" apps libs --include=*.spec.ts` trouve
- Test: `libs/session-record/src/lib/server-state.spec.ts`, `libs/session-record/src/lib/setup-record.spec.ts`

**Interfaces:**
- Consumes: `endedWithoutServer` (tâche 1), pour les tests.
- Produces, dans `@beacon/session-record` :

```ts
export interface ExpectedSession {
  readonly sessionId: SessionId;
  readonly state: SessionState;
  /** When true, the session must not have been claimed for provisioning. */
  readonly unclaimed?: boolean;
}

// ServerStateStore gains:
  /**
   * `apply`, in one transaction that reads `server/current` again and writes
   * only if it still holds `expected`. False when it does not, and then nothing
   * is written.
   */
  applyIf(expected: ExpectedSession, correction: StateCorrection, at: Date): Promise<boolean>;

// SetupStore.begin becomes:
  /**
   * Keeps the first step from `since`, rewriting the whole document, only while
   * the world still holds this session preparing. False when it does not, and
   * then nothing is written.
   */
  begin(sessionId: SessionId, order: SetupStepOrder, since: Date): Promise<boolean>;
```

- [ ] **Step 1: Write the failing tests**

Dans `server-state.spec.ts`, un `describe('applying under a condition')`, sur le
monde et les fabriques que le fichier emploie déjà. Les cas :

```ts
describe('applying under a condition', () => {
  it('writes the correction and its events while the session is the expected one', async () => {
    await seed({ state: 'STOPPING', sessionId: 's1', provisionClaimedAt: null });

    const applied = await store.applyIf(
      { sessionId: 's1', state: 'STOPPING' },
      endedWithoutServer(stoppingSession('s1')),
      AT,
    );

    expect(applied).toBe(true);
    expect((await serverDoc()).state).toBe('IDLE');
    expect(await eventsOf('s1')).toEqual([
      expect.objectContaining({ type: 'SessionStopped', costEuros: 0 }),
    ]);
  });

  it('writes nothing when the world holds another session', async () => {
    await seed({ state: 'STOPPING', sessionId: 's2', provisionClaimedAt: null });
    expect(
      await store.applyIf({ sessionId: 's1', state: 'STOPPING' }, endedWithoutServer(stoppingSession('s1')), AT),
    ).toBe(false);
    expect((await serverDoc()).state).toBe('STOPPING');
    expect(await eventsOf('s1')).toEqual([]);
  });

  it('writes nothing when the session is in another state', async () => {
    await seed({ state: 'IDLE', sessionId: 's1', provisionClaimedAt: null });
    expect(
      await store.applyIf({ sessionId: 's1', state: 'STOPPING' }, endedWithoutServer(stoppingSession('s1')), AT),
    ).toBe(false);
  });

  it('writes nothing for a claimed session when the condition wants it unclaimed', async () => {
    await seed({ state: 'STOPPING', sessionId: 's1', provisionClaimedAt: CLAIMED_AT });
    expect(
      await store.applyIf(
        { sessionId: 's1', state: 'STOPPING', unclaimed: true },
        endedWithoutServer(stoppingSession('s1')),
        AT,
      ),
    ).toBe(false);
    expect((await serverDoc()).state).toBe('STOPPING');
  });

  it('releases the claim, so the next opening can claim it', async () => {
    await seed({ state: 'STOPPING', sessionId: 's1', provisionClaimedAt: CLAIMED_AT });
    await store.applyIf({ sessionId: 's1', state: 'STOPPING' }, endedWithoutServer(stoppingSession('s1')), AT);
    await seed({ state: 'PROVISIONING', sessionId: 's2' }, { merge: true });

    expect(await store.claimProvisioning('s2', AT)).toBe(true);
  });
});
```

`seed`, `serverDoc`, `eventsOf`, `stoppingSession`, `AT` et `CLAIMED_AT` sont
à écrire avec les mêmes moyens que les tests voisins du fichier (il lit et écrit
déjà `server/current` et la collection des événements de l'émulateur) ; ne pas
inventer une seconde façon de semer le document.

Dans `setup-record.spec.ts`, les tests existants appellent `begin` sans
`server/current` : leur `beforeEach` sème désormais `server/current` en
`PROVISIONING` pour `s1`. Puis :

```ts
describe('beginning a setup', () => {
  it('keeps the first step from the instant it is given, and says so', async () => {
    expect(await store.begin('s1', ORDER, SINCE)).toBe(true);
    expect(await store.read()).toEqual({
      sessionId: 's1',
      order: ORDER,
      step: { step: 'waking', since: SINCE, activity: null, progress: null },
    });
  });

  it.each(['STOPPING', 'IDLE', 'RUNNING'] as const)('keeps nothing once the session is %s', async (state) => {
    await seedServer({ state, sessionId: 's1' });
    expect(await store.begin('s1', ORDER, SINCE)).toBe(false);
    expect(await store.read()).toBeNull();
  });

  it('keeps nothing when the world holds another session', async () => {
    await seedServer({ state: 'PROVISIONING', sessionId: 's2' });
    expect(await store.begin('s1', ORDER, SINCE)).toBe(false);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx nx test session-record`
Expected: FAIL, `applyIf` does not exist and `begin` returns `undefined`.

- [ ] **Step 3: Implement**

Dans `server-state.ts`, sortir de `apply` la construction du patch dans une
fonction du module, puis s'en servir deux fois :

```ts
/** What a correction writes on `server/current`, as fields. */
function correctionPatch(correction: StateCorrection, at: Date): Record<string, unknown> {
  // The body of `apply` that builds `patch` today, moved as it is, comments included.
}
```

`apply` garde son comportement : `batch.set(serverDoc(), patch, { merge: true })`
si le patch n'est pas vide, puis les événements, en un `batch.commit()`.

```ts
    async applyIf(expected, correction, at): Promise<boolean> {
      return db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(serverDoc());
        const data = snapshot.data() ?? {};
        if (data['sessionId'] !== expected.sessionId) return false;
        if (data['state'] !== expected.state) return false;
        if (expected.unclaimed === true && (data['provisionClaimedAt'] ?? null) !== null) return false;

        const patch = correctionPatch(correction, at);
        if (Object.keys(patch).length > 0) transaction.set(serverDoc(), patch, { merge: true });
        for (const event of correction.events) {
          transaction.set(db.collection(EVENTS).doc(), eventDocument(event, at, worldId));
        }
        return true;
      });
    },
```

Exporter `ExpectedSession` depuis `server-state.ts`.

Dans `setup-record.ts`, `begin` devient :

```ts
        async begin(sessionId, order, since): Promise<boolean> {
          return db.runTransaction(async (transaction) => {
            const server = (await transaction.get(serverDoc())).data() ?? {};
            if (server['sessionId'] !== sessionId) return false;
            if (server['state'] !== 'PROVISIONING') return false;
            transaction.set(setupDoc(), {
              sessionId,
              stepOrder: [...order],
              ...stepFields(firstSetupStep(since)),
            });
            return true;
          });
        },
```

Faux magasins des specs : chaque faux `ServerStateStore` gagne
`applyIf: vi.fn(async () => false)`, chaque faux `SetupStore` voit son `begin`
rendre `true` (`vi.fn(async () => true)`). Aucun autre changement dans ces
fichiers à cette tâche.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx nx run-many -t lint test -p session-record functions`
Expected: PASS. `functions` passe sans changement de comportement : `provision`
ignore encore ce que `begin` rend.

- [ ] **Step 5: Commit**

```bash
git add libs/session-record/src apps/functions/src
git commit -m "feat(session-record): n'écrit la première étape et une correction que pour la session attendue"
```

---

### Task 3: La Function termine la vérification préalable

**Files:**
- Modify: `apps/functions/src/provisioning.ts`
- Test: `apps/functions/src/provisioning.spec.ts`

**Interfaces:**
- Consumes: `endedWithoutServer(session)` (tâche 1) ; `ServerStateStore.applyIf`, `SetupStore.begin(): Promise<boolean>` (tâche 2).
- Produces: `runStateChange(deps, worldId, session): Promise<boolean>` garde sa signature. Sur `PROVISIONING` : revendication, garde conditionnelle de la première étape à `deps.clock.now()`, puis la suite d'aujourd'hui. Sur `STOPPING` : remise hors service d'une session jamais revendiquée.

- [ ] **Step 1: Write the failing tests**

Dans `provisioning.spec.ts`, avec les faux d'aujourd'hui :

- `begins the setup with the order of the game, since the opening of the session` devient `keeps the first step from the instant the preflight check passed` : un `clock` dont le premier `now()` rend `NOW` et les suivants `NOW + 2 s`, et `begin` attendu avec ce second instant.
- `opens the server when the setup could not begin, and journals why` s'inverse :

```ts
  // The first step kept is what ends the preflight check: no step, no server.
  it('calls no provider when the first step could not be kept, and journals why', async () => {
    vi.mocked(deps.setups.for(WORLD_ID).begin).mockRejectedValue(new Error('firestore is down'));

    expect(await runStateChange(deps, WORLD_ID, provisioning())).toBe(false);

    expect(deps.tokens.issue).not.toHaveBeenCalled();
    expect(deps.ledger.open).not.toHaveBeenCalled();
    expect(deps.host.open).not.toHaveBeenCalled();
    expect(deps.journal.failure).toHaveBeenCalledWith({
      source: 'provisioning.begin',
      sessionId: 's1',
      error: 'Error: firestore is down',
    });
  });
```

- Nouveaux cas, sous `describe('a session closed during its preflight check')` :

```ts
  it('ends it without a server when it was closed before the first step was kept', async () => {
    const state = deps.states.for(WORLD_ID);
    vi.mocked(deps.setups.for(WORLD_ID).begin).mockResolvedValue(false);
    vi.mocked(state.readSession).mockResolvedValue(stopping());
    vi.mocked(state.applyIf).mockResolvedValue(true);

    expect(await runStateChange(deps, WORLD_ID, provisioning())).toBe(true);

    expect(state.applyIf).toHaveBeenCalledWith(
      { sessionId: 's1', state: 'STOPPING' },
      endedWithoutServer(stopping()),
      NOW,
    );
    expect(deps.tokens.issue).not.toHaveBeenCalled();
    expect(deps.ledger.open).not.toHaveBeenCalled();
    expect(deps.host.open).not.toHaveBeenCalled();
    expect(state.apply).not.toHaveBeenCalled();
  });

  it('stops when the world moved on to another session meanwhile', async () => {
    const state = deps.states.for(WORLD_ID);
    vi.mocked(deps.setups.for(WORLD_ID).begin).mockResolvedValue(false);
    vi.mocked(state.readSession).mockResolvedValue(provisioningSession('s2', WORLD_ID, 'enshrouded'));

    await runStateChange(deps, WORLD_ID, provisioning());

    expect(state.applyIf).not.toHaveBeenCalled();
    expect(deps.host.open).not.toHaveBeenCalled();
  });
```

- `describe('stopping')` est récrit :

```ts
describe('stopping', () => {
  // Closed before the Function claimed it: nothing was asked of anyone.
  it('ends a session that was never claimed, without a server', async () => {
    const state = deps.states.for(WORLD_ID);
    vi.mocked(state.applyIf).mockResolvedValue(true);

    expect(await runStateChange(deps, WORLD_ID, stopping())).toBe(true);

    expect(state.applyIf).toHaveBeenCalledWith(
      { sessionId: 's1', state: 'STOPPING', unclaimed: true },
      endedWithoutServer(stopping()),
      NOW,
    );
    expect(deps.host.close).not.toHaveBeenCalled();
  });

  // A claimed session may have a server, and its destruction waits for the
  // agent to report saved (agent-report.ts): nothing here may end it.
  it('leaves a claimed session to the agent and the watchdog', async () => {
    const state = deps.states.for(WORLD_ID);
    vi.mocked(state.applyIf).mockResolvedValue(false);

    expect(await runStateChange(deps, WORLD_ID, stopping())).toBe(false);

    expect(deps.host.close).not.toHaveBeenCalled();
    expect(state.apply).not.toHaveBeenCalled();
    expect(deps.ledger.close).not.toHaveBeenCalled();
  });
});
```

- `what the caller learns` et `every other state` sortent `STOPPING` de leurs `it.each`, que le `describe('stopping')` couvre désormais.

- Contre l'émulateur, un `describe('against the emulator')` qui monte `worldStateStores` et `setupStores` sur `getFirestore(defaultApp())`, comme `describe('the steam ids the game is told about')` monte les membres, garde des faux pour l'hébergeur, le registre et les jetons, et sème `worlds/les-copains` et son `server/current` :

```ts
  it('never calls the provider when the session is closed between its claim and its first step', async () => {
    // The member closes it right after the claim, the way the browser writes STOPPING.
    const real = live.states.for(WORLD_ID);
    const claim = real.claimProvisioning.bind(real);
    live.states = {
      ...live.states,
      for: () => ({
        ...real,
        claimProvisioning: async (sessionId, at) => {
          const claimed = await claim(sessionId, at);
          await db.doc(serverDocPath(WORLD_ID)).update({ state: 'STOPPING' });
          return claimed;
        },
      }),
    };

    await runStateChange(live, WORLD_ID, provisioning());

    const server = (await db.doc(serverDocPath(WORLD_ID)).get()).data() ?? {};
    expect(server['state']).toBe('IDLE');
    expect(server['provisionClaimedAt']).toBeNull();
    expect(server['abandonedSetup'] ?? null).toBeNull();
    expect(server['lastError'] ?? null).toBeNull();
    expect(live.host.open).not.toHaveBeenCalled();
    expect(live.tokens.issue).not.toHaveBeenCalled();
    expect(live.ledger.open).not.toHaveBeenCalled();
    expect(await setupStores(db).for(WORLD_ID).read()).toBeNull();
  });

  it('ends a session closed before its claim, and lets the next opening claim', async () => {
    await seedServer({ state: 'STOPPING', sessionId: 's1', provisionClaimedAt: null });

    await runStateChange(live, WORLD_ID, stopping());

    expect((await db.doc(serverDocPath(WORLD_ID)).get()).data()?.['state']).toBe('IDLE');
    await seedServer({ state: 'PROVISIONING', sessionId: 's2' });
    expect(await live.states.for(WORLD_ID).claimProvisioning('s2', NOW)).toBe(true);
  });

  it('writes nothing on a second delivery of the same closing', async () => {
    await seedServer({ state: 'STOPPING', sessionId: 's1', provisionClaimedAt: null });
    await runStateChange(live, WORLD_ID, stopping());

    expect(await runStateChange(live, WORLD_ID, stopping())).toBe(false);
    expect(await stoppedEvents('s1')).toHaveLength(1);
  });

  it('leaves alone a session in service that is being closed', async () => {
    await seedServer({ state: 'STOPPING', sessionId: 's1', provisionClaimedAt: NOW, ip: '51.15.42.7' });

    expect(await runStateChange(live, WORLD_ID, stopping())).toBe(false);
    expect((await db.doc(serverDocPath(WORLD_ID)).get()).data()?.['state']).toBe('STOPPING');
  });
```

`live`, `seedServer` et `stoppedEvents` s'écrivent en tête de ce `describe` :
`live` est un `fakeDeps()` dont `states` et `setups` sont les vrais magasins ;
`seedServer` écrit `idleServerDocument(NOW)` fusionné avec ce qu'on lui donne ;
`stoppedEvents` lit les événements `SessionStopped` de la session. Chaque test
repart d'un émulateur vide pour ce monde, comme les tests de l'émulateur voisins.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx nx test functions`
Expected: FAIL sur les cas nouveaux et récrits.

- [ ] **Step 3: Implement**

`provisioning.ts` :

```ts
export async function runStateChange(
  deps: ProvisionDeps,
  worldId: WorldId,
  session: Session,
): Promise<boolean> {
  if (session.state === 'PROVISIONING') return provision(deps, worldId, session);
  if (session.state === 'STOPPING') return endIfNeverClaimed(deps, worldId, session);
  return false;
}
```

Le commentaire de `runStateChange` garde ce qu'il dit de la destruction, qui
attend toujours le rapport `saved` de l'agent, et dit en plus qu'une session
jamais revendiquée n'a rien à détruire et cesse ici d'être en cours.

Dans `provision`, entre la revendication et `const size = …` :

```ts
  // The preflight check. It always passes for now, and the first step kept is
  // its end: no step, no token, no intent, no server.
  const begun = await beginSetup(deps, worldId, sessionId, game);
  if (begun === 'failed') return false;
  if (begun === 'refused') return endIfClosed(deps, worldId, sessionId);
```

```ts
/**
 * Keeps the first step from the instant the preflight check passed, on the
 * condition that the session is still preparing.
 */
async function beginSetup(
  deps: ProvisionDeps,
  worldId: WorldId,
  sessionId: SessionId,
  game: Game,
): Promise<'begun' | 'refused' | 'failed'> {
  try {
    const begun = await deps.setups
      .for(worldId)
      .begin(sessionId, catalogFor(game).setupStepOrder, deps.clock.now());
    return begun ? 'begun' : 'refused';
  } catch (error) {
    // The session stays preparing with no server, until the delay abandons it.
    deps.journal.failure({ source: 'provisioning.begin', sessionId, error: String(error) });
    return 'failed';
  }
}

/** A member closed it during the preflight check: it ends there, with no server. */
async function endIfClosed(deps: ProvisionDeps, worldId: WorldId, sessionId: SessionId): Promise<boolean> {
  const state = deps.states.for(worldId);
  const session = await state.readSession();
  if (session === null || session.sessionId !== sessionId || session.state !== 'STOPPING') return false;
  return state.applyIf({ sessionId, state: 'STOPPING' }, endedWithoutServer(session), deps.clock.now());
}

/**
 * Closed before the Function claimed it. The claim alone says no step was
 * kept, since a step is kept only after a claim.
 */
async function endIfNeverClaimed(deps: ProvisionDeps, worldId: WorldId, session: Session): Promise<boolean> {
  const sessionId = session.sessionId;
  if (sessionId === null) return false;
  return deps.states
    .for(worldId)
    .applyIf({ sessionId, state: 'STOPPING', unclaimed: true }, endedWithoutServer(session), deps.clock.now());
}
```

Le paramètre `openedAt` de `beginSetup` et l'appel `session.startedAt ?? now`
disparaissent. Importer `endedWithoutServer` et `SessionId` de `@beacon/session`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx nx run-many -t lint test -p functions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/functions/src/provisioning.ts apps/functions/src/provisioning.spec.ts
git commit -m "feat(functions): commence la mise en place par une vérification préalable"
```

---

### Task 4: La surveillance rattrape une fermeture sans serveur

**Files:**
- Modify: `libs/session/src/lib/watchdog/view.ts`, `libs/session/src/lib/watchdog/reclamations.ts`, `libs/session/src/lib/watchdog/reconcile.ts`
- Modify: `apps/functions/src/watchdog.ts`, `apps/functions/src/container.ts`
- Modify: tout littéral `WorldView` et tout appel `reconcileWorld(` des specs (`grep -rn "reconcileWorld(\|server: null, session: null\|WorldView" libs apps --include=*.ts`)
- Test: `libs/session/src/lib/watchdog/reclamations.spec.ts`, `libs/session/src/lib/watchdog/reconcile.spec.ts`, `apps/functions/src/watchdog.spec.ts`

**Interfaces:**
- Consumes: `endedWithoutServer(session)` (tâche 1).
- Produces:

```ts
// view.ts, WorldView gains:
  /**
   * Whether the setup kept names this world's session. Without it no server
   * was ever asked for: the first step kept is what lets the Function call
   * the provider.
   */
  readonly stepKept: boolean;

// reclamations.ts:
/** A session closed before any server, past its stopping delay, that the provider holds nothing for. */
export interface EndWithoutServer {
  readonly worldId: WorldId;
  readonly sessionId: SessionId;
}

export interface WatchdogDecision {
  readonly destroy: readonly Reclamation[];
  readonly expired: readonly Expiration[];
  /** What must go out of service without anything to close. */
  readonly endWithoutServer: readonly EndWithoutServer[];
}

// reconcile.ts:
export function reconcileWorld(
  view: WatchdogView,
  world: WorldView,
  outcomes: readonly ReclaimOutcome[],
  expired: readonly Expiration[],
  endWithoutServer: readonly EndWithoutServer[],
): StateCorrection;

// watchdog.ts, WatchdogDeps gains:
  readonly setups: SetupStores;
```

- [ ] **Step 1: Write the failing tests**

`reclamations.spec.ts`, avec les fabriques de vue du fichier :

```ts
describe('a session closed before any server', () => {
  it('goes out of service without a destruction once its stopping delay is past', () => {
    const view = viewWith(world({ state: 'STOPPING', sessionId: 's1', stateSince: elevenMinutesAgo, stepKept: false }));

    expect(reclamations(view, DEFAULT_LIMITS)).toEqual({
      destroy: [],
      expired: [],
      endWithoutServer: [{ worldId: WORLD_ID, sessionId: 's1' }],
    });
  });

  it('waits like any other until its stopping delay is past', () => {
    const view = viewWith(world({ state: 'STOPPING', sessionId: 's1', stateSince: nineMinutesAgo, stepKept: false }));
    expect(reclamations(view, DEFAULT_LIMITS).endWithoutServer).toEqual([]);
  });

  it('is destroyed as today when a step was kept for it', () => {
    const view = viewWith(world({ state: 'STOPPING', sessionId: 's1', stateSince: elevenMinutesAgo, stepKept: true }));
    expect(reclamations(view, DEFAULT_LIMITS).destroy).toEqual([
      expect.objectContaining({ sessionId: 's1', reason: 'stopping-timeout' }),
    ]);
  });

  // What is kept can be unreadable: a server the provider holds is closed all the same.
  it('is destroyed as today when the provider holds a server for it', () => {
    const view = viewWith(
      world({ state: 'STOPPING', sessionId: 's1', stateSince: elevenMinutesAgo, stepKept: false }),
      { hosted: [hosted('s1')] },
    );
    expect(reclamations(view, DEFAULT_LIMITS)).toEqual(
      expect.objectContaining({
        destroy: [expect.objectContaining({ sessionId: 's1', reason: 'stopping-timeout' })],
        endWithoutServer: [],
      }),
    );
  });
});
```

`reconcile.spec.ts` :

```ts
describe('a session closed before any server', () => {
  it('writes it out of service, with no error and a stop at no cost', () => {
    const record = world({ state: 'STOPPING', sessionId: 's1', stepKept: false });
    expect(reconcileWorld(view, record, [], [], [{ worldId: WORLD_ID, sessionId: 's1' }])).toEqual(
      endedWithoutServer(record.session as Session),
    );
  });
});
```

Les appels existants de `reconcileWorld` prennent `[]` en cinquième argument,
les littéraux `WorldView` `stepKept: true` (le cas d'aujourd'hui : une session
qui a un serveur a gardé une étape), sauf `UNCLAIMED_WORLD` qui prend `false`.

`watchdog.spec.ts`, contre l'émulateur comme le fichier le fait déjà :

```ts
  it('ends a session closed during its preflight check without asking the provider to close anything', async () => {
    await seedServer({ state: 'STOPPING', sessionId: 's1', stateSince: elevenMinutesAgo, provisionClaimedAt: CLAIMED });
    // No setup document for s1: no step was kept.

    await runWatchdog(deps);

    expect(host.close).not.toHaveBeenCalled();
    const server = await serverOf(WORLD_ID);
    expect(server['state']).toBe('IDLE');
    expect(server['lastError'] ?? null).toBeNull();
    expect(await eventsOf('s1')).toContainEqual(
      expect.objectContaining({ type: 'SessionStopped', costEuros: 0 }),
    );
  });

  it('closes as today a session whose step was kept', async () => {
    await seedServer({ state: 'STOPPING', sessionId: 's1', stateSince: elevenMinutesAgo, provisionClaimedAt: CLAIMED });
    await seedSetup('s1');

    await runWatchdog(deps);

    expect(host.close).toHaveBeenCalledWith('s1');
  });
```

`seedServer`, `seedSetup`, `serverOf`, `eventsOf`, `CLAIMED` et
`elevenMinutesAgo` suivent ce que le fichier sème et lit déjà ; `seedSetup`
passe par `setupStores(db).for(WORLD_ID).begin` sur un `server/current` en
`PROVISIONING`, puis remet l'état voulu.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx nx run-many -t test -p session functions`
Expected: FAIL.

- [ ] **Step 3: Implement**

`reclamations.ts`, dans la boucle sur les mondes, branche `else` :

```ts
      const stuck = stuckReason(world, view.now, limits);
      if (stuck !== null && sessionId != null) {
        const held = view.hosted.find((server) => server.sessionId === sessionId);
        // No step kept means no server was asked for; the provider confirms it.
        // Either one missing, and it is closed as any stuck closing is.
        if (stuck === 'stopping-timeout' && !world.stepKept && held === undefined) {
          endWithoutServer.push({ worldId: world.worldId, sessionId });
        } else {
          bySession.set(sessionId, { sessionId, reason: stuck, detail: held?.summary ?? NOTHING_HELD });
        }
      }
```

et `return { destroy: [...bySession.values()], expired, endWithoutServer };`.

`reconcile.ts`, dans `reconcileWorld`, juste après le bloc `if (own !== undefined) { … }` :

```ts
  if (
    record.state === 'STOPPING' &&
    world.session !== null &&
    world.session.state === 'STOPPING' &&
    endWithoutServer.some((e) => e.sessionId === record.sessionId)
  ) {
    const ending = endedWithoutServer(world.session);
    return { ...ending, closeIntents, events: [...events, ...ending.events] };
  }
```

`watchdog.ts` : `readWorld(states, setups, worldId)` lit aussi
`setups.for(worldId).read()` dans le même `Promise.all`, et
`stepKept = kept !== null && server !== null && kept.sessionId === server.sessionId`.
`UNCLAIMED_WORLD` prend `stepKept: false`. Chaque appel de `reconcileWorld`
reçoit `decision.endWithoutServer.filter((e) => e.worldId === world.worldId)`,
et `[]` pour le monde non réclamé. `container.ts` : `buildFirestoreDeps` gagne
`setups: setupStores(db)`, et le doublon `setups` de `buildProvisionDeps`, s'il
en devient un, se retire.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx nx run-many -t lint test -p session functions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/session/src apps/functions/src
git commit -m "feat(session): rattrape sans fermeture une session fermée avant d'avoir un serveur"
```

---

### Task 5: L'écran montre la vérification préalable

**Files:**
- Modify: `libs/session/src/lib/setup.ts`
- Modify: `apps/web/src/app/format.ts`, `apps/web/src/app/session/preparing.component.ts`, `apps/web/src/app/session/preparing.component.css`, `apps/web/src/app/session/out-of-service.component.ts`, `apps/web/src/app/session/not-cleared.component.ts`
- Modify: `apps/functions/src/screen.ts`, `mise.toml`
- Already written: `.impeccable/mocks/preflight/` (planche et décisions du tour), commitée avec cette tâche
- Test: `libs/session/src/lib/setup.spec.ts`, `apps/web/src/app/format.spec.ts`, `apps/web/src/app/session/preparing.component.spec.ts`, `apps/web/src/app/session/out-of-service.component.spec.ts`, `apps/web/src/app/session/not-cleared.component.spec.ts`, `apps/functions/src/screen.spec.ts`

**Interfaces:**
- Consumes: `SetupStore.begin(sessionId, order, since): Promise<boolean>` (tâche 2), dans `screen.ts`.
- Produces, dans `@beacon/session` :

```ts
/** The preflight check, before any step. */
export interface ShownPreflight {
  readonly stage: 'preflight';
  /** The opening of the session: the check begins with it. */
  readonly since: Date;
  readonly abandonedAt: Date | null;
}

/** A step, in the order of its game. */
export interface ShownStep {
  readonly stage: 'step';
  readonly step: KeptSetupStep;
  readonly order: SetupStepOrder;
  readonly abandonedAt: Date | null;
}

export type ShownSetup = ShownPreflight | ShownStep;

export function setupStepRank(shown: ShownStep): number;
export function firstSetupStep(since: Date): KeptSetupStep;
```

- Produces, dans `apps/web/src/app/format.ts` :

```ts
export type StoppedAt =
  | { readonly stage: 'preflight'; readonly at: string }
  | { readonly stage: 'step'; readonly at: string; readonly rank: number; readonly total: number; readonly name: string };
```

Les mots viennent du tour `.impeccable/mocks/preflight/README.md`, décidé :
`Before the first step`, `Preflight check`, `since` et l'heure ; après un
abandon, `Preflight check · before the first step` et `if it stops at the same
place twice` ; aucune ligne sous `Close it now` pendant la vérification.

- [ ] **Step 1: Write the failing tests**

`setup.spec.ts`, `describe('shownSetup')` :

- `shows the first step since the opening, and no order, while nothing is kept` devient :

```ts
  it('shows the preflight check since the opening while no step is kept', () => {
    expect(shownSetup(preparing, null, null)).toEqual({ stage: 'preflight', since: OPENED, abandonedAt: null });
  });
```

- `shows the first step when what is kept belongs to another session` attend la même vérification préalable ;
- `shows the first step of an abandoned setup whose kept step belongs to another session` devient `shows the preflight check as where an abandoned setup stopped, when no step was kept for it`, avec `{ stage: 'preflight', since: OPENED, abandonedAt: ABANDONED_AT }` ;
- les cas qui rendent une étape attendent `stage: 'step'`.

`describe('firstSetupStep')` : `starts on the waking step, from the instant it is given`.
`describe('setupStepRank')` perd `ranks the first step first while no order is known`.

`format.spec.ts`, `stoppedAt` :

```ts
  it('says a setup abandoned before its first step stopped at the preflight check', () => {
    expect(stoppedAt({ stage: 'preflight', since: OPENED, abandonedAt: STOPPED_AT })).toEqual({
      stage: 'preflight',
      at: '20:39',
    });
  });

  it('says nothing of a preflight check under way', () => {
    expect(stoppedAt({ stage: 'preflight', since: OPENED, abandonedAt: null })).toBeNull();
  });
```

et les cas d'étape attendent `stage: 'step'`.

`preparing.component.spec.ts` : `FIRST_STEP` devient
`PREFLIGHT: ShownSetup = { stage: 'preflight', since: startedAt, abandonedAt: null }`,
`fetching()` rend `stage: 'step'`. Nouveaux cas :

```ts
  it('shows the preflight check in place of a step, since the opening', async () => {
    const element = await render(PREFLIGHT);

    expect(element.querySelector('[data-field="step-rank"]')).toBeNull();
    expect(text(element, '[data-field="preflight"]')).toBe('Preflight check');
    expect(text(element, '[data-field="step-said"]')).toBe('since 20:14');
    expect(element.querySelector('.stephero .k')?.textContent?.trim()).toBe('Before the first step');
  });

  it('keeps the four lengths of the rule, all to come and still', async () => {
    const element = await render(PREFLIGHT);
    const lengths = [...element.querySelectorAll('.track [data-length]')];

    expect(lengths.map((l) => l.getAttribute('data-length'))).toEqual(['todo', 'todo', 'todo', 'todo']);
    expect(element.querySelector('.track .wait')).toBeNull();
    expect(element.querySelector('.track')?.getAttribute('aria-label')).toBe('Preflight check, before the first step');
  });

  it('announces the ready window during the preflight check', async () => {
    expect((await render(PREFLIGHT)).querySelector('[data-field="ready-window"]')).not.toBeNull();
  });

  it('does not say the first hour is charged while no server exists', async () => {
    expect((await render(PREFLIGHT)).querySelector('.hint')).toBeNull();
  });

  it('still says it once a step is under way', async () => {
    expect(text(await render(fetching()), '.hint')).toBe('The first hour is charged either way.');
  });
```

`text(element, selector)` est l'aide que le fichier emploie déjà, ou s'écrit
`element.querySelector(selector)?.textContent?.trim()`.

`out-of-service.component.spec.ts` et `not-cleared.component.spec.ts` : `STOPPED`
gagne `stage: 'step'`, et :

```ts
  it('says the setup stopped at the preflight check, with no rank', async () => {
    const element = await render(null, { stage: 'preflight', since: OPENED, abandonedAt: STOPPED_AT });

    expect(text(element, '[data-field="stopped-at"] .said')).toBe('Preflight check · before the first step');
    expect(element.textContent).not.toContain('Step 1 of 4');
  });
```

Dans `out-of-service.component.spec.ts` seulement :

```ts
  it('asks to say so when it stops at the same place twice', async () => {
    const element = await render(null, { stage: 'preflight', since: OPENED, abandonedAt: STOPPED_AT });
    expect(element.textContent).toContain('if it stops at the same place twice');
  });

  it('keeps the same step for an abandon at a step', async () => {
    expect((await render(null, STOPPED)).textContent).toContain('if it stops at the same step twice');
  });
```

`screen.spec.ts` : `SCREENS` compte `preflight` ; un test sur `screen('preflight', NOW)`
contre l'émulateur trouve `server/current` en `PROVISIONING` revendiqué et aucun
document de mise en place ; un autre sur `screen('preparing', NOW)` trouve la
première étape gardée pour `dev-session-0001`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx nx run-many -t test -p session web functions`
Expected: FAIL.

- [ ] **Step 3: Implement**

`setup.ts` :

- le commentaire de `SETUP_STEPS` dit que la première étape commence quand la vérification préalable a réussi ;
- `firstSetupStep(since: Date)` ;
- les types de l'interface ci-dessus remplacent `ShownSetup` ;
- `shownSetup` :

```ts
  if (kept !== null && kept.sessionId === opening.sessionId) {
    return { stage: 'step', step: kept.step, order: kept.order, abandonedAt };
  }
  // No step kept for this session: it has not passed its preflight check, or
  // was abandoned before it did.
  return { stage: 'preflight', since: opening.startedAt, abandonedAt };
```

  et son commentaire dit la vérification préalable là où il disait la première étape ;
- `setupStepRank(shown: ShownStep)` rend `shown.order.indexOf(shown.step.step) + 1`, sans le cas d'un ordre inconnu.

`format.ts`, `stoppedAt` :

```ts
export function stoppedAt(shown: ShownSetup | null): StoppedAt | null {
  if (shown === null || shown.abandonedAt === null) return null;
  const at = hourLabel(shown.abandonedAt);
  if (shown.stage === 'preflight') return { stage: 'preflight', at };
  return {
    stage: 'step',
    at,
    rank: setupStepRank(shown),
    total: SETUP_STEPS.length,
    name: stepLabel(shown.step.step),
  };
}
```

`out-of-service.component.ts` et `not-cleared.component.ts`, le bloc `stopped-at` :

```html
          <div class="said">
            @if (stopped.stage === 'step') {
              <b>Step {{ stopped.rank }} of {{ stopped.total }}</b> · {{ stopped.name }}
            } @else {
              <b>Preflight check</b> · <span class="before">before the first step</span>
            }
          </div>
```

avec `.said .before { color: var(--mute); }` dans la feuille du composant (celle
de `not-cleared` est dans son décorateur s'il n'a pas de fichier). Dans
`out-of-service.component.ts`, la phrase sous `It didn’t start.` dit
`at the same {{ stopped.stage === 'step' ? 'step' : 'place' }} twice`.

`preparing.component.ts` :

- `lengthsOf(shown: ShownStep, rank: number)` lit `shown.order[index]` sans `?.` ;
- `step()` rend `null`, ou pour la vérification préalable :

```ts
    if (shown.stage === 'preflight') {
      return {
        stage: 'preflight' as const,
        said: `since ${hourLabel(shown.since)}`,
        spoken: 'Preflight check, before the first step',
        lengths: SETUP_STEPS.map(() => ({ state: 'todo' as const, name: null, at: null, waiting: false })),
      };
    }
```

  et pour une étape l'objet d'aujourd'hui avec `stage: 'step' as const` ;
- le gabarit :

```html
      @if (step(); as step) {
        <div class="stephero" [class.preflight]="step.stage === 'preflight'">
          @if (step.stage === 'step') {
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
          } @else {
            <span class="k">Before the first step</span>
            <div class="what">
              <div class="name" data-field="preflight">Preflight check</div>
              <div class="meta tabular"><span data-field="step-said">{{ step.said }}</span></div>
            </div>
          }
        </div>
      }
```

  et sous `Close it now` :

```html
        @if (step()?.stage !== 'preflight') {
          <div class="hint">The first hour is charged either way.</div>
        }
```

`preparing.component.css`, après `.stephero > .clock` :

```css
/* No rank before the first step: the check takes the whole place. */
.stephero.preflight {
  grid-template-columns: 1fr;
  grid-template-areas:
    'key'
    'what';
}
```

`screen.ts` : `SCREENS` gagne `'preflight'` juste avant `'preparing'`, et
`screenFixture('preflight', now)` rend le même document que `'preparing'`. Dans
`screen()`, après l'écriture de `server/current`, supprimer
`db.doc(setupDocPath(DEV_WORLD_ID))`, puis, pour `'preparing'` seulement,
`await setupStores(db).for(DEV_WORLD_ID).begin('dev-session-0001', catalogFor(DEV_WORLD_GAME).setupStepOrder, new Date(now.getTime() - 30_000))`.
Le commentaire de `'preparing'` dit qu'une étape est gardée, celui de
`'preflight'` qu'aucune ne l'est encore.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx nx run-many -t lint test -p session session-record web functions`
Expected: PASS.

- [ ] **Step 5: See it in the app**

`mise run dev` lance l'application sur l'émulateur ; puis `mise run screen
preflight`, et comparer à `.impeccable/mocks/preflight/phone.html` en 390 px et
en 1440 px ; puis `mise run screen preparing`. L'aide de la tâche `screen` de
`mise.toml` gagne `preflight` dans sa liste. Lancer une fois la détection d'`impeccable` sur `apps/web/src/app/session/preparing.component.ts`, `out-of-service.component.ts` et `not-cleared.component.ts`, et corriger ce qu'elle relève.

- [ ] **Step 6: Commit**

```bash
git add libs/session/src apps/web/src apps/functions/src mise.toml .impeccable/mocks/preflight
git commit -m "feat(web): montre la vérification préalable avant les quatre étapes"
```

## Rulings log

## Observed drift
