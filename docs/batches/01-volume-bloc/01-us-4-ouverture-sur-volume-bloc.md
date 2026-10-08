# L'ouverture sur un volume bloc Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `open()` crée chaque serveur de jeu sur un volume racine bloc dont la taille dépend du jeu, et pose sur ce volume les deux tags de sa session.

**Architecture:** `GameCatalogEntry` porte `diskGb`, et `apps/functions/src/container.ts` donne à `ScalewayServerHost` une fonction qui le lit pour un jeu. `serverCreation`, dans `libs/scaleway-compute`, compose la demande de création : l'image `instance_sbs` que rend `ImageResolver` et un volume racine `sbs_volume` de la taille demandée ; `open()` et la suite de contrat passent par elle. `open()` réserve l'IP, crée le serveur, pose `OWNERSHIP_TAG` et `sessionTag(sessionId)` sur son volume racine par l'API bloc, dépose le cloud-init, puis allume.

**Tech Stack:** TypeScript, Vitest, `@scaleway/sdk` (`Instancev1`, `Blockv1`, `Marketplacev2`), émulateur Firestore, Nx.

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

Cette story ne modifie que `deploy/cloud-init`, `libs/scaleway-compute`, `apps/functions`, `STACK.md` et ce document.

`libs/session` ne change pas, commentaires compris : ses fichiers entrent dans l'image du compagnon, et tout changement y rend `companion:test` rouge.

`deploy/cloud-init/src/lib/companion-image.ts`, `deploy/companion` et `package-lock.json` ne changent pas.

`OpenServerRequest` ne change pas.

`close()`, `list()` et `sweepUnclaimed()` gardent leur comportement.

`tariffPerHour`, `DEFAULT_SETTINGS`, le semis et les tests épinglés sur 0,05454 €/h et sur `€0.22` ne changent pas.

`defaultInstanceSize` reste `DEV1-L`.

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

- Une fonction de taille qui rend `0`, `NaN` ou un nombre non entier : `open()` refuse avant de réserver l'IP. Test dans la tâche 3.
- Un gabarit dont la seule image compatible est `instance_local` : `open()` refuse avant de réserver l'IP, comme pour un gabarit sans image. Tests dans les tâches 2 et 3.
- Un serveur que le fournisseur rend sans volume bloc : `open()` échoue en nommant l'IP et son tag, ne dépose pas le cloud-init et n'allume pas. Test dans la tâche 3.
- Un tag de volume refusé : `open()` échoue en nommant l'IP et son tag, n'allume pas, ne détruit rien, et `close()` atteint encore ce volume par son attachement. Tests dans la tâche 3.
- Un passage du watchdog juste après une ouverture : le volume racine, attaché et tagué, n'est ni détruit ni signalé. Test dans la tâche 3, `immediate-pass.spec.ts`.

---

### Task 1: La taille du disque de chaque jeu

**Files:**
- Modify: `deploy/cloud-init/src/lib/catalog.ts`
- Modify: `deploy/cloud-init/src/lib/enshrouded.ts`
- Modify: `deploy/cloud-init/src/lib/sunkenland.ts`
- Test: `deploy/cloud-init/src/lib/catalog.spec.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `GameCatalogEntry.diskGb: number`, lu par `catalogFor(game).diskGb`. 40 pour `sunkenland`, 30 pour `enshrouded`.

- [ ] **Step 1: Write the failing test**

À la fin de `catalog.spec.ts` :

```ts
describe('the disk a game boots on', () => {
  it('gives each game its own size, in gigabytes', () => {
    expect(catalogFor('sunkenland').diskGb).toBe(40);
    expect(catalogFor('enshrouded').diskGb).toBe(30);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx nx run cloud-init:test`
Expected: FAIL, `diskGb` est `undefined`. Si le projet ne s'appelle pas `cloud-init`, lire `deploy/cloud-init/package.json` pour son nom Nx.

- [ ] **Step 3: Implement**

`catalog.ts`, dans `GameCatalogEntry`, après `generatesWorlds` :

```ts
  /**
   * The disk a server of this game boots on, in gigabytes: what the system,
   * the containers, the game and its archive occupy together, with room to
   * spare. A constant — a game that outgrows it stalls its own restore.
   * Measured in `probe/RESULTS.md`, section B.
   */
  readonly diskGb: number;
```

`enshrouded.ts`, dans l'entrée, après `generatesWorlds: true,` :

```ts
  // Measured at 15 GB occupied, on a 40 GB volume.
  diskGb: 30,
```

`sunkenland.ts`, dans l'entrée, après `generatesWorlds: false,` :

```ts
  // Measured at 26 GB occupied, at the peak as at rest: a 20 GB volume fills
  // up before the download ends.
  diskGb: 40,
```

- [ ] **Step 4: Run the tests, the lint and the typecheck**

Run: `npx nx run-many -t test lint typecheck -p cloud-init`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add deploy/cloud-init
bash ~/.config/github-app/as-agent.sh git commit -m "feat(cloud-init): donne à chaque jeu la taille de son disque" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

### Task 2: L'image qui démarre sur un volume bloc

**Files:**
- Modify: `libs/scaleway-compute/src/lib/images.ts`
- Create: `libs/scaleway-compute/src/lib/images.spec.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `ImageResolver.resolve(commercialType)` rend l'identifiant de l'image de type `instance_sbs` compatible avec le gabarit, ou `null` quand la zone n'en offre aucune. `BLOCK_IMAGE_TYPE = 'instance_sbs'`, exporté par `images.ts`.

La sonde a relevé, pour `ubuntu_noble` en `fr-par-1` : sur `DEV1-L`, une image `instance_local` listée avant une image `instance_sbs` ; sur `PLAY2-MICRO`, une image `instance_sbs` seule.

- [ ] **Step 1: Write the failing tests**

`images.spec.ts` :

```ts
import type { Marketplacev2 } from '@scaleway/sdk';
import { describe, expect, it } from 'vitest';
import { marketplaceImages } from './images.js';

const image = (id: string, type: string, compatibleCommercialTypes?: string[]) => ({
  id,
  type,
  compatibleCommercialTypes,
});

/**
 * What the marketplace listed for `ubuntu_noble` in fr-par-1 on 2026-10-08, as
 * `probe/scaleway/volume-probe.ts` read it: on `DEV1-L` a local image comes
 * first and a block one follows, on `PLAY2-MICRO` there is a block one only.
 */
const LISTED = [
  image('img-local', 'instance_local', ['DEV1-L', 'DEV1-M']),
  image('img-sbs', 'instance_sbs', ['DEV1-L', 'PLAY2-MICRO']),
];

const requests: unknown[] = [];
const marketplace = (localImages: unknown[]) =>
  ({
    listLocalImages: async (request: unknown) => {
      requests.push(request);
      return { localImages };
    },
  }) as unknown as Marketplacev2.API;

describe('marketplaceImages', () => {
  // The first compatible image is the local one, and a server created from it
  // on a block root volume is the pairing nobody measured.
  it('takes the block image for a size a local image is listed first for', async () => {
    expect(await marketplaceImages(marketplace(LISTED), 'fr-par-1').resolve('DEV1-L')).toBe('img-sbs');
  });

  it('takes the block image for a size that has no local one', async () => {
    expect(await marketplaceImages(marketplace(LISTED), 'fr-par-1').resolve('PLAY2-MICRO')).toBe(
      'img-sbs',
    );
  });

  it('answers null for a size only a local image boots', async () => {
    expect(await marketplaceImages(marketplace(LISTED), 'fr-par-1').resolve('DEV1-M')).toBeNull();
  });

  it('answers null for a size no image names', async () => {
    expect(await marketplaceImages(marketplace(LISTED), 'fr-par-1').resolve('PRO2-XXS')).toBeNull();
  });

  it('skips an image that names no compatible size at all', async () => {
    const listed = [image('img-bare', 'instance_sbs'), ...LISTED];

    expect(await marketplaceImages(marketplace(listed), 'fr-par-1').resolve('DEV1-L')).toBe('img-sbs');
  });

  it('asks for the label in the zone it was built for', async () => {
    requests.length = 0;

    await marketplaceImages(marketplace(LISTED), 'fr-par-1').resolve('DEV1-L');

    expect(requests).toEqual([{ imageLabel: 'ubuntu_noble', zone: 'fr-par-1', pageSize: 100 }]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx nx run @beacon/scaleway-compute:test`
Expected: FAIL sur `takes the block image for a size a local image is listed first for`, qui reçoit `img-local`, et sur `answers null for a size only a local image boots`.

- [ ] **Step 3: Implement**

`images.ts` devient :

```ts
import type { Marketplacev2 } from '@scaleway/sdk';

/**
 * `type` of a marketplace image that boots on a block volume. An
 * `instance_local` one is built for a local disk, and the first compatible
 * image of `DEV1-L` is of that kind — measured on 2026-10-08.
 */
export const BLOCK_IMAGE_TYPE = 'instance_sbs';

/**
 * `image` on a server creation wants a uuid, and it differs per zone and per
 * commercial type; `ubuntu_noble` is a marketplace label. Hand-rolled against
 * the http api, this resolution guessed the response shape wrong twice — the
 * sdk knows it.
 */
export interface ImageResolver {
  /**
   * The image that boots that size on a block volume. Null when the zone
   * offers none.
   */
  resolve(commercialType: string): Promise<string | null>;
}

export function marketplaceImages(
  api: Marketplacev2.API,
  zone: string,
  label = 'ubuntu_noble',
): ImageResolver {
  return {
    async resolve(commercialType: string): Promise<string | null> {
      const { localImages } = await api.listLocalImages({
        imageLabel: label,
        zone,
        pageSize: 100,
      });
      const image = localImages.find(
        (candidate) =>
          candidate.type === BLOCK_IMAGE_TYPE &&
          (candidate.compatibleCommercialTypes ?? []).includes(commercialType),
      );
      return image?.id ?? null;
    },
  };
}
```

- [ ] **Step 4: Run the tests, the lint and the typecheck**

Run: `npx nx run-many -t test lint typecheck -p @beacon/scaleway-compute`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/scaleway-compute
bash ~/.config/github-app/as-agent.sh git commit -m "feat(scaleway-compute): résout l'image qui démarre sur un volume bloc" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

### Task 3: L'ouverture sur un volume racine bloc tagué

**Files:**
- Modify: `libs/scaleway-compute/src/lib/instance-api.ts`
- Create: `libs/scaleway-compute/src/lib/server-creation.ts`
- Create: `libs/scaleway-compute/src/lib/server-creation.spec.ts`
- Modify: `libs/scaleway-compute/src/lib/fake-instance-api.ts`
- Modify: `libs/scaleway-compute/src/lib/scaleway-server-host.ts`
- Modify: `libs/scaleway-compute/src/index.ts`
- Modify: `libs/scaleway-compute/src/lib/scaleway-server-host.contract.spec.ts` (l'appel au constructeur seulement)
- Modify: `apps/functions/src/container.ts`
- Modify: `apps/functions/src/immediate-pass.spec.ts`
- Modify: `apps/functions/src/watchdog.spec.ts`
- Test: `libs/scaleway-compute/src/lib/scaleway-server-host.spec.ts`

**Interfaces:**
- Consumes: `catalogFor(game).diskGb` de la tâche 1 ; `ImageResolver` de la tâche 2 ; `BlockApi.setVolumeTags({ volumeId, tags })`, `FakeBlockApi`, `BLOCK_VOLUME_TYPE`, `blockVolumeIdsOf`, déjà dans `libs/scaleway-compute`.
- Produces:
  - `ServerCreation`, dans `instance-api.ts` : `{ name; commercialType; image; tags; publicIps?; volumes: { '0': { size; volumeType } } }`, et `InstanceApi.createServer(request: ServerCreation)`.
  - `serverCreation(images: ImageResolver, order: ServerOrder): Promise<ServerCreation | null>`, dans `server-creation.ts`, avec `ServerOrder = { name; commercialType; diskGb; tags }`. `null` quand aucune image ne démarre ce gabarit sur un volume bloc.
  - `DiskSizing = (game: Game) => number`, et `new ScalewayServerHost(api, block, images, wait, diskGbFor: DiskSizing)`.
  - `FakeInstanceApi.created: ServerCreation[]` et `FakeInstanceApi.block: FakeBlockApi | null`.

Les règles de `open()` :

- la taille du disque et l'image se résolvent avant toute création ; une taille qui n'est pas un entier strictement positif, ou une image absente, refuse l'ouverture sans rien créer ;
- l'ordre est : réserver l'IP, créer le serveur, poser les tags du volume, déposer le cloud-init, allumer ;
- le volume racine reçoit `OWNERSHIP_TAG` et `sessionTag(sessionId)`, les tags mêmes de l'IP et du serveur ;
- un tag refusé passe par `failing`, comme les autres appels : l'erreur nomme l'IP et son tag ;
- un serveur rendu sans volume bloc fait échouer l'ouverture, en nommant l'IP et son tag ;
- `open()` ne détruit rien.

- [ ] **Step 1: Write the failing tests of the composition**

`server-creation.spec.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { serverCreation } from './server-creation.js';

const ORDER = { name: 'beacon-s1', commercialType: 'DEV1-L', diskGb: 40, tags: ['beacon', 'session:s1'] };

describe('serverCreation', () => {
  it('composes a block root volume of the size ordered, on the image the resolver gave', async () => {
    const images = { resolve: async () => 'img-sbs' };

    expect(await serverCreation(images, ORDER)).toEqual({
      name: 'beacon-s1',
      commercialType: 'DEV1-L',
      image: 'img-sbs',
      tags: ['beacon', 'session:s1'],
      volumes: { '0': { size: 40_000_000_000, volumeType: 'sbs_volume' } },
    });
  });

  it('asks the resolver for the size ordered', async () => {
    const asked: string[] = [];
    const images = {
      resolve: async (commercialType: string) => {
        asked.push(commercialType);
        return 'img-sbs';
      },
    };

    await serverCreation(images, { ...ORDER, commercialType: 'PLAY2-MICRO' });

    expect(asked).toEqual(['PLAY2-MICRO']);
  });

  it('composes nothing when no image boots that size on a block volume', async () => {
    expect(await serverCreation({ resolve: async () => null }, ORDER)).toBeNull();
  });
});
```

- [ ] **Step 2: Write the failing tests of `open()`**

Dans `scaleway-server-host.spec.ts` :

Ajouter `import type { Game } from '@beacon/session';` et, sous `const images = …` :

```ts
const diskGbFor = (game: Game) => (game === 'sunkenland' ? 40 : 30);
```

Dans tout le fichier, chaque `new ScalewayServerHost(a, b, c, d)` reçoit `diskGbFor` en cinquième argument, celui du `beforeEach` de tête compris.

Remplacer tout le `describe('open', …)` par :

```ts
describe('open', () => {
  const REQUEST = {
    sessionId: 's1',
    world: World.from({
      worldId: 'les-copains',
      game: 'enshrouded' as const,
      name: 'Les copains',
      inviteCode: 'c0de',
      players: [],
    }),
    size: 'DEV1-L',
    bootstrap: '#cloud-config\n',
  };
  const SUNKENLAND = {
    ...REQUEST,
    sessionId: 's2',
    world: World.from({
      worldId: 'les-naufrages',
      game: 'sunkenland' as const,
      name: 'Les naufrages',
      inviteCode: 'c0de',
      players: [],
    }),
  };

  beforeEach(() => {
    api.block = block;
  });

  it('carries both tags on the ip and on the server, from creation', async () => {
    await host.open(REQUEST);
    expect(api.ips[0].tags).toEqual(owned('s1'));
    expect(api.servers[0].tags).toEqual(owned('s1'));
  });

  // The ip first, and this is the order the sequence exists for: the address
  // is known before the machine is, which is what lets a join point be
  // announced. It is also what makes the resource reapable if the next call
  // fails — an untagged ip created after a tagged server would be invisible.
  it('reserves the ip before it creates the server', async () => {
    await host.open(REQUEST);
    expect(api.calls.filter((c) => c.startsWith('create'))).toEqual([
      'createIp beacon+session:s1',
      'createServer beacon+session:s1',
    ]);
  });

  it('creates the server from the resolved image, on the ip it reserved', async () => {
    await host.open(REQUEST);
    expect(api.created).toHaveLength(1);
    expect(api.created[0]).toMatchObject({
      name: 'beacon-s1',
      commercialType: 'DEV1-L',
      image: 'img-1',
      publicIps: ['ip-1'],
      tags: owned('s1'),
    });
  });

  it('gives the server a block root volume of the size its game asks for', async () => {
    await host.open(REQUEST);
    await host.open(SUNKENLAND);
    expect(api.created.map((creation) => creation.volumes)).toEqual([
      { '0': { size: 30_000_000_000, volumeType: 'sbs_volume' } },
      { '0': { size: 40_000_000_000, volumeType: 'sbs_volume' } },
    ]);
  });

  // The volume is born of the server, and born without a tag: until these
  // land, nothing but its attachment says whose it is.
  it('puts both tags on the root volume', async () => {
    await host.open(REQUEST);
    expect(block.volumes).toEqual([
      { id: 'vol-1', size: 30_000_000_000, tags: owned('s1'), references: [{ id: 'ref-vol-1' }] },
    ]);
  });

  it('tags the volume once the server exists, and before the cloud-init and the boot', async () => {
    const setVolumeTags = block.setVolumeTags.bind(block);
    let before: string[] = [];
    block.setVolumeTags = async (request) => {
      before = [...api.calls];
      return setVolumeTags(request);
    };

    await host.open(REQUEST);

    expect(before).toEqual(['createIp beacon+session:s1', 'createServer beacon+session:s1']);
    expect(api.calls.slice(before.length)).toEqual(['setServerUserData srv-1', 'powerOn srv-1']);
  });

  // There is no second chance at first boot: user data posted after poweron
  // is read by nothing, and the machine sits there billed and empty.
  it('posts the cloud-init before it powers the machine on', async () => {
    await host.open(REQUEST);
    expect(api.userData.get('srv-1')).toBe(REQUEST.bootstrap);
    // `indexOf` answers -1 for an absent call, and -1 is less than any real
    // index — a bare `toBeLessThan` would pass if `setServerUserData` were
    // never called at all, which is the exact failure this test is named for.
    const setIndex = api.calls.indexOf('setServerUserData srv-1');
    const powerOnIndex = api.calls.indexOf('powerOn srv-1');
    expect(setIndex).toBeGreaterThanOrEqual(0);
    expect(powerOnIndex).toBeGreaterThanOrEqual(0);
    expect(setIndex).toBeLessThan(powerOnIndex);
  });

  it('answers with the address and the provider references', async () => {
    const opened = await host.open(REQUEST);
    expect(opened.address).toBe('51.15.0.1');
    expect(opened.size).toBe('DEV1-L');
    expect(opened.references).toEqual({ instanceId: 'srv-1', ipId: 'ip-1' });
  });

  // The failure that costs money. An ip created and then abandoned keeps
  // billing, and carries the tags that would let the watchdog find it — so the
  // honest thing is to say what exists, not to hide it behind a bare throw.
  it('names the ip it already created when the server refuses', async () => {
    api.failOn = 'createServer';
    await expect(host.open(REQUEST)).rejects.toThrow(/ip ip-1 is tagged session:s1/);
  });

  it('fails the same way when the tags do not land, and destroys nothing', async () => {
    block.failOn = 'setVolumeTags';

    await expect(host.open(REQUEST)).rejects.toThrow(
      /failed to open s1: ip ip-1 is tagged session:s1 — .*setVolumeTags/,
    );

    expect(api.calls).toEqual(['createIp beacon+session:s1', 'createServer beacon+session:s1']);
    expect(block.calls).toEqual(['setVolumeTags vol-1 beacon+session:s1']);
    expect(api.ips).toHaveLength(1);
    expect(api.servers).toHaveLength(1);
    expect(block.volumes).toHaveLength(1);
  });

  // What is left of that failure is a tagged server holding an untagged
  // volume, and close() reaches the volume through the server.
  it('leaves a volume whose tags never landed within reach of close()', async () => {
    block.failOn = 'setVolumeTags';
    await expect(host.open(REQUEST)).rejects.toThrow();
    block.failOn = null;
    duringPause = () => block.detach('vol-1');

    await host.close('s1');

    expect(api.ips).toEqual([]);
    expect(api.servers).toEqual([]);
    expect(block.volumes).toEqual([]);
  });

  // A server on a local disk would boot, untagged volume and all: nothing
  // downstream would notice, so the opening says so.
  it('fails when the provider returns a server without a block volume', async () => {
    api.createServer = async (request) => {
      api.calls.push(`createServer ${request.tags.join('+')}`);
      return { server: scwServer('srv-9', request.tags, 'stopped', ['v-l']) };
    };

    await expect(host.open(REQUEST)).rejects.toThrow(
      /no block volume.*ip ip-1 is tagged session:s1/,
    );

    expect(block.calls).toEqual([]);
    expect(api.calls).toEqual(['createIp beacon+session:s1', 'createServer beacon+session:s1']);
  });

  it('refuses to open when no image matches the size', async () => {
    const none = { resolve: async () => null };
    await expect(
      new ScalewayServerHost(api, block, none, wait, diskGbFor).open(REQUEST),
    ).rejects.toThrow(/no ubuntu image/);
    expect(api.calls).toEqual([]);
  });

  it.each([0, -40, 12.5, Number.NaN])(
    'refuses to open a game whose disk size is %s, before anything is created',
    async (diskGb) => {
      await expect(
        new ScalewayServerHost(api, block, images, wait, () => diskGb).open(REQUEST),
      ).rejects.toThrow(/no disk size for enshrouded/);
      expect(api.calls).toEqual([]);
    },
  );
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx nx run @beacon/scaleway-compute:test`
Expected: FAIL, `server-creation.js` introuvable et `api.created` indéfini.

- [ ] **Step 4: Implement the composition and the fake**

`instance-api.ts`, avant `InstanceApi` :

```ts
/** What a server is created from. `serverCreation` composes it. */
export interface ServerCreation {
  readonly name: string;
  readonly commercialType: string;
  readonly image: string;
  readonly tags: string[];
  /** Absent when the server gets no flexible ip. */
  readonly publicIps?: string[];
  /**
   * The root volume, under the key the provider boots from, its size in bytes.
   * It takes no tag: the sdk offers none on the volume of a creation.
   */
  readonly volumes: { readonly '0': { readonly size: number; readonly volumeType: string } };
}
```

et, dans `InstanceApi` :

```ts
  createServer(request: ServerCreation): Promise<{ server?: ScwServer }>;
```

`server-creation.ts` :

```ts
import type { ImageResolver } from './images.js';
import { BLOCK_VOLUME_TYPE, type ServerCreation } from './instance-api.js';

/** The provider counts a volume in bytes, and a gigabyte in powers of ten. */
const BYTES_PER_GB = 1e9;

export interface ServerOrder {
  readonly name: string;
  readonly commercialType: string;
  readonly diskGb: number;
  readonly tags: string[];
}

/**
 * The one place a server creation is composed, for `open()` and for the
 * contract suite alike: the image that boots on a block volume, and a block
 * root volume of the size ordered. The two go together — a local image on a
 * block volume, or the reverse, is a pairing nobody measured.
 *
 * Null when no such image exists for that size, and nothing is created yet.
 */
export async function serverCreation(
  images: ImageResolver,
  order: ServerOrder,
): Promise<ServerCreation | null> {
  const image = await images.resolve(order.commercialType);
  if (image === null) return null;

  return {
    name: order.name,
    commercialType: order.commercialType,
    image,
    tags: order.tags,
    volumes: { '0': { size: order.diskGb * BYTES_PER_GB, volumeType: BLOCK_VOLUME_TYPE } },
  };
}
```

`index.ts` gagne, à sa place alphabétique :

```ts
export * from './lib/server-creation.js';
```

`fake-instance-api.ts` : importer `import type { FakeBlockApi } from './fake-block-api.js';` et `ServerCreation` depuis `./instance-api.js`, ajouter aux champs de la classe :

```ts
  /** Every creation asked for, so a test can assert what a server is built from. */
  readonly created: ServerCreation[] = [];
  /**
   * Where the root volume of a created server is born. The two fakes share
   * nothing else: a test that opens a server sets this, or the server names a
   * volume no Block api holds.
   */
  block: FakeBlockApi | null = null;
```

et remplacer `createServer` par :

```ts
  async createServer(request: ServerCreation) {
    this.record(`createServer ${request.tags.join('+')}`);
    this.created.push(request);
    // `stopped`, like the real one: a server is created before it is powered
    // on, and the two death paths of §6 turn on exactly this field.
    const volumeId = `vol-${this.nextId}`;
    const server = scwServer(`srv-${this.nextId}`, request.tags, 'stopped', [], [volumeId]);
    this.servers.push(server);
    // Like the real one too: the root volume is born without a tag, and
    // attached from the creation — measured on 2026-10-08.
    this.block?.volumes.push({
      id: volumeId,
      size: request.volumes['0'].size,
      tags: [],
      references: [{ id: `ref-${volumeId}` }],
    });
    this.nextId += 1;
    return { server };
  }
```

- [ ] **Step 5: Implement `open()`**

`scaleway-server-host.ts` :

Importer `Game` depuis `@beacon/session` dans l'import de types existant, et `import { serverCreation } from './server-creation.js';`.

Après `DetachmentWait` :

```ts
/** The disk a server of that game boots on, in gigabytes. */
export type DiskSizing = (game: Game) => number;
```

Le constructeur :

```ts
  constructor(
    private readonly api: InstanceApi,
    private readonly block: BlockApi,
    private readonly images: ImageResolver,
    private readonly wait: DetachmentWait,
    private readonly diskGbFor: DiskSizing,
  ) {}
```

`open()`, du début jusqu'au dépôt du cloud-init exclu :

```ts
  async open(request: OpenServerRequest): Promise<OpenedServer> {
    // Both tags, from creation (§5). The constant one is what makes "every
    // resource of this system whose session is unknown" a query the api can
    // answer; the session one is what pairs a resource with its intent.
    const tags = [OWNERSHIP_TAG, sessionTag(request.sessionId)];

    // Before anything is created: a game without a disk, or a size without an
    // image, must cost nothing.
    const { game } = request.world;
    const diskGb = this.diskGbFor(game);
    if (!Number.isInteger(diskGb) || diskGb <= 0) {
      throw new Error(`no disk size for ${game}`);
    }
    const creation = await serverCreation(this.images, {
      name: `beacon-${request.sessionId}`,
      commercialType: request.size,
      diskGb,
      tags,
    });
    if (creation === null) {
      throw new Error(`no ubuntu image for ${request.size} on a block volume`);
    }

    const { ip } = await this.api.createIp({ tags });
    if (ip?.address === undefined) {
      throw new Error('createIp returned no address — nothing to announce, nothing to attach');
    }

    // From here on, a failure has already spent money. Every throw names the
    // ip and how it is tagged — the earliest resource created, and enough to
    // find the whole attempt by tag, whatever else did or didn't get created
    // after it. The watchdog reaps all of it within five minutes regardless,
    // which the message does not have to enumerate.
    const created = await this.failing(
      () => this.api.createServer({ ...creation, publicIps: [ip.id] }),
      ip,
      request,
    );
    const server = created.server;
    if (server === undefined) {
      throw new Error(
        `createServer returned no server, and ip ${ip.id} is tagged ${sessionTag(request.sessionId)}`,
      );
    }

    await this.tagRootVolume(server, tags, ip, request);
```

La suite de `open()`, du dépôt du cloud-init au `return`, ne change pas.

Après `failing`, une méthode privée :

```ts
  /**
   * The volume is born of the server and born untagged: the sdk offers no tag
   * on the volume of a creation. Until the tags land, only its attachment to
   * the server reaches it — which is how close() finds it if they never do.
   */
  private async tagRootVolume(
    server: ScwServer,
    tags: string[],
    ip: ScwIp,
    request: OpenServerRequest,
  ): Promise<void> {
    const volumeIds = blockVolumeIdsOf(server);
    // A server on a local disk would boot all the same, and nothing downstream
    // would notice.
    if (volumeIds.length === 0) {
      throw new Error(
        `createServer returned no block volume, and ip ${ip.id} is tagged ${sessionTag(request.sessionId)}`,
      );
    }
    for (const volumeId of volumeIds) {
      await this.failing(() => this.block.setVolumeTags({ volumeId, tags }), ip, request);
    }
  }
```

Le commentaire de `failing` : remplacer « the resources carry both tags » par « the ip and the server carry both tags, and the volume is held by the server ».

- [ ] **Step 6: Give every caller its fifth argument**

`scaleway-server-host.contract.spec.ts`, l'appel au constructeur seulement — la tâche 4 récrit le reste :

```ts
const host = new ScalewayServerHost(
  api,
  blockFromSdk(new Blockv1.API(client), zone),
  marketplaceImages(marketplace, zone),
  { budgetMs: 30_000, pause: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) },
  () => DISK_GB,
);
```

avec, sous `COMMERCIAL_TYPE` :

```ts
/** The size the probe measured a block root volume at. */
const DISK_GB = 40;
```

`apps/functions/src/container.ts` : importer `catalogFor` depuis `@beacon/cloud-init`, et l'hôte devient :

```ts
    host: new ScalewayServerHost(
      fromSdk(new Instancev1.API(client), zone as Zone),
      blockFromSdk(new Blockv1.API(client), zone as Zone),
      marketplaceImages(new Marketplacev2.API(client), zone),
      VOLUME_DETACHMENT,
      // The catalogue knows what a game occupies; the adapter only knows it
      // needs a number.
      (game) => catalogFor(game).diskGb,
    ),
```

`apps/functions/src/watchdog.spec.ts` : les trois `new ScalewayServerHost(…)` reçoivent `() => 40` en cinquième argument.

`apps/functions/src/immediate-pass.spec.ts` : déclarer `let block: FakeBlockApi;` à côté de `let api`, et le montage devient :

```ts
    block = new FakeBlockApi();
    api = new FakeInstanceApi();
    api.block = block;
    host = new ScalewayServerHost(api, block, { resolve: async () => 'img-1' }, {
      budgetMs: 30_000,
      pause: async () => undefined,
    }, () => 40);
```

Dans le test `leaves the machine it just created alone`, après `expect(api.ips).toHaveLength(1);` qui suit `runWatchdog` :

```ts
    // Attached and tagged: the sweep neither destroys nor reports it.
    expect(block.volumes).toHaveLength(1);
    expect(block.volumes[0].tags).toEqual(api.servers[0].tags);
    expect(block.calls.filter((call) => call.startsWith('deleteVolume'))).toEqual([]);
```

Si `sessionOf`, `OWNERSHIP_TAG` ou un autre nom manque à ce fichier, n'importer que ce que ces lignes emploient.

- [ ] **Step 7: Run the tests, the lint and the typecheck**

Run: `npx nx run-many -t test lint typecheck -p @beacon/scaleway-compute @beacon/functions`
Expected: PASS. Un test de `apps/functions` qui ouvre un serveur par le vrai adapter et échoue sur `resource not found` n'a pas relié `api.block` : le relier, sans toucher à l'adapter.

- [ ] **Step 8: Commit**

```bash
git add libs/scaleway-compute apps/functions
bash ~/.config/github-app/as-agent.sh git commit -m "feat(scaleway-compute): ouvre un serveur de jeu sur un volume bloc tagué" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

### Task 4: La suite de contrat sur un volume bloc, et `STACK.md`

**Files:**
- Modify: `libs/scaleway-compute/src/lib/scaleway-server-host.contract.spec.ts`
- Modify: `STACK.md`

**Interfaces:**
- Consumes: `serverCreation(images, order)` et `DISK_GB` de la tâche 3 ; `blockFromSdk`, `BlockApi.listVolumes`, `setVolumeTags`, `deleteVolume`, `isDetached`, `BLOCK_VOLUME_TYPE`, `marketplaceImages`.
- Produces: rien qu'une autre tâche lise.

La suite de contrat ne se lance pas : elle atteint le compte réel. Sa seule vérification ici est le lint et le typecheck.

- [ ] **Step 1: Rewrite the contract suite**

Dans `scaleway-server-host.contract.spec.ts` :

Les imports gagnent `isDetached` depuis `./block-api.js`, `BLOCK_VOLUME_TYPE` depuis `./instance-api.js` et `serverCreation` depuis `./server-creation.js`.

Le paragraphe `Budget` du commentaire de tête devient :

```ts
 * Budget: under 0.02 EUR. Billing is per hour started, each resource counted
 * separately — and the server here never boots, so what costs is one hour of
 * a flexible ip (0.005 EUR) and one hour of a 40 GB block volume (0.0052 EUR,
 * at the public rate read on 2026-10-08). The hour is due whatever the test's
 * real duration.
```

Le client bloc et le résolveur se nomment, pour que l'hôte et les tests partagent la traduction de production :

```ts
const api = fromSdk(sdk, zone);
const block = blockFromSdk(new Blockv1.API(client), zone);
const images = marketplaceImages(marketplace, zone);
const host = new ScalewayServerHost(
  api,
  block,
  images,
  { budgetMs: 30_000, pause: (ms) => new Promise((resolve) => setTimeout(resolve, ms)) },
  () => DISK_GB,
);
```

Le second test, `destroys a never-booted server and its disk`, est remplacé en entier par :

```ts
  // The dangerous path, and the reason this test costs an hour: terminate is
  // refused on a server that never booted, deleting it leaves the volume, and
  // the volume is unknown to the api that deleted the server.
  it('destroys a never-booted server and its block volume', async () => {
    // The composition `open()` creates from, not a copy of it: the image and
    // the root volume are what this test measures against the provider.
    const creation = await serverCreation(images, {
      name: `beacon-${SESSION}`,
      commercialType: COMMERCIAL_TYPE,
      diskGb: DISK_GB,
      tags,
    });
    if (creation === null) {
      throw new Error(`no ubuntu image for ${COMMERCIAL_TYPE} on a block volume in ${zone}`);
    }
    const created = await sdk.createServer({ zone, project: projectId, ...creation });
    // A missing server means the contract itself is broken — fail loudly here
    // rather than let `?? ''` and `?? {}` turn it into a confusing assertion
    // failure three lines down.
    if (created.server === undefined) throw new Error('createServer returned no server');
    // `created.server` is `any` here (see the comment on `api.listServers`
    // below): this setup creates through `sdk.createServer` directly rather
    // than through `InstanceApi.createServer`, on purpose — it is checking the
    // raw sdk response shape that `open()` is built on, not the adapter's own
    // translation of it, so routing through the adapter here would beg the
    // question. `CreatedServerShape` names the shape the vendor's docs
    // promise; the assertions right after are the actual oracle.
    const server = created.server as CreatedServerShape;
    expect(typeof server.id).toBe('string');
    expect(server.id.length).toBeGreaterThan(0);
    const serverId = server.id;

    // One volume, and a block one: what `open()` tags, and what `close()`
    // sorts by type to know which api deletes it.
    const rootVolumes = Object.values(server.volumes);
    expect(rootVolumes).toHaveLength(1);
    expect(rootVolumes[0].volumeType).toBe(BLOCK_VOLUME_TYPE);
    const volumeId = rootVolumes[0].id;
    expect(typeof volumeId).toBe('string');
    expect(volumeId.length).toBeGreaterThan(0);

    // Born without a tag, and absent from the Instance API's listing: the two
    // facts that make the Block API the only way to it.
    const untagged = await block.listVolumes({ tag: sessionTag(SESSION) });
    expect(untagged.volumes.map((volume) => volume.id)).not.toContain(volumeId);
    const { volumes: local } = await api.listVolumes();
    expect(local.map((volume) => volume.id)).not.toContain(volumeId);

    await block.setVolumeTags({ volumeId, tags });

    // The same pair as for an ip and a server: the full tag reaches the
    // volume, the strict prefix `session:` does not.
    const { volumes: byFullTag } = await block.listVolumes({ tag: sessionTag(SESSION) });
    const listed = byFullTag.find((volume) => volume.id === volumeId);
    if (listed === undefined) throw new Error('the tagged volume is not in the listing by its tag');
    expect([...listed.tags].sort()).toEqual([...tags].sort());
    expect(listed.size).toBe(DISK_GB * 1e9);
    const { volumes: byPrefix } = await block.listVolumes({ tag: 'session:' });
    expect(byPrefix.map((volume) => volume.id)).not.toContain(volumeId);
    const { volumes: whole } = await block.listVolumes({});
    expect(whole.map((volume) => volume.id)).toContain(volumeId);

    // Attached from the creation, before any boot: the references of a listed
    // volume are what `isDetached` reads, for close() and for the sweep.
    expect(listed.references.length).toBeGreaterThan(0);
    expect(isDetached(listed)).toBe(false);

    // The refusal close() retries on. `isStillAttached` reads a 412, and
    // nothing bound that to the sdk's error until this.
    await expect(block.deleteVolume({ volumeId })).rejects.toMatchObject({ status: 412 });

    // Tranche 0 measured `tags=` exact only on the flexible ip, never on a
    // server — and the whole reconciliation's tag-based ownership rests on
    // servers behaving the same way. Same pair as the ip case above: the
    // positive control proves the full-tag query reaches this server, the
    // negative — the strict prefix `session:` — is the actual measurement,
    // extended here from ips to servers.
    const { servers: byServerTag } = await api.listServers({ tags: [sessionTag(SESSION)] });
    expect(byServerTag.map((s) => s.id)).toContain(serverId);
    const { servers: byServerPrefix } = await api.listServers({ tags: ['session:'] });
    expect(byServerPrefix.map((s) => s.id)).not.toContain(serverId);

    // Deletes the server, waits for the volume to detach, deletes it by tag.
    await host.close(SESSION);

    // Through the translation, not `sdk.listServers` directly. Not because
    // pagination is special: `Instancev1.API`'s own declaration file doesn't
    // resolve under this project's module resolution — its barrel re-exports
    // `./api.utils`, `./content.gen`, `./types.gen` and `./types.utils`
    // without the `.js` extension `nodenext` requires — and `skipLibCheck`
    // swallows that failure into `any` for every method on the class, this
    // one included. `fromSdk`'s explicit `InstanceApi` return type is what
    // restores checking at the boundary; routing through `api` keeps this
    // assertion typed instead of trusting an `any`.
    const { servers } = await api.listServers({ tags: [sessionTag(SESSION)] });
    expect(servers.map((s) => s.id)).not.toContain(serverId);

    const { volumes: after } = await block.listVolumes({});
    expect(after.map((volume) => volume.id)).not.toContain(volumeId);

    // A second deletion, as a sweep and a close() after the same volume make
    // one: `isAlreadyGone` reads a 404, and that is what must come back.
    await expect(block.deleteVolume({ volumeId })).rejects.toMatchObject({ status: 404 });
  }, 300_000);
```

`CreatedServerShape` devient :

```ts
interface CreatedServerShape {
  readonly id: string;
  readonly volumes: Record<string, { readonly id: string; readonly volumeType: string }>;
}
```

La fonction `resolveImageId` de fin de fichier, son commentaire et tout import devenu inutile sont supprimés.

- [ ] **Step 2: Rewrite `STACK.md`**

Dans `STACK.md`, le paragraphe `**Serveur de jeu**` devient :

```markdown
**Serveur de jeu** — **Scaleway**, région `fr-par` (Paris), zone `fr-par-1` :
Instances pour le calcul, Block Storage pour le disque de chaque serveur de jeu,
Object Storage pour les sauvegardes. Le gabarit est libre et réservé à l'admin ;
`DEV1-L` est le défaut. Tout serveur démarre sur un volume bloc, donc un gabarit
livré sans disque local se commande comme un autre. Le `PRO2-XXS` que ce
fichier nommait n'est commandable dans aucune zone parisienne. Le **DNS reste
chez OVH**, en DynHost : le domaine y est, et un enregistrement A pointe où l'on
veut.
```

Dans le paragraphe suivant, après la phrase qui se termine par « `scaleway-compute`, `scaleway-storage`, `ovh-dns`. », ajouter :

```markdown
Le stockage bloc passe par `scaleway-compute`, avec les identifiants du calcul.
```

Le reste du fichier ne change pas. Prettier ne tourne pas dessus.

- [ ] **Step 3: Run the lint and the typecheck**

Run: `npx nx run-many -t test lint typecheck -p @beacon/scaleway-compute`
Expected: PASS. La cible `test` ne lance pas la suite de contrat ; la cible `test-contract` ne se lance pas.

- [ ] **Step 4: Commit**

```bash
git add libs/scaleway-compute STACK.md
bash ~/.config/github-app/as-agent.sh git commit -m "test(scaleway-compute): exerce l'api bloc dans la suite de contrat" -m "Co-Authored-By: Charlouze <me@charlouze.com>"
```

## Rulings log

## Observed drift
