# La fermeture des volumes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `close()` détruit les volumes bloc d'une session, ceux qui portent son tag et ceux que ses serveurs attachent, en attendant 30 s au plus qu'ils se détachent.

**Architecture:** `libs/scaleway-compute` déclare `BlockApi`, la tranche de l'API bloc dont l'adapter se sert, avec sa traduction `blockFromSdk` et son faux `FakeBlockApi`. `ScalewayServerHost` reçoit cette API et un `DetachmentWait`, la borne et la fonction d'attente ; `close()` détruit les IP et les serveurs, puis boucle sur la liste des volumes tagués et sur les volumes bloc que ses serveurs attachaient, jusqu'à ce qu'il n'en reste aucun. `apps/functions/src/container.ts` câble l'API bloc et une attente de 30 s.

**Tech Stack:** TypeScript, Vitest, `@scaleway/sdk` (`Blockv1`), émulateur Firestore, Nx.

**Spec:** docs/specs/session.md
**Batch:** docs/batches/01-volume-bloc/README.md
**Sections:** none
**Blocks:** none
**Technical:** yes

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

Cette story ne modifie que `libs/scaleway-compute`, `apps/functions` et ce document.

`libs/session` ne change pas.

`open()`, `list()` et `sweepUnclaimed()` gardent leur comportement.

`open()` ne commande aucun volume bloc et ne pose aucun tag sur un volume.

`InstanceApi.createServer`, `ImageResolver` et `STACK.md` ne changent pas.

La suite de contrat ne change que par l'appel au constructeur de `ScalewayServerHost`.

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

Toute commande `git` qui écrit un commit passe par `bash ~/.config/github-app/as-agent.sh git …`.

Un message de commit suit Conventional Commits, en français, à l'impératif, en minuscule, sans point final, avec la portée `scaleway-compute`.

Un message de commit se termine par `Co-Authored-By: Charlouze <me@charlouze.com>` et par aucune autre ligne d'attribution.

Les tests de `libs/scaleway-compute` se lancent par `npx nx run @beacon/scaleway-compute:test`.

Les tests de `apps/functions` se lancent par `npx nx run @beacon/functions:test`, qui démarre l'émulateur ; deux lancements ne tournent pas en même temps.

Le typage et le lint se vérifient par `npx nx run-many -t typecheck lint -p @beacon/scaleway-compute @beacon/functions`.

Un identifiant de ressource écrit dans un test de `apps/functions` reste court (`s-1`, `v-1`) : l'expurgation masque toute chaîne de vingt caractères ou plus.

## Review Focus

- Un serveur sur disque local, sans volume tagué : `close()` le ferme sans une pause et sans une suppression par l'API bloc (tâche 2, premier test).
- Un volume que la liste rend sans le tag de la session : `close()` n'y touche pas (tâche 2).
- Un volume qu'un autre passage a déjà supprimé : `close()` réussit (tâche 2).
- Un volume qui ne se détache jamais : `close()` échoue après 30 s de pauses, pas une de plus (tâche 2).
- Un refus de la liste de l'API bloc : `close()` échoue, après avoir détruit les IP et les serveurs (tâche 2).

---

### Task 1: La tranche de l'API bloc

**Files:**
- Create: `libs/scaleway-compute/src/lib/block-api.ts`
- Create: `libs/scaleway-compute/src/lib/fake-block-api.ts`
- Create: `libs/scaleway-compute/src/lib/fake-block-api.spec.ts`
- Modify: `libs/scaleway-compute/src/lib/from-sdk.ts`
- Modify: `libs/scaleway-compute/src/lib/instance-api.ts`
- Modify: `libs/scaleway-compute/src/lib/fake-instance-api.ts`
- Modify: `libs/scaleway-compute/src/lib/scaleway-server-host.contract.spec.ts` (seulement si le typage le demande)
- Modify: `libs/scaleway-compute/src/index.ts`

**Interfaces:**
- Consumes: rien.
- Produces:
  - `BlockApi`, `ScwBlockVolume`, `isDetached(volume: ScwBlockVolume): boolean` dans `block-api.ts` ;
  - `blockFromSdk(api: Blockv1.API, zone: Zone): BlockApi` dans `from-sdk.ts` ;
  - `FakeBlockApi`, `scwBlockVolume(id: string, tags?: string[], attached?: boolean): ScwBlockVolume`, `volumeInUse(): Error`, `volumeNotFound(): Error` dans `fake-block-api.ts` ;
  - `BLOCK_VOLUME_TYPE = 'sbs_volume'` et `ScwServer.volumes: Record<string, { readonly id: string; readonly volumeType: string }>` dans `instance-api.ts` ;
  - `scwServer(id, tags, state = 'running', volumeIds: string[] = [], blockVolumeIds: string[] = [])` dans `fake-instance-api.ts`.

- [ ] **Step 1: Write the failing test**

Créer `libs/scaleway-compute/src/lib/fake-block-api.spec.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { isDetached } from './block-api.js';
import { FakeBlockApi, scwBlockVolume } from './fake-block-api.js';
import { BLOCK_VOLUME_TYPE } from './instance-api.js';
import { scwServer } from './fake-instance-api.js';

describe('FakeBlockApi', () => {
  it('filters on the whole tag, like the measured api', async () => {
    const api = new FakeBlockApi([
      scwBlockVolume('v-1', ['beacon', 'session:s1']),
      scwBlockVolume('v-2', ['beacon', 'session:s10']),
    ]);

    const { volumes } = await api.listVolumes({ tag: 'session:s1' });

    expect(volumes.map((volume) => volume.id)).toEqual(['v-1']);
  });

  it('can answer with everything, to prove the adapter re-checks', async () => {
    const api = new FakeBlockApi([scwBlockVolume('v-1', ['someone-else'])]);
    api.ignoresTagFilter = true;

    const { volumes } = await api.listVolumes({ tag: 'session:s1' });

    expect(volumes.map((volume) => volume.id)).toEqual(['v-1']);
  });

  it('refuses to delete an attached volume with a 412', async () => {
    const api = new FakeBlockApi([scwBlockVolume('v-1', [], true)]);

    await expect(api.deleteVolume({ volumeId: 'v-1' })).rejects.toMatchObject({ status: 412 });
    expect(api.volumes).toHaveLength(1);
  });

  it('deletes a volume once it is detached', async () => {
    const api = new FakeBlockApi([scwBlockVolume('v-1', [], true)]);
    api.detach('v-1');

    await api.deleteVolume({ volumeId: 'v-1' });

    expect(api.volumes).toEqual([]);
  });

  it('answers 404 for a volume it does not hold', async () => {
    const api = new FakeBlockApi();

    await expect(api.deleteVolume({ volumeId: 'v-1' })).rejects.toMatchObject({ status: 404 });
  });

  it('replaces the tags of a volume', async () => {
    const api = new FakeBlockApi([scwBlockVolume('v-1')]);

    await api.setVolumeTags({ volumeId: 'v-1', tags: ['beacon', 'session:s1'] });

    expect(api.volumes[0].tags).toEqual(['beacon', 'session:s1']);
    expect(api.calls).toEqual(['setVolumeTags v-1 beacon+session:s1']);
  });

  it('throws on the call a test names', async () => {
    const api = new FakeBlockApi();
    api.failOn = 'listVolumes';

    await expect(api.listVolumes({ tag: 'session:s1' })).rejects.toThrow('scaleway refused listVolumes');
  });
});

describe('isDetached', () => {
  it('reads an empty reference list as detached, and nothing else', () => {
    expect(isDetached(scwBlockVolume('v-1'))).toBe(true);
    expect(isDetached(scwBlockVolume('v-1', [], true))).toBe(false);
  });
});

describe('scwServer', () => {
  it('says which of its volumes are local and which are block', () => {
    const server = scwServer('s-1', [], 'stopped', ['v-l'], ['v-b']);

    expect(Object.values(server.volumes)).toEqual([
      { id: 'v-l', volumeType: 'l_ssd' },
      { id: 'v-b', volumeType: BLOCK_VOLUME_TYPE },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx run @beacon/scaleway-compute:test`
Expected: FAIL, `./block-api.js` et `./fake-block-api.js` n'existent pas.

- [ ] **Step 3: Write minimal implementation**

Créer `libs/scaleway-compute/src/lib/block-api.ts` :

```ts
/**
 * The slice of Scaleway's Block Storage API this adapter uses, declared next
 * to `InstanceApi` for the same reason: the adapter is driven without a
 * network, a key, or a cent. `Blockv1.API` is adapted onto it in `from-sdk.ts`.
 *
 * A block volume lives here and nowhere else: the Instance API neither lists
 * it nor deletes it, and answers 404 to the attempt — measured on 2026-10-08.
 */

export interface ScwBlockVolume {
  readonly id: string;
  readonly size: number;
  readonly tags: string[];
  /** What holds the volume. See `isDetached`. */
  readonly references: readonly { readonly id: string }[];
}

export interface BlockApi {
  /**
   * One tag, and the signature allows no more: the filter is exact on a whole
   * tag, and two tags are read as either, not both — measured on 2026-10-08.
   */
  listVolumes(request: { tag: string }): Promise<{ volumes: ScwBlockVolume[] }>;
  /** Replaces the whole tag list. */
  setVolumeTags(request: { volumeId: string; tags: string[] }): Promise<void>;
  /** Refused with a 412 while the volume is attached. */
  deleteVolume(request: { volumeId: string }): Promise<void>;
}

/**
 * Detached means no reference at all. A reference still `detaching` is a
 * reference: the provider refuses the deletion until it is gone.
 */
export const isDetached = (volume: ScwBlockVolume): boolean => volume.references.length === 0;
```

Créer `libs/scaleway-compute/src/lib/fake-block-api.ts` :

```ts
import type { BlockApi, ScwBlockVolume } from './block-api.js';

/**
 * An in-memory Block Storage api that records what it was asked. Test-only,
 * and in src/ because the app's own tests drive it too.
 */
export class FakeBlockApi implements BlockApi {
  readonly calls: string[] = [];
  failOn: string | null = null;
  /** A specific error on a specific call, where `failOn` only throws a string. */
  failWith: { call: string; error: unknown } | null = null;
  /**
   * Answers the listing with the whole array, tag filter ignored: a fake that
   * always filters exactly would let an adapter trusting the query alone pass.
   */
  ignoresTagFilter = false;

  constructor(public volumes: ScwBlockVolume[] = []) {}

  private record(call: string): void {
    this.calls.push(call);
    if (this.failOn !== null && call.startsWith(this.failOn)) {
      throw new Error(`scaleway refused ${call}`);
    }
    if (this.failWith !== null && call.startsWith(this.failWith.call)) {
      throw this.failWith.error;
    }
  }

  async listVolumes(request: { tag: string }) {
    this.record(`listVolumes ${request.tag}`);
    if (this.ignoresTagFilter) return { volumes: this.volumes };
    return { volumes: this.volumes.filter((volume) => volume.tags.includes(request.tag)) };
  }

  async setVolumeTags(request: { volumeId: string; tags: string[] }) {
    this.record(`setVolumeTags ${request.volumeId} ${request.tags.join('+')}`);
    this.held(request.volumeId);
    this.volumes = this.volumes.map((volume) =>
      volume.id === request.volumeId ? { ...volume, tags: request.tags } : volume,
    );
  }

  async deleteVolume(request: { volumeId: string }) {
    this.record(`deleteVolume ${request.volumeId}`);
    // Like the real one: an attached volume is refused, not detached for us.
    if (this.held(request.volumeId).references.length > 0) throw volumeInUse();
    this.volumes = this.volumes.filter((volume) => volume.id !== request.volumeId);
  }

  /** What the provider does on its own, seconds after the server died. */
  detach(volumeId: string): void {
    this.volumes = this.volumes.map((volume) =>
      volume.id === volumeId ? { ...volume, references: [] } : volume,
    );
  }

  private held(volumeId: string): ScwBlockVolume {
    const volume = this.volumes.find((candidate) => candidate.id === volumeId);
    if (volume === undefined) throw volumeNotFound();
    return volume;
  }
}

export const scwBlockVolume = (
  id: string,
  tags: string[] = [],
  attached = false,
): ScwBlockVolume => ({
  id,
  size: 40_000_000_000,
  tags,
  references: attached ? [{ id: `ref-${id}` }] : [],
});

/** What the sdk hands back for the deletion of an attached volume. */
export const volumeInUse = (): Error =>
  Object.assign(new Error('precondition failed'), { status: 412 });

/** What the sdk hands back for a volume that no longer exists. */
export const volumeNotFound = (): Error =>
  Object.assign(new Error('resource not found'), { status: 404 });
```

Dans `libs/scaleway-compute/src/lib/instance-api.ts`, remplacer le champ `volumes` de `ScwServer` et son commentaire par :

```ts
  /**
   * Its disks, and which api each one answers to. A local one dies by the
   * Instance API; a block one is unknown to it and dies by the Block API.
   */
  readonly volumes: Record<string, { readonly id: string; readonly volumeType: string }>;
```

et ajouter, au-dessus de `export interface ScwServer` :

```ts
/** `volumeType` of a volume the Block Storage API owns. Anything else is local. */
export const BLOCK_VOLUME_TYPE = 'sbs_volume';
```

Dans `libs/scaleway-compute/src/lib/fake-instance-api.ts`, importer `BLOCK_VOLUME_TYPE` depuis `./instance-api.js` (import de valeur, à côté de l'import de types) et remplacer `scwServer` par :

```ts
export const scwServer = (
  id: string,
  tags: string[],
  state = 'running',
  volumeIds: string[] = [],
  blockVolumeIds: string[] = [],
): ScwServer => ({
  id,
  name: `beacon-${id}`,
  state,
  tags,
  volumes: Object.fromEntries(
    [
      ...volumeIds.map((volumeId) => ({ id: volumeId, volumeType: 'l_ssd' })),
      ...blockVolumeIds.map((volumeId) => ({ id: volumeId, volumeType: BLOCK_VOLUME_TYPE })),
    ].map((volume, index) => [String(index), volume]),
  ),
});
```

Dans `libs/scaleway-compute/src/lib/from-sdk.ts`, importer `Blockv1` à côté de `Instancev1` (`import type { Blockv1, Instancev1 } from '@scaleway/sdk';`), importer `import type { BlockApi } from './block-api.js';`, et ajouter à la fin du fichier :

```ts
/** The Block Storage half of the same translation, closed over the same zone. */
export function blockFromSdk(api: Blockv1.API, zone: Zone): BlockApi {
  return {
    listVolumes: async (request) => ({
      volumes: await drain(api.listVolumes({ zone, tags: [request.tag], includeDeleted: false })),
    }),
    setVolumeTags: async (request) => {
      await api.updateVolume({ ...request, zone });
    },
    deleteVolume: (request) => api.deleteVolume({ ...request, zone }),
  };
}
```

Dans `libs/scaleway-compute/src/index.ts`, ajouter dans l'ordre alphabétique :

```ts
export * from './lib/block-api.js';
export * from './lib/fake-block-api.js';
```

Si le typage refuse un littéral de serveur sans `volumeType` dans un fichier de `libs/scaleway-compute` ou de `apps/functions`, lui donner `volumeType: 'l_ssd'`. Aucun autre comportement ne change dans cette tâche : `volumeIdsOf` rend encore tous les volumes.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx run @beacon/scaleway-compute:test` puis `npx nx run-many -t typecheck lint -p @beacon/scaleway-compute @beacon/functions`
Expected: PASS aux deux.

- [ ] **Step 5: Commit**

```bash
git add libs/scaleway-compute
bash ~/.config/github-app/as-agent.sh git commit -m "feat(scaleway-compute): déclare la tranche de l'api bloc dont l'adapter se sert" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

### Task 2: `close()` détruit les volumes bloc de sa session

**Files:**
- Modify: `libs/scaleway-compute/src/lib/scaleway-server-host.ts`
- Modify: `libs/scaleway-compute/src/lib/scaleway-server-host.spec.ts`
- Modify: `libs/scaleway-compute/src/lib/scaleway-server-host.contract.spec.ts` (l'appel au constructeur seulement)
- Modify: `apps/functions/src/container.ts`
- Modify: `apps/functions/src/immediate-pass.spec.ts`
- Modify: `apps/functions/src/watchdog.spec.ts`

**Interfaces:**
- Consumes: `BlockApi`, `ScwBlockVolume`, `isDetached`, `blockFromSdk`, `FakeBlockApi`, `scwBlockVolume`, `volumeInUse`, `volumeNotFound`, `BLOCK_VOLUME_TYPE`, `scwServer(id, tags, state, volumeIds, blockVolumeIds)` de la tâche 1.
- Produces:
  - `export interface DetachmentWait { readonly budgetMs: number; readonly pause: (ms: number) => Promise<void> }` dans `scaleway-server-host.ts` ;
  - `new ScalewayServerHost(api: InstanceApi, block: BlockApi, images: ImageResolver, wait: DetachmentWait)`.

La règle, que les tests ci-dessous épinglent une à une :

- `close()` détruit les IP puis les serveurs, comme avant, puis s'occupe des volumes, que ces destructions aient réussi ou non.
- Un volume de la session est un volume que la liste de l'API bloc rend pour le tag de la session et qui porte ce tag, ou un volume bloc (`volumeType === BLOCK_VOLUME_TYPE`) qu'un serveur de la session attachait.
- À chaque tour : lister ; supprimer par l'API bloc tout volume tagué détaché, et tout volume atteint par l'attachement que la liste ne montre pas attaché ; un volume tagué encore attaché attend sans appel.
- Une suppression refusée par un 404 vaut réussite. Une suppression refusée par un 412 attend le tour suivant. Tout autre refus met fin à l'attente à la fin du tour, et `close()` échoue avec lui.
- Entre deux tours, une pause de 1 s par `wait.pause`. La somme des pauses ne dépasse pas `wait.budgetMs`. Au terme, chaque volume encore là fait échouer `close()`.
- Un refus de la liste met fin à l'attente, et `close()` échoue avec lui.
- La destruction d'un serveur ne demande jamais à l'API instance de supprimer un volume bloc.

- [ ] **Step 1: Write the failing tests**

Dans `libs/scaleway-compute/src/lib/scaleway-server-host.spec.ts`, remplacer les imports, les déclarations et le `beforeEach` du haut du fichier par :

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { World } from '@beacon/session';
import { FakeBlockApi, scwBlockVolume, volumeInUse, volumeNotFound } from './fake-block-api.js';
import { FakeInstanceApi, scwIp, scwServer, scwVolume } from './fake-instance-api.js';
import { ScalewayServerHost, type DetachmentWait } from './scaleway-server-host.js';
import { OWNERSHIP_TAG, sessionTag } from './tags.js';

const owned = (sessionId?: string) =>
  sessionId === undefined ? [OWNERSHIP_TAG] : [OWNERSHIP_TAG, sessionTag(sessionId)];

const images = { resolve: async () => 'img-1' };

let api: FakeInstanceApi;
let block: FakeBlockApi;
let pauses: number[];
/** What the provider does while close() pauses. Called with the pause count so far. */
let duringPause: (count: number) => void;
let wait: DetachmentWait;
let host: ScalewayServerHost;

beforeEach(() => {
  api = new FakeInstanceApi();
  block = new FakeBlockApi();
  pauses = [];
  duringPause = () => undefined;
  wait = {
    budgetMs: 30_000,
    pause: async (ms) => {
      pauses.push(ms);
      duringPause(pauses.length);
    },
  };
  host = new ScalewayServerHost(api, block, images, wait);
});
```

Dans le même fichier, remplacer chaque `new ScalewayServerHost(api, images)` par `new ScalewayServerHost(api, block, images, wait)` et `new ScalewayServerHost(api, none)` par `new ScalewayServerHost(api, block, none, wait)`. Trois tests de `closing something the provider no longer holds` déclarent un `const api` local : ils gardent le `block` et le `wait` du `beforeEach`.

Renommer le test `kills a running server with terminate, which takes its volumes along` en `kills a running server with terminate, which takes its local volumes along`.

Ajouter à la fin du fichier :

```ts
describe('closing the block volumes of a session', () => {
  const tag = sessionTag('sess1');

  // The constraint of the batch: a server opened before block volumes existed.
  it('closes a server on a local disk without a pause or a block deletion', async () => {
    api.servers = [scwServer('s-1', owned('sess1'), 'stopped', ['v-1'])];
    api.ips = [scwIp('ip-1', '51.15.0.1', owned('sess1'))];

    await host.close('sess1');

    expect(api.calls.filter((c) => !c.startsWith('list'))).toEqual([
      'deleteIp ip-1',
      'deleteServer s-1',
      'deleteVolume v-1',
    ]);
    expect(block.calls).toEqual([`listVolumes ${tag}`]);
    expect(pauses).toEqual([]);
  });

  it('deletes a detached volume carrying the session tag', async () => {
    block.volumes = [scwBlockVolume('v-1', owned('sess1'))];

    await host.close('sess1');

    expect(block.volumes).toEqual([]);
    expect(pauses).toEqual([]);
  });

  // Same re-check as for an ip and a server: this is the call that destroys.
  it('leaves alone a volume the provider returned without the session tag', async () => {
    block.ignoresTagFilter = true;
    block.volumes = [scwBlockVolume('v-1', ['beacon-probe', 'session:probe0001'])];

    await host.close('sess1');

    expect(block.volumes).toHaveLength(1);
    expect(block.calls).toEqual([`listVolumes ${tag}`]);
  });

  // terminate leaves a block volume behind, detached 1 to 13 s later.
  it('waits for a tagged volume to detach, then deletes it', async () => {
    api.servers = [scwServer('s-1', owned('sess1'), 'running', [], ['v-1'])];
    block.volumes = [scwBlockVolume('v-1', owned('sess1'), true)];
    duringPause = (count) => {
      if (count === 2) block.detach('v-1');
    };

    await host.close('sess1');

    expect(block.volumes).toEqual([]);
    expect(pauses).toEqual([1_000, 1_000]);
    // Attached and listed as such: nothing is asked of it until it detaches.
    expect(block.calls.filter((c) => c.startsWith('deleteVolume'))).toEqual(['deleteVolume v-1']);
  });

  // A volume whose tags never landed is reached by its server alone.
  it('deletes an untagged block volume by its attachment, retrying while it is in use', async () => {
    api.servers = [scwServer('s-1', owned('sess1'), 'stopped', [], ['v-1'])];
    block.volumes = [scwBlockVolume('v-1', [], true)];
    duringPause = () => block.detach('v-1');

    await host.close('sess1');

    expect(block.volumes).toEqual([]);
    expect(pauses).toEqual([1_000]);
    expect(block.calls.filter((c) => c.startsWith('deleteVolume'))).toEqual([
      'deleteVolume v-1',
      'deleteVolume v-1',
    ]);
  });

  // The Instance API answers 404 for a block volume, which reads as success.
  it('never asks the instance api to delete a block volume', async () => {
    api.servers = [scwServer('s-1', owned('sess1'), 'stopped', ['v-l'], ['v-b'])];
    block.volumes = [scwBlockVolume('v-b')];

    await host.close('sess1');

    expect(api.calls.filter((c) => c.startsWith('deleteVolume'))).toEqual(['deleteVolume v-l']);
    expect(block.calls.filter((c) => c.startsWith('deleteVolume'))).toEqual(['deleteVolume v-b']);
  });

  it('deletes the block volume of a running server it terminated', async () => {
    api.servers = [scwServer('s-1', owned('sess1'), 'running', [], ['v-1'])];
    block.volumes = [scwBlockVolume('v-1')];

    await host.close('sess1');

    expect(block.volumes).toEqual([]);
  });

  it('retries a tagged volume the list calls detached and the deletion calls in use', async () => {
    block.volumes = [scwBlockVolume('v-1', owned('sess1'))];
    block.failWith = { call: 'deleteVolume', error: volumeInUse() };
    duringPause = () => {
      block.failWith = null;
    };

    await host.close('sess1');

    expect(block.volumes).toEqual([]);
    expect(pauses).toEqual([1_000]);
  });

  it('fails once a tagged volume has stayed attached for the whole budget', async () => {
    block.volumes = [scwBlockVolume('v-1', owned('sess1'), true)];

    await expect(host.close('sess1')).rejects.toThrow('volume v-1: still attached after 30 s');

    expect(pauses).toHaveLength(30);
    expect(pauses.reduce((sum, ms) => sum + ms, 0)).toBe(30_000);
  });

  it('fails once a volume reached by its attachment has stayed in use for the whole budget', async () => {
    api.servers = [scwServer('s-1', owned('sess1'), 'stopped', [], ['v-1'])];
    block.volumes = [scwBlockVolume('v-1', [], true)];

    await expect(host.close('sess1')).rejects.toThrow('volume v-1: still attached after 30 s');

    expect(pauses.reduce((sum, ms) => sum + ms, 0)).toBe(30_000);
  });

  it('never pauses past a budget that is not a whole number of polls', async () => {
    block.volumes = [scwBlockVolume('v-1', owned('sess1'), true)];
    host = new ScalewayServerHost(api, block, images, { ...wait, budgetMs: 2_500 });

    await expect(host.close('sess1')).rejects.toThrow('still attached after 2.5 s');

    expect(pauses).toEqual([1_000, 1_000, 500]);
  });

  it('ends the wait on any other refusal, and reports that refusal', async () => {
    block.volumes = [scwBlockVolume('v-1', owned('sess1'))];
    block.failWith = { call: 'deleteVolume', error: new Error('quota exceeded') };

    await expect(host.close('sess1')).rejects.toThrow('volume v-1: Error: quota exceeded');

    expect(pauses).toEqual([]);
  });

  // One try per volume, like everywhere else here.
  it('still deletes the second volume when the first one is refused', async () => {
    block.volumes = [scwBlockVolume('v-1', owned('sess1')), scwBlockVolume('v-2', owned('sess1'))];
    block.failOn = 'deleteVolume v-1';

    await expect(host.close('sess1')).rejects.toThrow('v-1');

    expect(block.volumes.map((volume) => volume.id)).toEqual(['v-1']);
  });

  // A sweep, or an earlier close(), deleted it between the list and the call.
  it('treats a volume that is already gone as closed', async () => {
    block.volumes = [scwBlockVolume('v-1', owned('sess1'))];
    block.failWith = { call: 'deleteVolume', error: volumeNotFound() };

    await expect(host.close('sess1')).resolves.toBeUndefined();
    expect(pauses).toEqual([]);
  });

  it('treats a volume its dead server named, and the provider no longer holds, as closed', async () => {
    api.servers = [scwServer('s-1', owned('sess1'), 'stopped', [], ['v-1'])];

    await expect(host.close('sess1')).resolves.toBeUndefined();
    expect(pauses).toEqual([]);
  });

  it('fails when the block api refuses the listing, the ips and servers already destroyed', async () => {
    api.servers = [scwServer('s-1', owned('sess1'))];
    api.ips = [scwIp('ip-1', '51.15.0.1', owned('sess1'))];
    block.failOn = 'listVolumes';

    await expect(host.close('sess1')).rejects.toThrow('volumes: Error: scaleway refused listVolumes');

    expect(api.servers).toEqual([]);
    expect(api.ips).toEqual([]);
  });

  it('still deletes a detached volume when a server refuses to die, and reports both', async () => {
    api.servers = [scwServer('s-1', owned('sess1'))];
    api.failOn = 'terminate';
    block.volumes = [scwBlockVolume('v-1', owned('sess1')), scwBlockVolume('v-2', owned('sess1'), true)];

    await expect(host.close('sess1')).rejects.toThrow(/server s-1: .*volume v-2: still attached/);

    expect(block.volumes.map((volume) => volume.id)).toEqual(['v-2']);
  });
});

describe('sweepUnclaimed and a block volume', () => {
  it('never asks the instance api to delete the block volume of a stray server', async () => {
    api.servers = [scwServer('s-1', owned(), 'stopped', ['v-l'], ['v-b'])];

    await host.sweepUnclaimed();

    expect(api.calls.filter((c) => c.startsWith('deleteVolume'))).toEqual(['deleteVolume v-l']);
    expect(block.calls).toEqual([]);
  });
});
```

Dans `apps/functions/src/watchdog.spec.ts`, ajouter `FakeBlockApi` et `scwBlockVolume` à l'import de `@beacon/scaleway-compute`, et, juste après le test `turns a refusal from the real adapter into CleanupFailed, intent left open`, ajouter :

```ts
  it('turns a block volume that never detaches into CleanupFailed', async () => {
    const tags = [OWNERSHIP_TAG, sessionTag('sess1')];
    const block = new FakeBlockApi([scwBlockVolume('v-1', tags, true)]);
    await db.doc('provisioning/sess1').set({ closedAt: null });
    await seedWorld('w1', {
      state: 'STOPPING',
      sessionId: 'sess1',
      stateSince: minutesAgo(11),
      instanceId: 'i-1',
    });

    await runWatchdog({
      ...deps(),
      host: new ScalewayServerHost(new FakeInstanceApi(), block, { resolve: async () => null }, {
        budgetMs: 30_000,
        pause: async () => undefined,
      }),
      ledger,
    });

    const [event] = (await db.collection('events').get()).docs;
    expect(event.data()['type']).toBe('CleanupFailed');
    expect(event.data()['detail']).toContain('v-1');
    expect((await db.doc('worlds/w1/server/current').get()).data()?.['state']).toBe('FAILED');
    expect(await ledger.openSessions()).toEqual(['sess1']);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx run @beacon/scaleway-compute:test`
Expected: FAIL, `ScalewayServerHost` n'attend que deux arguments et `DetachmentWait` n'existe pas.

- [ ] **Step 3: Write the implementation**

Dans `libs/scaleway-compute/src/lib/scaleway-server-host.ts` :

Imports : ajouter `import { isDetached, type BlockApi } from './block-api.js';` et passer l'import d'`instance-api.js` à `import { BLOCK_VOLUME_TYPE, type InstanceApi, type ScwIp, type ScwServer } from './instance-api.js';`.

Au-dessus de la classe, ajouter :

```ts
/** How long one close() may wait for the volumes of its session to detach. */
export interface DetachmentWait {
  /**
   * The most one close() spends pausing, in total. It counts the pauses, not
   * the calls between them: the caller's own deadline has to leave room for
   * those.
   */
  readonly budgetMs: number;
  readonly pause: (ms: number) => Promise<void>;
}

/** A block volume detaches 1 to 13 s after its server dies — measured on 2026-10-08. */
const POLL_MS = 1_000;

/** What one round of the wait leaves behind. */
interface VolumeRound {
  /** Refusals that waiting will not cure. */
  readonly refusals: string[];
  readonly stillAttached: string[];
}
```

Le constructeur devient :

```ts
  constructor(
    private readonly api: InstanceApi,
    private readonly block: BlockApi,
    private readonly images: ImageResolver,
    private readonly wait: DetachmentWait,
  ) {}
```

Dans `close()`, la boucle des serveurs et la fin de la méthode deviennent :

```ts
    // Noted before the server dies, and whether or not it does: once it is
    // gone, nothing else ties an untagged block volume to this session.
    const attached: string[] = [];
    for (const server of servers.filter(carrying(tag))) {
      attached.push(...blockVolumeIdsOf(server));
      try {
        await this.destroyServer(server);
      } catch (error) {
        if (isAlreadyGone(error)) continue;
        failures.push(`server ${server.id}: ${String(error)}`);
      }
    }

    failures.push(...(await this.destroyBlockVolumes(tag, attached)));

    // Aggregated, and it still throws: a rejection is how the watchdog learns
    // the cleanup could not be guaranteed and files CleanupFailed.
    if (failures.length > 0) {
      throw new Error(`failed to close session ${sessionId}: ${failures.join(', ')}`);
    }
```

Ajouter la méthode privée, avant `destroyServer` :

```ts
  /**
   * Deletes the block volumes of a session — those carrying its tag, and
   * those its servers held — and returns what could not be deleted.
   *
   * A block volume outlives its server and stays attached for a few seconds
   * after it, during which the provider refuses the deletion. So this polls:
   * a volume still attached waits for the next round, any other refusal ends
   * the wait, and so does the budget.
   */
  private async destroyBlockVolumes(tag: string, attached: readonly string[]): Promise<string[]> {
    const byAttachment = new Set(attached);
    let paused = 0;

    for (;;) {
      let round: VolumeRound;
      try {
        round = await this.deleteDetachedVolumes(tag, byAttachment);
      } catch (error) {
        return [`volumes: ${String(error)}`];
      }
      if (round.refusals.length > 0) return round.refusals;
      if (round.stillAttached.length === 0) return [];

      const left = this.wait.budgetMs - paused;
      if (left <= 0) {
        return round.stillAttached.map(
          (volumeId) =>
            `volume ${volumeId}: still attached after ${this.wait.budgetMs / 1_000} s`,
        );
      }
      const pause = Math.min(POLL_MS, left);
      await this.wait.pause(pause);
      paused += pause;
    }
  }

  /**
   * One round of the wait: lists, then tries every volume that may be
   * detached. Throws only when the listing is refused. A volume of
   * `byAttachment` that is gone leaves the set, so the next round does not ask
   * for it again.
   */
  private async deleteDetachedVolumes(tag: string, byAttachment: Set<string>): Promise<VolumeRound> {
    // One tag, re-checked on what came back, as for an ip and a server.
    const tagged = (await this.block.listVolumes({ tag })).volumes.filter(carrying(tag));

    // An untagged volume is not in the listing, so nothing says whether it is
    // detached: the deletion is the question, and a 412 is the answer.
    const deletable = new Set(byAttachment);
    const stillAttached: string[] = [];
    for (const volume of tagged) {
      if (isDetached(volume)) {
        deletable.add(volume.id);
      } else {
        deletable.delete(volume.id);
        stillAttached.push(volume.id);
      }
    }

    // One try per volume: a refusal on the first must not abandon the second.
    const refusals: string[] = [];
    for (const volumeId of deletable) {
      try {
        await this.block.deleteVolume({ volumeId });
        byAttachment.delete(volumeId);
      } catch (error) {
        if (isAlreadyGone(error)) byAttachment.delete(volumeId);
        else if (isStillAttached(error)) stillAttached.push(volumeId);
        else refusals.push(`volume ${volumeId}: ${String(error)}`);
      }
    }
    return { refusals, stillAttached };
  }
```

Dans `destroyServer`, le commentaire du chemin `running` devient :

```ts
      // One call, and it takes the local volumes with it — not the block ones,
      // which close() deletes once they detach. Deliberately not
      // serverActionAndWait: that helper polls a server terminate has just
      // deleted, gets a 404, and throws after a successful destruction —
      // measured on 2026-09-03, on one server. On two, the throw ends the loop
      // and the second lives; that part is inference, and it is why the loops
      // above catch per resource rather than trusting this call not to throw.
```

et le chemin `stopped` ne supprime plus que les volumes locaux :

```ts
    // A server that never booted refuses terminate outright: "invalid state
    // 'stopped' for the action 'terminate'". Deleting it leaves its local
    // disks behind — billed, detached, absent from the server list, and
    // carrying no tag that would let anyone claim them afterwards. The block
    // ones are not asked of this api, which answers 404 for them: that would
    // read as a deletion.
    const volumeIds = localVolumeIdsOf(server);
```

Remplacer `volumeIdsOf` et son commentaire par :

```ts
function blockVolumeIdsOf(server: ScwServer): string[] {
  return Object.values(server.volumes)
    .filter((volume) => volume.volumeType === BLOCK_VOLUME_TYPE)
    .map((volume) => volume.id);
}

function localVolumeIdsOf(server: ScwServer): string[] {
  return Object.values(server.volumes)
    .filter((volume) => volume.volumeType !== BLOCK_VOLUME_TYPE)
    .map((volume) => volume.id);
}
```

Ajouter après `isAlreadyGone` :

```ts
/**
 * The Block API's refusal to delete a volume something still holds: a 412,
 * measured on 2026-10-08. Read off the error's shape for the reason
 * `isAlreadyGone` gives.
 */
function isStillAttached(error: unknown): boolean {
  const candidate = error as { status?: number; type?: string } | null;
  return candidate?.status === 412 || candidate?.type === 'precondition_failed';
}
```

Dans `libs/scaleway-compute/src/lib/scaleway-server-host.contract.spec.ts`, importer `Blockv1` de `@scaleway/sdk` et `blockFromSdk` de `./from-sdk.js`, et remplacer la construction de `host` par :

```ts
const host = new ScalewayServerHost(
  api,
  blockFromSdk(new Blockv1.API(client), zone),
  marketplaceImages(marketplace, zone),
  { budgetMs: 30_000, pause: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) },
);
```

Dans `apps/functions/src/container.ts`, importer `blockFromSdk` de `@beacon/scaleway-compute` et `Blockv1` de `@scaleway/sdk`, ajouter au-dessus de `buildFirestoreDeps` :

```ts
/**
 * How long a `close()` waits for the volumes of its session to detach. One
 * adapter serves the three Functions that close, so the bound fits the
 * shortest-lived of them: `agentReport`, killed at 60 s.
 */
const VOLUME_DETACHMENT = {
  budgetMs: 30_000,
  pause: (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)),
};
```

et remplacer la construction de `host` par :

```ts
    host: new ScalewayServerHost(
      fromSdk(new Instancev1.API(client), zone as Zone),
      blockFromSdk(new Blockv1.API(client), zone as Zone),
      marketplaceImages(new Marketplacev2.API(client), zone),
      VOLUME_DETACHMENT,
    ),
```

Dans `apps/functions/src/immediate-pass.spec.ts`, importer `FakeBlockApi` et remplacer la construction de `host` par :

```ts
    host = new ScalewayServerHost(api, new FakeBlockApi(), { resolve: async () => 'img-1' }, {
      budgetMs: 30_000,
      pause: async () => undefined,
    });
```

Dans `apps/functions/src/watchdog.spec.ts`, le test `turns a refusal from the real adapter into CleanupFailed, intent left open` construit son hôte ainsi :

```ts
      host: new ScalewayServerHost(api, new FakeBlockApi(), { resolve: async () => null }, {
        budgetMs: 30_000,
        pause: async () => undefined,
      }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx run @beacon/scaleway-compute:test`, puis `npx nx run @beacon/functions:test`, puis `npx nx run-many -t typecheck lint -p @beacon/scaleway-compute @beacon/functions`
Expected: PASS aux trois.

- [ ] **Step 5: Commit**

```bash
git add libs/scaleway-compute apps/functions
bash ~/.config/github-app/as-agent.sh git commit -m "feat(scaleway-compute): détruit à la fermeture les volumes bloc d'une session" -m "Un volume bloc survit à son serveur et reste attaché quelques secondes, pendant lesquelles le fournisseur refuse de le supprimer : close() attend 30 s au plus qu'il se détache." -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

## Rulings log

## Observed drift
