# Le balayage des volumes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `sweepUnclaimed()` détruit tout volume bloc détaché qui porte le tag du système, et signale tout volume bloc détaché qui ne le porte pas.

**Architecture:** `BlockApi.listVolumes` accepte de ne recevoir aucun tag et rend alors tous les volumes du projet. `ScalewayServerHost.sweepUnclaimed()` lit cette liste avant toute destruction, supprime par l'API bloc les volumes détachés qui portent `OWNERSHIP_TAG`, et range dans `stranded` ceux qui ne le portent pas, à côté des volumes locaux détachés. Le contrat de `sweepUnclaimed()` dans `libs/session/src/lib/ports.ts` et les commentaires qui en dépendent se récrivent ; `sweepEvents` et le watchdog gardent leur code.

**Tech Stack:** TypeScript, Vitest, `@scaleway/sdk` (`Blockv1`), émulateur Firestore, Nx.

**Spec:** docs/specs/session.md
**Batch:** docs/batches/01-volume-bloc/README.md
**Sections:** Closing a session
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

Cette story ne modifie que `libs/scaleway-compute`, `libs/session`, `apps/functions` et ce document.

`open()`, `list()` et `close()` gardent leur comportement.

`open()` ne commande aucun volume bloc et ne pose aucun tag sur un volume.

`InstanceApi.createServer`, `ImageResolver`, le constructeur de `ScalewayServerHost`, la suite de contrat, `STACK.md` et le tarif ne changent pas.

Dans `libs/session` et dans `apps/functions/src/watchdog-health.ts`, seuls des commentaires et des titres de tests changent.

L'expurgation de `apps/functions` ne change pas : `destroyed` et `stranded` n'y passent pas, donc une entrée que l'adapter y range ne porte aucune réponse du fournisseur.

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

La cible `test-contract` de `@beacon/scaleway-compute` ne se lance pas : elle atteint le compte réel.

Prettier ne tourne pas sur les sources.

Toute commande `git` qui écrit un commit passe par `bash ~/.config/github-app/as-agent.sh git …`, et le message se termine par `Co-Authored-By: Charlouze <me@charlouze.com>` et par rien d'autre.

`npx nx run @beacon/functions:test` lance l'émulateur sur le port 8080 : un seul lancement à la fois.

## Review Focus

- Un volume détaché qui porte `OWNERSHIP_TAG` et deux tags de session distincts : il est détruit, et son entrée ne nomme aucune session. Test dans la tâche 2.
- Un volume que la liste dit détaché et dont la suppression répond 412 : l'entrée va dans `errors` et le passage continue. Test dans la tâche 2.
- Un volume détaché qui porte un tag de session sans `OWNERSHIP_TAG` : il est signalé et jamais supprimé. Test dans la tâche 2.
- Un refus de la liste de l'API bloc : le balayage échoue avant toute destruction. Test dans la tâche 2.
- Un volume bloc encore attaché au serveur sans session que ce passage détruit : ce passage n'y touche pas, et le suivant le détruit une fois détaché. Test dans la tâche 2.

---

### Task 1: La liste de l'API bloc sans filtre

**Files:**
- Modify: `libs/scaleway-compute/src/lib/block-api.ts`
- Modify: `libs/scaleway-compute/src/lib/from-sdk.ts`
- Modify: `libs/scaleway-compute/src/lib/fake-block-api.ts`
- Test: `libs/scaleway-compute/src/lib/fake-block-api.spec.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `BlockApi.listVolumes(request: { tag?: string }): Promise<{ volumes: ScwBlockVolume[] }>`. Sans `tag`, tous les volumes du projet reviennent. `FakeBlockApi` enregistre alors l'appel `listVolumes`, sans suffixe ; avec un tag, il enregistre `listVolumes <tag>` comme aujourd'hui.

- [ ] **Step 1: Write the failing tests**

Dans `fake-block-api.spec.ts`, dans `describe('FakeBlockApi', …)`, après le test `can answer with everything, to prove the adapter re-checks` :

```ts
  it('answers a listing without a tag with every volume', async () => {
    const api = new FakeBlockApi([
      scwBlockVolume('v-1', ['beacon']),
      scwBlockVolume('v-2', ['someone-else']),
      scwBlockVolume('v-3'),
    ]);

    const { volumes } = await api.listVolumes({});

    expect(volumes.map((volume) => volume.id)).toEqual(['v-1', 'v-2', 'v-3']);
    expect(api.calls).toEqual(['listVolumes']);
  });

  it('refuses a listing without a tag on the call a test names', async () => {
    const api = new FakeBlockApi();
    api.failOn = 'listVolumes';

    await expect(api.listVolumes({})).rejects.toThrow('scaleway refused listVolumes');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx nx run @beacon/scaleway-compute:test`
Expected: FAIL, `listVolumes undefined` dans `api.calls` et une liste vide.

- [ ] **Step 3: Implement**

`block-api.ts`, la méthode `listVolumes` de `BlockApi` :

```ts
  /**
   * One tag at most, and the signature allows no more: the filter is exact on
   * a whole tag, and two tags are read as either, not both — measured on
   * 2026-10-08. Without a tag, the whole project comes back.
   */
  listVolumes(request: { tag?: string }): Promise<{ volumes: ScwBlockVolume[] }>;
```

`from-sdk.ts`, dans `blockFromSdk` :

```ts
    listVolumes: async (request) => ({
      volumes: await drain(
        api.listVolumes({
          zone,
          tags: request.tag === undefined ? undefined : [request.tag],
          includeDeleted: false,
        }),
      ),
    }),
```

`fake-block-api.ts` :

```ts
  async listVolumes(request: { tag?: string }) {
    const { tag } = request;
    this.record(tag === undefined ? 'listVolumes' : `listVolumes ${tag}`);
    if (tag === undefined || this.ignoresTagFilter) return { volumes: this.volumes };
    return { volumes: this.volumes.filter((volume) => volume.tags.includes(tag)) };
  }
```

- [ ] **Step 4: Run the tests, the lint and the typecheck**

Run: `npx nx run-many -t test lint typecheck -p @beacon/scaleway-compute`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/scaleway-compute
bash ~/.config/github-app/as-agent.sh git commit -m "fix(scaleway-compute): liste les volumes bloc sans filtre" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

### Task 2: Le balayage des volumes bloc

**Files:**
- Modify: `libs/scaleway-compute/src/lib/scaleway-server-host.ts`
- Modify: `libs/scaleway-compute/src/lib/instance-api.ts` (commentaires)
- Test: `libs/scaleway-compute/src/lib/scaleway-server-host.spec.ts`

**Interfaces:**
- Consumes: `BlockApi.listVolumes({})` de la tâche 1 ; `isDetached(volume)` de `block-api.ts` ; `isAlreadyGone`, `carrying`, `readSessionTag`, `OWNERSHIP_TAG`, déjà dans `scaleway-server-host.ts` et `tags.ts`.
- Produces: `sweepUnclaimed()` rend dans `destroyed` une entrée `volume <id> of session <sessionId>`, ou `volume <id>` quand le volume ne porte pas un tag de session unique ; dans `stranded` une entrée `volume <id> (<n> GB)` par volume bloc détaché sans `OWNERSHIP_TAG`, après celles des volumes locaux ; dans `errors` une entrée `volume <id>: <erreur>` par suppression refusée. Un refus de la liste de l'API bloc rejette la promesse.

Les règles :

- la liste de l'API bloc se lit sans tag, après celle des volumes de l'API instance et avant toute destruction ;
- un volume attaché n'est ni détruit ni signalé ;
- un volume détaché qui porte `OWNERSHIP_TAG` est supprimé, avec ou sans tag de session ;
- un volume détaché qui ne porte pas `OWNERSHIP_TAG` est signalé et jamais supprimé ;
- les IP se détruisent d'abord, puis les serveurs, puis les volumes ;
- un 404 à la suppression n'est ni une destruction ni une erreur ;
- tout autre refus de suppression, 412 compris, va dans `errors`, et le passage continue ;
- le balayage n'attend aucun détachement et ne supprime aucun volume par l'attachement.

- [ ] **Step 1: Write the failing tests**

Dans `scaleway-server-host.spec.ts`, ajouter `import type { UnclaimedSweep } from '@beacon/session';` et remplacer tout le `describe('sweepUnclaimed and a block volume', …)` de fin de fichier par :

```ts
describe('sweeping the block volumes', () => {
  it('destroys a detached volume carrying both tags, and names its session', async () => {
    block.volumes = [scwBlockVolume('v-1', owned('sess1'))];

    const sweep = await host.sweepUnclaimed();

    expect(sweep).toEqual({ destroyed: ['volume v-1 of session sess1'], stranded: [], errors: [] });
    expect(block.volumes).toEqual([]);
  });

  it('destroys a detached volume carrying the ownership tag alone', async () => {
    block.volumes = [scwBlockVolume('v-1', owned())];

    expect((await host.sweepUnclaimed()).destroyed).toEqual(['volume v-1']);
    expect(block.volumes).toEqual([]);
  });

  // Two sessions claimed is no session known: the volume is still ours, and
  // still detached, so it dies without a name.
  it('destroys a volume claimed by two sessions without naming either', async () => {
    block.volumes = [scwBlockVolume('v-1', [...owned('sess1'), sessionTag('sess2')])];

    expect((await host.sweepUnclaimed()).destroyed).toEqual(['volume v-1']);
  });

  it('asks for the whole listing, with no tag', async () => {
    await host.sweepUnclaimed();

    expect(block.calls).toEqual(['listVolumes']);
  });

  it('leaves alone an attached volume, whatever it carries', async () => {
    block.volumes = [
      scwBlockVolume('v-1', owned('sess1'), true),
      scwBlockVolume('v-2', [], true),
    ];

    const sweep = await host.sweepUnclaimed();

    expect(sweep).toEqual({ destroyed: [], stranded: [], errors: [] });
    expect(block.calls).toEqual(['listVolumes']);
  });

  // Without the ownership tag nothing proves the volume is ours: a session
  // tag alone is a word anyone can write.
  it('reports a detached volume without the ownership tag, and never deletes it', async () => {
    block.volumes = [
      scwBlockVolume('v-1'),
      scwBlockVolume('v-2', [sessionTag('sess1')]),
      scwBlockVolume('v-3', ['beacon-probe']),
    ];

    const sweep = await host.sweepUnclaimed();

    expect(sweep.stranded).toEqual(['volume v-1 (40 GB)', 'volume v-2 (40 GB)', 'volume v-3 (40 GB)']);
    expect(sweep.destroyed).toEqual([]);
    expect(block.calls).toEqual(['listVolumes']);
  });

  it('reports the local volumes before the block ones', async () => {
    api.volumes = [scwVolume('v-l')];
    block.volumes = [scwBlockVolume('v-b')];

    expect((await host.sweepUnclaimed()).stranded).toEqual(['volume v-l (80 GB)', 'volume v-b (40 GB)']);
  });

  it('fails when the block api refuses the listing, before anything is destroyed', async () => {
    api.ips = [scwIp('ip-1', '51.15.0.1', owned())];
    api.servers = [scwServer('s-1', owned())];
    block.failOn = 'listVolumes';

    await expect(host.sweepUnclaimed()).rejects.toThrow('scaleway refused listVolumes');
    expect(api.calls.filter((c) => !c.startsWith('list'))).toEqual([]);
  });

  it('carries on past a refused deletion, and records both sides of it', async () => {
    block.volumes = [scwBlockVolume('v-1', owned('sess1')), scwBlockVolume('v-2', owned('sess2'))];
    block.failOn = 'deleteVolume v-1';

    const sweep = await host.sweepUnclaimed();

    expect(sweep.destroyed).toEqual(['volume v-2 of session sess2']);
    expect(sweep.errors).toEqual(['volume v-1: Error: scaleway refused deleteVolume v-1']);
  });

  // The listing and the deletion disagree for a moment. The sweep does not
  // wait: it says so, and the next pass asks again.
  it('records a volume the listing called detached and the deletion called in use', async () => {
    block.volumes = [scwBlockVolume('v-1', owned('sess1'))];
    block.failWith = { call: 'deleteVolume v-1', error: volumeInUse() };

    const sweep = await host.sweepUnclaimed();

    expect(sweep.destroyed).toEqual([]);
    expect(sweep.errors).toHaveLength(1);
    expect(sweep.errors[0]).toContain('v-1');
  });

  it('counts a volume that is already gone as neither destroyed nor refused', async () => {
    block.volumes = [scwBlockVolume('v-1', owned('sess1'))];
    block.failWith = { call: 'deleteVolume v-1', error: volumeNotFound() };

    expect(await host.sweepUnclaimed()).toEqual({ destroyed: [], stranded: [], errors: [] });
  });

  it('destroys the ips and the servers before the volumes', async () => {
    api.ips = [scwIp('ip-1', '51.15.0.1', owned())];
    api.servers = [scwServer('s-1', owned())];
    block.volumes = [scwBlockVolume('v-1', owned())];

    expect((await host.sweepUnclaimed()).destroyed).toEqual(['ip 51.15.0.1', 'server s-1', 'volume v-1']);
  });

  // The Instance API answers 404 for a block volume, which would read as a
  // deletion. And the sweep does not wait for a detachment: the volume of the
  // server it has just destroyed is the next pass's.
  it('leaves the block volume of a stray server to the pass after it detached', async () => {
    api.servers = [scwServer('s-1', owned(), 'stopped', ['v-l'], ['v-b'])];
    block.volumes = [scwBlockVolume('v-b', owned(), true)];

    const first = await host.sweepUnclaimed();

    expect(api.calls.filter((c) => c.startsWith('deleteVolume'))).toEqual(['deleteVolume v-l']);
    expect(block.calls).toEqual(['listVolumes']);
    expect(first.destroyed).toEqual(['server s-1']);

    block.detach('v-b');

    expect((await host.sweepUnclaimed()).destroyed).toEqual(['volume v-b']);
    expect(block.volumes).toEqual([]);
  });
});

describe('a close() and a sweep after the same volume', () => {
  /** Runs `rival` once, just before the next block deletion goes through. */
  const beforeNextDeletion = (rival: () => Promise<void>) => {
    const deleteVolume = block.deleteVolume.bind(block);
    block.deleteVolume = async (request) => {
      block.deleteVolume = deleteVolume;
      await rival();
      return deleteVolume(request);
    };
  };

  beforeEach(() => {
    block.volumes = [scwBlockVolume('v-1', owned('sess1'))];
  });

  it('closes a session whose volume a sweep has already destroyed', async () => {
    await host.sweepUnclaimed();

    await expect(host.close('sess1')).resolves.toBeUndefined();
    expect(pauses).toEqual([]);
  });

  it('lets close() succeed when the sweep deletes the volume between its listing and its deletion', async () => {
    let sweep: UnclaimedSweep | undefined;
    beforeNextDeletion(async () => {
      sweep = await host.sweepUnclaimed();
    });

    await expect(host.close('sess1')).resolves.toBeUndefined();
    expect(sweep).toEqual({ destroyed: ['volume v-1 of session sess1'], stranded: [], errors: [] });
    expect(block.volumes).toEqual([]);
  });

  it('lets the sweep go on when close() deletes the volume between its listing and its deletion', async () => {
    beforeNextDeletion(() => host.close('sess1'));

    expect(await host.sweepUnclaimed()).toEqual({ destroyed: [], stranded: [], errors: [] });
    expect(block.volumes).toEqual([]);
  });
});
```

Dans le `describe('sweepUnclaimed', …)` existant, remplacer le commentaire au-dessus de `reports a detached volume without touching it` par :

```ts
  // A local volume carries no tag of ours, so nothing proves where it comes
  // from, and deleting someone else's disk is the one mistake this component
  // may not make.
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx nx run @beacon/scaleway-compute:test`
Expected: FAIL sur les nouveaux tests, `destroyed` vide et `block.calls` vide.

- [ ] **Step 3: Implement**

Dans `scaleway-server-host.ts`, importer le type : `import { isDetached, type BlockApi, type ScwBlockVolume } from './block-api.js';`.

Remplacer `sweepUnclaimed()` par :

```ts
  async sweepUnclaimed(): Promise<UnclaimedSweep> {
    // The volumes first, and before any destruction: a disk this very pass is
    // about to orphan is in flight, not stranded. Listing after would report it
    // as abandoned every time a server dies.
    const { volumes } = await this.api.listVolumes();
    // No tag asked for: what is stranded is exactly what carries no tag of
    // ours, and no filter on a tag returns that.
    const detached = (await this.block.listVolumes({})).volumes.filter(isDetached);

    // Detached and carrying the ownership tag: what is left of a game server
    // that is gone, whatever session it was tagged for.
    const ours = carrying(OWNERSHIP_TAG);
    const leftovers = detached.filter(ours);
    const stranded = [
      ...volumes.filter((volume) => volume.server?.id === undefined),
      ...detached.filter((volume) => !ours(volume)),
    ].map((volume) => `volume ${volume.id} (${Math.round(volume.size / 1e9)} GB)`);

    const { servers } = await this.api.listServers({ tags: [OWNERSHIP_TAG] });
    const { ips } = await this.api.listIps({ tags: [OWNERSHIP_TAG] });

    const strayIps = ips
      .filter(carrying(OWNERSHIP_TAG))
      .filter((ip) => readSessionTag(ip.tags) === null);
    const strayServers = servers
      .filter(carrying(OWNERSHIP_TAG))
      .filter((server) => readSessionTag(server.tags) === null);

    const destroyed: string[] = [];
    const errors: string[] = [];

    // One try per resource, and this is the whole point. The probe's reaper
    // wrapped the loop instead: the first refusal ended the pass, the next
    // server lived, and what had already been destroyed was never recorded.
    for (const ip of strayIps) {
      try {
        await this.api.deleteIp({ ip: ip.id });
        destroyed.push(`ip ${ip.address}`);
      } catch (error) {
        if (isAlreadyGone(error)) continue;
        errors.push(`ip ${ip.id}: ${String(error)}`);
      }
    }
    for (const server of strayServers) {
      try {
        await this.destroyServer(server);
        destroyed.push(`server ${server.id}`);
      } catch (error) {
        if (isAlreadyGone(error)) continue;
        errors.push(`server ${server.id}: ${String(error)}`);
      }
    }
    // No wait here, unlike close(): a volume the provider still holds is the
    // next pass's, and already gone means a close() got there first.
    for (const volume of leftovers) {
      try {
        await this.block.deleteVolume({ volumeId: volume.id });
        destroyed.push(sweptVolume(volume));
      } catch (error) {
        if (isAlreadyGone(error)) continue;
        errors.push(`volume ${volume.id}: ${String(error)}`);
      }
    }

    return { destroyed, stranded, errors };
  }
```

Après `localVolumeIdsOf`, ajouter :

```ts
/** A destroyed volume, in the audit's words: the session it was tagged for, when one is. */
function sweptVolume(volume: ScwBlockVolume): string {
  const sessionId = readSessionTag(volume.tags);
  return sessionId === null ? `volume ${volume.id}` : `volume ${volume.id} of session ${sessionId}`;
}
```

Dans `destroyServer`, le début du commentaire de la branche `running` devient :

```ts
      // One call, and it takes the local volumes with it — not the block ones,
      // which close() and the sweep delete once they detach. Deliberately not
```

Dans `instance-api.ts`, le commentaire de `ScwVolume` devient :

```ts
/**
 * A local disk, as the Instance API lists it. This system never tags one, so
 * nothing says whose a detached one is: it is reported and never destroyed. A
 * block volume is not in this listing — see `ScwBlockVolume`.
 */
```

et celui de `InstanceApi.listVolumes` :

```ts
  /** No tag filter: the whole project comes back, local volumes only. */
```

- [ ] **Step 4: Run the tests, the lint and the typecheck**

Run: `npx nx run-many -t test lint typecheck -p @beacon/scaleway-compute`
Expected: PASS, tous les tests de `scaleway-server-host.spec.ts` compris.

- [ ] **Step 5: Commit**

```bash
git add libs/scaleway-compute
bash ~/.config/github-app/as-agent.sh git commit -m "fix(scaleway-compute): balaie les volumes bloc détachés" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

### Task 3: Le contrat du balayage et ce qui le cite

**Files:**
- Modify: `libs/session/src/lib/ports.ts` (commentaires)
- Modify: `libs/session/src/lib/events.ts` (commentaires)
- Modify: `libs/session/src/lib/watchdog/reconcile.ts` (commentaires)
- Modify: `libs/session/src/lib/watchdog/reconcile.spec.ts` (un titre, un commentaire)
- Modify: `apps/functions/src/watchdog-health.ts` (commentaire)
- Test: `apps/functions/src/watchdog.spec.ts`

**Interfaces:**
- Consumes: `sweepUnclaimed()` de la tâche 2, dont une entrée `destroyed` s'écrit `volume <id> of session <sessionId>`.
- Produces: rien qu'une autre tâche lise.

Aucune ligne de code exécutable de `libs/session` ni de `watchdog-health.ts` ne change.

- [ ] **Step 1: Write the test of the seam**

Dans `apps/functions/src/watchdog.spec.ts`, après le test `turns a block volume that never detaches into CleanupFailed` :

```ts
  // The session is named in the detail and not in the subject: no close() of
  // that session destroyed the volume, the sweep did.
  it('files a volume the real adapter swept as a reclamation without a session', async () => {
    const block = new FakeBlockApi([scwBlockVolume('v-1', [OWNERSHIP_TAG, sessionTag('sess1')])]);

    await runWatchdog({
      ...deps(),
      host: new ScalewayServerHost(new FakeInstanceApi(), block, { resolve: async () => null }, {
        budgetMs: 30_000,
        pause: async () => undefined,
      }),
      ledger,
    });

    const [event] = (await db.collection('events').get()).docs;
    expect(event.data()['type']).toBe('SessionReclaimed');
    expect(event.data()['sessionId']).toBeNull();
    expect(event.data()['detail']).toBe('volume v-1 of session sess1');
    expect(block.volumes).toEqual([]);
  });
```

Dans le même fichier, le test `records the sweep of what carries no session tag` prend le titre `records what the sweep destroyed under no session`.

- [ ] **Step 2: Run it**

Run: `npx nx run @beacon/functions:test`
Expected: PASS. Le test passe dès l'écriture : il épingle la couture entre l'adapter de la tâche 2 et le watchdog, dont le code ne change pas. S'il échoue parce que le passage ne balaie pas dans ce montage, lire les tests voisins du même `describe` et reprendre leur montage ; ne pas modifier `watchdog.ts`.

- [ ] **Step 3: Rewrite the comments**

`libs/session/src/lib/ports.ts`, le champ `stranded` de `UnclaimedSweep` :

```ts
  /**
   * Found, and deliberately left alone: detached volumes that do not carry the
   * ownership tag. Nothing proves where they come from, and deleting someone
   * else's disk is not a mistake this component may make.
   */
  readonly stranded: readonly string[];
```

`libs/session/src/lib/ports.ts`, `ServerHost.sweepUnclaimed` :

```ts
  /**
   * One pass over what this system owns and nothing holds any more. It
   * destroys what no session claims — a server or an ip carrying the
   * ownership tag and no session tag — and what is left of a game server that
   * is gone: a detached volume carrying the ownership tag, with or without a
   * session tag. It reports the detached volumes that do not carry that tag,
   * and survives a refusal on any single resource.
   *
   * Rejects when the provider refuses a listing: a pass that could not look
   * has swept nothing.
   */
  sweepUnclaimed(): Promise<UnclaimedSweep>;
```

`libs/session/src/lib/events.ts`, les commentaires de `SessionReclaimed` et de `ResourceStranded` :

```ts
  /**
   * The system took resources back. A null sessionId means the sweep took
   * them, outside the closing of any session — destroying them still spends
   * money, so it is still audited. The detail names the session a leftover
   * volume was tagged for.
   */
  | { type: 'SessionReclaimed'; sessionId: SessionId | null; detail: string }
  /**
   * A detached volume nothing can be traced to. Nothing was destroyed and
   * nothing will be: announcing is the whole action (§6), and it happens once,
   * when the volume appears — what is stranded now is a state, and it is
   * `health/watchdog` that holds it. It always has a null subject — the volume
   * carries no tag of this system, which is exactly the problem.
   */
  | { type: 'ResourceStranded'; sessionId: null; detail: string }
```

`libs/session/src/lib/watchdog/reconcile.ts`, le premier paragraphe du commentaire de `sweepEvents` :

```ts
/**
 * What the sweep of the unclaimed leaves in the journal — once per pass, never
 * once per world: none of these three facts is a session being closed, even
 * when a destroyed volume names the session it was tagged for, so nothing
 * about them belongs to any one world's correction (§6). `reconcileWorld`
 * never sees the sweep at all, which is what keeps that plural from creeping
 * back in.
```

`libs/session/src/lib/watchdog/reconcile.ts`, dans le commentaire de `closing`, la phrase sur le balayage :

```ts
 * reclaimed by nobody: `reclamations()` reads the open intent as a session
 * still being born and holds off, `sweepUnclaimed()` sees a session tag on a
 * server or an ip and skips it. §4 hangs on this branch — no Scaleway resource
 * outlives its session — and a billed machine nothing will ever destroy is how
 * it breaks.
```

`libs/session/src/lib/watchdog/reconcile.spec.ts` :

```ts
  // A stranded volume does not carry the ownership tag: announcing it is the
  // entire action.
  it('announces a stranded volume on its appearance', () => {
```

`apps/functions/src/watchdog-health.ts`, le paragraphe sur `stranded` :

```ts
 * `stranded` is read, and by the watchdog itself. It is what one pass has to
 * remember for the next: a stranded volume does not carry the ownership tag,
 * so nothing destroys it and it comes back in every sweep, and announcing it
 * is a fact that happens once (§5). The document is also the standing answer
 * to "what is stranded right now", which no event can give.
```

- [ ] **Step 4: Run the tests, the lint and the typecheck**

Run: `npx nx run-many -t test lint typecheck -p @beacon/session @beacon/functions`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/session apps/functions
bash ~/.config/github-app/as-agent.sh git commit -m "fix(session): récrit le contrat du balayage" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

## Rulings log

Ruling: le commentaire du champ `stranded` nomme les deux sortes de volume signalé, le volume local que le système ne tague jamais et le volume bloc sans tag du système, et les commentaires qui écrivent « sans tag du système » restent — une relecture a relevé que l'adapter signale tout volume local détaché sans lire ses tags, et la conception du lot dit « sans tag du système » des deux listes — si c'est faux, un lecteur attend sur les volumes locaux un test de tag que l'adapter ne fait pas.

Ruling: le volume bloc d'un serveur sans session que le balayage détruit n'est ni attendu ni supprimé par l'attachement dans ce passage — la conception du lot ne donne au balayage ni attente ni destruction par l'attachement, et un passage du watchdog n'a pas de temps à y perdre — si c'est faux, ce volume vit jusqu'au passage suivant s'il porte le tag du système, et reste signalé sans être détruit s'il ne l'a jamais porté.

Ruling: un volume que la liste dit détaché et dont la suppression répond 412 va dans `errors`, sans nouvel essai — la conception du lot range tout refus de suppression dans `errors` — si c'est faux, un détachement en cours écrit un `CleanupFailed` sans session que le passage suivant ne confirme pas.

Ruling: une entrée `destroyed` s'écrit `volume <id> of session <sessionId>`, et `volume <id>` quand le volume ne porte pas un tag de session unique — la conception demande que l'entrée nomme la session, et deux tags de session distincts n'en désignent aucune — si c'est faux, le détail d'un événement sans session change de forme.

Technical design ruling: le balayage lit la liste de l'API bloc sans filtre et trie lui-même ce qui revient, et `BlockApi.listVolumes` accepte de ne recevoir aucun tag — `stranded` porte les volumes sans tag du système, qu'aucun filtre sur un tag ne rend — si c'est faux, le balayage fait deux listes, l'une filtrée sur le tag du système.

Technical design ruling: les commentaires de `libs/session/src/lib/ports.ts`, `events.ts` et `watchdog/reconcile.ts` ne sont pas récrits, celui du contrat de `sweepUnclaimed()` compris — ces trois fichiers entrent dans l'image du compagnon, et `companion:test` reste rouge sur tout changement de l'un d'eux tant qu'une image n'est pas publiée par `git tag companion-v<n>` puis épinglée par `nx run companion:pin -- <n>`, ce que seul le commanditaire fait — si c'est faux, le commentaire du port décrit le balayage d'avant cette story jusqu'à la prochaine publication du compagnon ; le texte récrit est dans la tâche 3 de ce plan.

Ruling: `isAlreadyGone` ne lit plus le message de l'erreur ni son `type`, et seul le statut 404 dit qu'une ressource a disparu — décision du commanditaire en revue : un refus qui n'est pas un 404 et dont le texte dit « not found » passait pour une destruction réussie, pour une IP, un serveur ou un volume, sans atteindre `errors` ni l'échec de `close()`, et toute erreur HTTP du SDK porte son statut — si c'est faux, une disparition que le fournisseur annonce sans statut 404 fait échouer `close()` et écrit un `CleanupFailed` pour une ressource qui n'existe plus.

## Observed drift

- `docs/specs/infrastructure.md`, `Warning the operator` : le signalement d'un volume n'atteint personne. Un volume du système peut y arriver sans tag. Il suffit que la pose du tag ait été refusée à l'ouverture puis à la fermeture, et que la fermeture ait détruit le serveur sans détruire le volume. Un volume signalé produit un événement `ResourceStranded` sans session, écrit une fois, à son apparition. Il figure ensuite dans `health/watchdog` tant qu'il existe. Aucun écran ne lit les événements ni `health/watchdog`, et aucune alerte ne porte sur l'un ou l'autre. La spec ne prévient l'exploitant que si la surveillance cesse de tourner ou si la dépense du mois dépasse 5 €.
