# Le tarif sur un volume bloc Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `DEFAULT_SETTINGS` et le semis portent un taux par gabarit calculé sur un volume bloc de 40 Go : 0,05304 €/h pour `DEV1-L` et 0,06528 €/h pour `PLAY2-MICRO`.

**Architecture:** `tariffPerHour` garde sa forme, un taux tout compris par gabarit. `DEFAULT_SETTINGS`, dans `libs/session/src/lib/settings.ts`, et le semis, dans `apps/functions/src/seed.ts`, portent les deux mêmes taux, et un test du semis les compare. `forecastCost` et `estimatedCost` gardent leur code.

**Tech Stack:** TypeScript, Vitest, Angular TestBed, émulateur Firestore, Nx.

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

Cette story ne modifie que `libs/session`, `apps/functions/src/seed.ts`, `apps/functions/src/seed.spec.ts`, `apps/web/src/app/session/out-of-service.component.spec.ts` et ce document.

`defaultInstanceSize` reste `DEV1-L`.

`forecastCost`, `estimatedCost` et la forme de `SessionSettings` gardent leur code.

`libs/session/src/lib/ports.ts`, `events.ts` et `watchdog/reconcile.ts` ne changent pas.

`deploy/companion`, `deploy/cloud-init`, `libs/scaleway-compute`, `STACK.md` et `.impeccable/` ne changent pas.

Aucune commande n'écrit dans `config/settings` hors de l'émulateur, et le semis ne se lance que par son test.

### L'épinglage du compagnon

`libs/session/src/lib/settings.ts` entre dans l'image du compagnon : après cette story, `npx nx run companion:test` échoue sur `names an image built from the sources in the tree`, de `deploy/companion/src/pin/catalogue-pin.spec.ts`.

Cet échec est attendu, et aucun autre ne l'est.

Aucune tâche ne modifie `deploy/companion` ni `deploy/cloud-init/src/lib/companion-image.ts`, ne lance `companion:pin`, ni ne pose de tag git.

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

Aucun fichier de `libs/session` ne nomme un fournisseur ni un jeu, hors les gabarits que `DEFAULT_SETTINGS` porte.

Aucun fichier ne mentionne un agent ni un outil d'IA.

Aucune commande n'atteint la production : ni `firebase deploy`, ni appel à un fournisseur, ni écriture hors de l'émulateur.

Prettier ne tourne pas sur les sources.

Toute commande `git` qui écrit un commit passe par `bash ~/.config/github-app/as-agent.sh git …`, et le message se termine par `Co-Authored-By: Charlouze <me@charlouze.com>` et par rien d'autre.

`npx nx run @beacon/functions:test` lance l'émulateur sur le port 8080 : un seul lancement à la fois.

## Review Focus

- Un document `config/settings` qui porte déjà un taux : il l'emporte sur `DEFAULT_SETTINGS`. Test existant, `follows the deployed document, never a rate compiled into a bundle`.
- Un gabarit qu'aucun taux ne nomme : le coût affiché est nul. Tests existants, `quotes zero for a size no tariff names` et `charges nothing for a size no tariff names`.
- Une session ouverte sur `PLAY2-MICRO` : son coût se compte à son propre taux, et non à celui du gabarit par défaut. Test dans la tâche 1, `session-aggregate.spec.ts`.
- Un semis et un `DEFAULT_SETTINGS` qui portent des taux différents : un test du semis échoue. Test dans la tâche 1, `seed.spec.ts`.
- Un `config/settings` déjà semé : le semis le laisse tel quel. Test existant, `leaves an existing document untouched`.

---

### Task 1: Les deux taux, dans le domaine et dans le semis

**Files:**
- Modify: `libs/session/src/lib/settings.ts`
- Modify: `apps/functions/src/seed.ts`
- Test: `libs/session/src/lib/settings.spec.ts`
- Test: `libs/session/src/lib/session-aggregate.spec.ts`
- Test: `apps/functions/src/seed.spec.ts`
- Test: `apps/web/src/app/session/out-of-service.component.spec.ts`

**Interfaces:**
- Consumes: `DEFAULT_SETTINGS`, `forecastCost`, `Session`, `Deadline` de `@beacon/session` ; `seed()` de `apps/functions/src/seed.ts`.
- Produces: `DEFAULT_SETTINGS.tariffPerHour` vaut `{ 'DEV1-L': 0.05304, 'PLAY2-MICRO': 0.06528 }`, et le semis écrit la même valeur.

Un taux est la somme de trois lignes, en €/h : l'instance, un volume bloc de 40 Go à 0,000130 €/Go/h, soit 0,0052, et l'IP à 0,005.

| Gabarit | Instance | Disque, 40 Go | IP | Taux |
|---|---|---|---|---|
| `DEV1-L` | 0,04284 | 0,0052 | 0,005 | 0,05304 |
| `PLAY2-MICRO` | 0,05508 | 0,0052 | 0,005 | 0,06528 |

Une session de quatre heures au gabarit par défaut vaut 0,21216 €, affiché `€0.21`.

- [ ] **Step 1: Write the failing tests in `libs/session`**

Dans `libs/session/src/lib/settings.spec.ts`, remplacer les deux premiers tests de `describe('forecastCost', …)` par :

```ts
  /**
   * §11: the started hour is due, and a rate already sums instance, disk and
   * ip. A full session at the default size, and nothing else — this is a quote,
   * not a spend.
   */
  it('quotes a full session at the default size', () => {
    expect(forecastCost(DEFAULT_SETTINGS)).toBeCloseTo(0.21, 2);
  });

  it('bills the started hour, so a half-hour session still quotes one', () => {
    // 0.05304 and not 0.05: asserted to four places, because two would pass on
    // a rate that had been halved.
    expect(forecastCost({ ...DEFAULT_SETTINGS, sessionDurationMs: 30 * 60_000 })).toBeCloseTo(
      0.053,
      4,
    );
  });
```

À la fin du même fichier, ajouter :

```ts
describe('DEFAULT_SETTINGS', () => {
  it('carries one all-inclusive rate per size, and keeps the default size', () => {
    expect(DEFAULT_SETTINGS.defaultInstanceSize).toBe('DEV1-L');
    expect(DEFAULT_SETTINGS.tariffPerHour).toEqual({ 'DEV1-L': 0.05304, 'PLAY2-MICRO': 0.06528 });
  });
});
```

Dans `libs/session/src/lib/session-aggregate.spec.ts`, dans le test `charges the started hour, never the fraction`, remplacer la seconde attente par :

```ts
    expect(session.estimatedCost(at('2026-09-06T23:30:00Z'), S)).toBeCloseTo(0.21, 2);
```

Dans le même fichier, juste avant le test `charges nothing for a size no tariff names`, ajouter :

```ts
  it('charges a session at the rate of its own size, not of the default one', () => {
    const session = Session.from({
      state: 'RUNNING',
      sessionId: 's1',
      worldId: ENSHROUDED_WORLD.worldId,
      game: 'enshrouded',
      startedBy: 'u1',
      startedAt: new Date('2026-09-06T20:00:00Z'),
      deadline: Deadline.at(new Date('2026-09-07T00:00:00Z')),
      instanceSize: 'PLAY2-MICRO',
      hasJoinInfo: true,
    });
    expect(session.estimatedCost(at('2026-09-06T23:30:00Z'), S)).toBe(0.26);
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `npx nx run @beacon/session:test`
Expected: FAIL sur les cinq tests touchés ; `0.2182` au lieu de `0.21`, `0.05454` au lieu de `0.053`, un `tariffPerHour` sans `PLAY2-MICRO`, `0.22` au lieu de `0.21`, et `0` au lieu de `0.26`.

- [ ] **Step 3: Write the rates in `libs/session/src/lib/settings.ts`**

Remplacer le commentaire de `tariffPerHour`, dans `SessionSettings`, par :

```ts
  /**
   * Per size, and all-inclusive: instance, disk and ip. Each is billed by the
   * started hour (§11), so one rate per size is the honest unit — splitting
   * them would invite adding them up wrong. The disk counts at the largest
   * size any game boots on: a rate may run over what a session costs, never
   * under.
   */
```

Remplacer la dernière ligne de `DEFAULT_SETTINGS` par :

```ts
  tariffPerHour: { 'DEV1-L': 0.05304, 'PLAY2-MICRO': 0.06528 },
```

- [ ] **Step 4: Run them to verify they pass**

Run: `npx nx run @beacon/session:test`
Expected: PASS, aucun test en échec.

- [ ] **Step 5: Write the failing test of the seed**

Dans `apps/functions/src/seed.spec.ts`, ajouter l'import :

```ts
import { DEFAULT_SETTINGS } from '@beacon/session';
```

Dans `describe('seed', …)`, après le test `seeds config/settings with both reserved fields unstamped`, ajouter :

```ts
  // Two writings of the same rates: a seeded system and one that falls back on
  // the domain must quote the same price.
  it('seeds the size and the rates the domain falls back on', async () => {
    await seed();

    const settings = (await db.doc('config/settings').get()).data();
    expect(settings?.['defaultInstanceSize']).toBe(DEFAULT_SETTINGS.defaultInstanceSize);
    expect(settings?.['tariffPerHour']).toEqual(DEFAULT_SETTINGS.tariffPerHour);
  });
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx nx run @beacon/functions:test`
Expected: FAIL sur `seeds the size and the rates the domain falls back on`, le semis écrivant `{ 'DEV1-L': 0.05454 }`.

- [ ] **Step 7: Write the rates in `apps/functions/src/seed.ts`**

Remplacer le commentaire et la ligne de `tariffPerHour` par :

```ts
      // All-inclusive per size: instance, a 40 GB block volume and flexible
      // ip, each billed by the started hour (§11). 40 GB is the largest disk
      // a game boots on, so a larger one moves these rates. The ip rate is
      // matched by an invoice; the block volume one, 0.000130 €/GB/h, is the
      // public price read on 2026-10-08 and matched by none.
      tariffPerHour: { 'DEV1-L': 0.05304, 'PLAY2-MICRO': 0.06528 },
```

- [ ] **Step 8: Run it to verify it passes**

Run: `npx nx run @beacon/functions:test`
Expected: PASS, aucun test en échec.

- [ ] **Step 9: Move the price the out-of-service screen is pinned on**

Run: `npx nx run web:test`
Expected: FAIL sur `quotes the next session from the deployed settings, hour and price`, qui attend `€0.22`.

Dans `apps/web/src/app/session/out-of-service.component.spec.ts`, dans ce test, remplacer la dernière attente par :

```ts
    expect(text).toContain('€0.21');
```

Run: `npx nx run web:test`
Expected: PASS, aucun test en échec.

- [ ] **Step 10: Run the whole workspace**

Run: `npx nx run-many -t test lint typecheck`
Expected: une seule tâche en échec, `companion:test`, sur le seul test `names an image built from the sources in the tree`. Tout autre échec est un défaut de cette tâche.

- [ ] **Step 11: Commit**

```bash
git add libs/session/src/lib/settings.ts libs/session/src/lib/settings.spec.ts libs/session/src/lib/session-aggregate.spec.ts apps/functions/src/seed.ts apps/functions/src/seed.spec.ts apps/web/src/app/session/out-of-service.component.spec.ts
bash ~/.config/github-app/as-agent.sh git commit -m "feat(session): compte le volume bloc dans le taux de chaque gabarit

Le taux compte le disque le plus grand du catalogue, 40 Go, à
0,000130 €/Go/h, tarif public qu'aucune facture ne recoupe.

Ces taux n'atteignent qu'un système sans réglages : le semis ne touche
pas un config/settings existant.

settings.ts entre dans l'image du compagnon : companion:test reste rouge
jusqu'à la publication d'une image et à son épinglage.

Co-Authored-By: Charlouze <me@charlouze.com>"
```

## Rulings log

Ruling: la story est qualifiée technique — la spec de session ne porte aucune règle sur le coût, et un `config/settings` existant l'emporte sur ces taux, donc rien ne change là où des réglages existent — si c'est faux, un système sans réglages affiche un devis d'un centime plus bas sans qu'aucun bloc ne l'ait annoncé.

Ruling: le lien entre les taux et le disque le plus grand du catalogue est un commentaire du semis, et non un test — `libs/session` ne peut pas lire `deploy/cloud-init`, et le lot donne les taux comme des constantes — si c'est faux, un disque plus grand au catalogue laisse les taux trop bas sans qu'un test le dise.

Ruling: les commentaires récrits disent que chaque ressource se facture à l'heure entamée, et non que les trois se facturent ensemble — le lot relève que le fournisseur facture chaque ressource à part — si c'est faux, deux commentaires sont à reprendre.

Ruling: les maquettes de `.impeccable/` gardent `€0.22` — elles se régénèrent par leur skill et ne s'éditent pas à la main — si c'est faux, les maquettes affichent un centime de plus que l'écran d'un système sans réglages.

Ruling: le commentaire de `tariffPerHour` dit qu'aucun disque de jeu ne rend un taux trop bas, et non, comme la tâche 1 l'écrivait, qu'un taux ne tombe jamais sous ce qu'une session coûte — le lot relève qu'un taux par heure de serveur sous-estime une session courte — si c'est faux, une phrase de commentaire est à reprendre, et `settings.ts` change encore l'empreinte du compagnon.

Ruling: la branche est poussée sans pull request — `libs/session/src/lib/settings.ts` entre dans l'image du compagnon, donc `companion:test` échoue sur `names an image built from the sources in the tree` tant qu'une image n'est pas publiée puis épinglée, ce que seul le commanditaire fait — si c'est faux, la pull request de la story s'ouvre un tour plus tard.

## Observed drift
