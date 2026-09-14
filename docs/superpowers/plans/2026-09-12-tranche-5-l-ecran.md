# Tranche 5 — L'écran

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**But :** le produit décrit dans `.impeccable/` existe. Un membre ouvre
`beacon.charlouze.com`, lit en une seconde si le serveur tourne et jusqu'à
quand, voit ce qu'il faut copier pour rejoindre, et lance, prolonge ou ferme —
jamais plus d'une action évidente à la fois. À la fin, le pilote nu de la
tranche 4 n'existe plus.

**Approche :** neuf compositions sur un seul écran, validées au tour de
maquettes du 2026-09-11
([`.impeccable/mocks/states/`](../../../.impeccable/mocks/states/README.md)).
L'ordre des tâches suit la dépendance et non la surface : d'abord le vocabulaire
affiché, puis les tokens du monde, puis les fonctions pures que tous les états
appellent, puis la seule pièce de plomberie qui manque, puis les états du plus
courant au plus rare, puis les portes de fin. **Rien d'autre n'est construit
ici** : les quatre surfaces que cet écran laisse en console sont la tranche 8.

**Une contrainte de forme, héritée des tranches 3, 3 bis et 4.** Ce plan porte
**les tests et les contraintes de chaque tâche, jamais le code
d'implémentation**. Onze contradictions avaient été trouvées entre le code
embarqué dans le plan de la tranche 3 et ses propres tests : du code jamais
exécuté se périme entre son écriture et sa lecture, et c'est le lecteur qui
paie. Un bloc de code ci-dessous est donc **un test, une valeur littérale à
écrire, ou une commande à lancer** — jamais une implémentation à recopier.

**Pile :** Nx 23.2.0, Angular 22 en composants autonomes et signaux, TypeScript
ESM `nodenext`, Vitest 4.1 via `@angular/build:unit-test`, `firebase` 11 côté
client derrière `libs/*-record`, émulateurs Firestore et Auth. Aucune
dépendance nouvelle : **aucune bibliothèque de composants, aucun framework CSS,
aucune fonte tierce** — la dernière n'est pas un oubli, c'est la tâche 17.

**Spec :** [`docs/superpowers/specs/2026-09-02-game-hosting-design.md`](../specs/2026-09-02-game-hosting-design.md).
Cette tranche implémente le §4 (le glossaire, la vue client réduite de
`ServerFacts`, les deux formes de `JoinInfo`), le §5 (ce que l'écran a le droit
de lire), le §6 (les cinq états et ce que chacun autorise), le §8 (les deux
visages d'un échec) et le §11 (le coût comme fait affiché). Le découpage est au
[lotissement](2026-09-02-lotissement.md), que la tâche 18 met à jour.

**Contrat de direction :** [`.impeccable/DIRECTION.md`](../../../.impeccable/DIRECTION.md).
Il fait autorité sur les couleurs, les poids de filet, les échelles
typographiques et la seule animation autorisée. Les cinq contraintes fermes sont
dans [`.impeccable/mocks/decision/README.md`](../../../.impeccable/mocks/decision/README.md).

---

## Ce que les tranches précédentes laissent

Cinq legs commandent ce plan, et aucun n'est une surprise :

- **Le pilote fait déjà tout ce que l'écran doit faire.** `apps/web/src/app/app.ts`
  connaît `watchViewer`, `open`, `extend`, `requestStop`, `watch`,
  `watchSettings`, `watchVersionDrift`, `declareSteamId`, et calcule
  `displayedDeadline`, `canExtend`, `canRequestStop`. **Cette tranche n'ajoute
  presque aucun comportement : elle ajoute un écran.** Son commentaire de tête
  nomme déjà cette tranche et annonce que rien de son habillage ne doit
  survivre — il n'en a aucun, délibérément.
- **`join-info.component.ts` se donne rendez-vous ici**, mot pour mot : « its
  component arrives with the screen that shows it, in tranche 5 ». Il ne sait
  aujourd'hui que si un point de jonction existe.
- **La face client ne rend pas les trois champs affichables.** `fields.ts` ne
  calcule qu'un `hasJoinInfo` booléen, alors que le §4 promet « une vue en
  lecture seule, réduite à ces trois champs » — `ip`, `joinInfo`, `lastError`.
  C'est la seule pièce de plomberie qui manque, et la tâche 6 est la seule de ce
  plan à toucher `libs/`.
- **`apps/web` ne peut pas importer un SDK Firestore ni Auth**, et une règle
  ESLint du projet le tient (`no-restricted-imports`, `apps/web/eslint.config.mjs`).
  Tout passe par `connectSessionRecord` et `connectMembershipRecord`. Cette
  règle ne se touche pas.
- **`styles.css` est vide** — une ligne de commentaire — et `index.html` porte
  encore `<title>web</title>`. Il n'existe aucun token, aucune classe, aucune
  feuille de composant dans le dépôt. Rien à défaire : tout est à poser.

Et un fait de production à garder en tête : **`beacon.charlouze.com` sert déjà
le pilote nu à un membre réel.** Cette tranche a un utilisateur, pas une
maquette. La fusion qui la ferme remplace ce qu'il voit.

## Les décisions prises avec le commanditaire, le 2026-09-11

Elles ne se redécouvrent pas en cours d'exécution.

1. **Quatre surfaces sont reportées**, et c'est ce qui garde cette tranche
   livrable : la face écriture des membres, les réglages et le gabarit, les
   cumuls sur `events`, la lecture de `saves`. Elles font la tranche 8. **Aucune
   tâche de ce plan ne les effleure** — pas de requête sur `events`, pas de
   lecture de `saves`, pas d'écran d'administration, pas de sélecteur de
   gabarit.
2. **L'écart avec `PRODUCT.md` est assumé et écrit.** Le document annonce « le
   coût estimé de la session en cours *et le cumul du mois* » ; seul le premier
   est livré. C'est consigné dans la tranche 8 du lotissement, pas tu.
3. **La copie est en anglais.** Ce n'était pas un arbitrage nouveau : le §4 le
   disait déjà — « les maquettes de `.impeccable/mocks/` affichent du texte
   français : contenu provisoire, à traduire à l'implémentation ».
4. **La pastille de statut reste**, son battement non. La contrainte n° 2
   refusait « la pastille de statut » ; le comp approuvé en portait une, et
   c'est lui qui gagne. La contrainte se desserre sur ce point précis et sur
   aucun autre.
5. **Les secondes restent en rouge de signalisation.** Le bleu de quai garde
   l'adresse pour lui seul.
6. **La fenêtre de prolongation se lit comme une ligne annoncée**, au-dessus du
   bouton, sur les deux largeurs. C'est la trouvaille du Call Board adoptée sans
   son habillage, à la place du texte rouge qui s'excusait sous un bouton grisé.

## Contraintes globales

Les exigences de cette section sont implicitement celles de **chaque** tâche.

### Ce que l'écran n'a pas le droit d'être

- **Aucune surface sombre, nulle part.** Contrainte n° 1, ferme, sur toute la
  surface. Pas de `prefers-color-scheme: dark`, pas de thème, pas d'inversion.
  `color-scheme: light` est déclaré et assumé.
- **Jamais une console cloud** : aucun identifiant d'instance mis en avant,
  aucun jargon d'infrastructure visible. Les mots interdits à l'écran :
  `instance`, `VM`, `container`, `provisioning`, `IAM`, `bucket`, `DEV1-L`,
  `Scaleway`, `Firestore`. **La pastille de statut est la seule exception,
  décidée le 2026-09-11.**
- **Le coût ne se compare jamais** au tarif du serveur dédié précédent, et
  aucune économie réalisée n'est affichée. Aucun `7,90`, aucun « au lieu de »,
  aucun pourcentage.
- **L'interface n'affirme jamais que tout est sauvegardé à l'instant.** La
  cadence se dit, la garantie non.
- **Aucune durée de démarrage promise, et aucune heure unique annoncée.** La
  sonde a mesuré 4 min 49 s puis 7 min 58 s sur le même gabarit dans la même
  zone (`probe/RESULTS.md`, §S) : c'est une **fourchette**, et son propre texte
  en fait une contrainte.

### Ce que l'écran doit être

- **L'état mène**, les actions disponibles découlent de l'état lu (contrainte
  n° 5). Aucun bouton n'est rendu pour un état qui ne l'autorise pas : la
  disponibilité se lit de `canExtend` et `canRequestStop`, jamais d'un `if` de
  gabarit.
- **La seconde qui tombe est la seule animation de la page.** Rien d'autre ne
  bouge, hors transitions d'état. Une transition de survol sur un contrôle est
  tolérée à 120 ms ; un `@keyframes` ailleurs que nulle part est un défaut.
- **Un seul écran sert les neuf compositions**, sans se retourner : pas de
  route, pas de navigation, pas de `@angular/router`.
- **Le téléphone et l'écran large comptent autant.** Deux scènes réelles : le
  lancement depuis un téléphone vers 20 h, la prolongation en alt-tab vers
  23 h 30. Sur large, le décompte et le bouton sont atteignables sans lire ; sur
  téléphone, l'action primaire est pleine largeur en bas.
- **Un bouton désactivé porte toujours sa raison en clair**, et cette raison est
  la ligne annoncée de la décision 6, jamais un `title` ni un `aria-label` seul.
- **Les surfaces du navigateur portent le monde** : `::selection`, le caret, les
  anneaux de focus, les chiffres tabulaires. Un anneau de focus par défaut est
  un défaut.

### Langue et vocabulaire

- **Code et interface en anglais** ; ce plan, les commentaires de décision et
  les messages de commit en français.
- **Tout terme visible figure au glossaire du §4.** La tâche 1 l'y met avant
  qu'une seule chaîne soit écrite ; une chaîne visible absente du glossaire est
  un défaut de la tâche qui l'introduit, pas une dette.
- **`aria-label` et texte visible disent la même chose.** Un libellé accessible
  qui diffère du libellé lu est deux vocabulaires.

### Données

- **L'écran n'affiche que ce qui se lit** dans `server/current`,
  `config/settings`, `members/{uid}` ou le profil Google. **Aucune valeur en
  dur qui prétende être une donnée** — ni nom de monde, ni région, ni taille de
  sauvegarde, ni cumul. Une constante d'interface (« Paris, France », « By
  invitation only ») est autorisée et reste une constante d'interface.
- **Le coût vient du domaine, jamais d'une multiplication dans un composant.**
  `estimatedCost` pour une session ouverte, `forecastCost` (tâche 7) pour la
  prochaine. Un `* rate` dans un fichier de `apps/web` est un défaut.
- **L'échéance affichée est `displayedDeadline`**, jamais `deadline` brut : le
  domaine borne à la lecture, et c'est ce qui empêche le décompte de reculer
  quand le watchdog ramène une échéance forgée (§4).

### Production

- **Aucune fusion dans `main` par un agent, aucun `firebase deploy`, aucune
  écriture dans le Firestore de production, aucun geste dans une console de
  fournisseur.** La cible est **l'émulateur**. Les tâches 16 et 18 sont
  conduites par un humain de bout en bout.
- **Le budget de style par composant est de 4 ko** (`apps/web/project.json`,
  `anyComponentStyle.maximumWarning`). Un composant qui le dépasse porte du
  monde qui appartient aux tokens.

### Vérification

- **Toute vérification qui précède une fusion se fait en `--skip-nx-cache`.**
  La tranche 4 a vu un « tout vert » resservi depuis le cache alors qu'un projet
  était cassé.
- **Aucun test ne dépend de l'horloge murale.** Le décompte se teste avec les
  temps simulés de Vitest et l'horloge injectée par `CLOCK` ; `new Date()` pour
  dire *maintenant* dans un test de ce plan est un défaut.
- **Un test vise le texte, un rôle, ou un crochet `data-*` — jamais une classe
  de style.** Une classe est un choix de présentation : un test accroché à
  `.money .red` casse à la première retouche de mise en page sans qu'aucun
  comportement ait changé, et il affirme une couleur là où c'est
  `world.spec.ts` qui tient le contrat des couleurs. Les crochets de ce plan
  sont `data-action` pour ce qui s'actionne, `data-field` pour ce qui s'affiche,
  et `data-*` nommé pour un état — `data-climbing`, `data-warn`.

---

## Structure des fichiers

`apps/web/src/app/` est aujourd'hui plat, avec quatre fichiers. Il le reste pour
ce qui est transverse, et gagne deux dossiers là où le découpage a un sens
métier : les états d'un écran, et les formes d'un point de jonction.

```text
apps/web/src/
  index.html                        le contrat de direction en commentaire, premier enfant du body
  styles.css                        les tokens du monde, les trois poids de filet, les surfaces du navigateur
  app/
    app.ts                          coquille : aiguille déconnecté / visiteur / membre. Ne rend plus rien d'autre
    app.config.ts                   inchangé
    rules-version.ts                inchangé
    clock.ts                        le jeton CLOCK, et son horloge réelle par défaut
    format.ts                       fonctions pures : décompte, heure, monnaie, fourchette de disponibilité
    format.spec.ts
    countdown.ts                    le signal qui bat la seconde, horloge injectée
    countdown.spec.ts
    session/
      session.page.ts               le plateau : lede, filets, aiguillage d'état, pied
      session.page.html
      session.page.css
      session.page.spec.ts
      in-service.component.ts       en service : décompte, point de jonction, ligne annoncée, actions
      in-service.component.spec.ts
      out-of-service.component.ts   hors service, et sa face après un refus
      out-of-service.component.spec.ts
      preparing.component.ts        démarrage : la fourchette, et la libération
      preparing.component.spec.ts
      closing.component.ts          fermeture, et la cadence de sauvegarde
      closing.component.spec.ts
      not-cleared.component.ts      bloqué : aucune action, et le dire
      not-cleared.component.spec.ts
      steam-declaration.component.ts       le bandeau qui demande le compte Steam, puis le montre
      steam-declaration.component.spec.ts
    join/
      enshrouded-join.component.ts  adresse, IP brute, port
      enshrouded-join.component.spec.ts
      sunkenland-join.component.ts  identifiant, région, nom du monde
      sunkenland-join.component.spec.ts
    access/
      signed-out.component.ts       une seule porte
      signed-out.component.spec.ts
      visitor.component.ts          connecté, pas sur la liste
      visitor.component.spec.ts
```

Supprimés : `app/join-info.component.ts` et son `.spec.ts`, remplacés par
`app/join/`.

Deux choix de découpage à ne pas défaire :

- **Un composant par état, et non un gabarit à `@switch` géant.** Les cinq états
  ne partagent ni leurs données ni leurs actions ; réunis, le fichier ne tient
  plus en tête et chaque état se relit à travers les conditions des quatre
  autres. Le plateau porte ce qui est commun — le lede, les filets, le pied — et
  l'aiguillage tient en cinq lignes.
- **Un composant par forme de point de jonction**, ce que le §4 réclame : « chaque
  jeu apporte sa forme, et ajouter un jeu ajoute une forme — coût honnête,
  visible, préférable à une liste d'étiquettes et de valeurs qui n'aurait fait
  que déplacer le problème dans l'écran ». Une table de libellés ici serait
  précisément ce que le spec a écarté.

Les styles vivent dans la feuille du composant qui les porte, **sauf ce que le
contrat de direction nomme** : couleurs, poids de filet, échelles, surfaces du
navigateur. Ceux-là sont dans `styles.css` et se lisent par variable. Un `#d8232a`
écrit dans un composant est un défaut.

---

## Tâche 1 : Le glossaire du §4 accueille les libellés de l'écran

**Fichiers :**
- Modifier : `docs/superpowers/specs/2026-09-02-game-hosting-design.md` (le
  tableau du glossaire, §4, autour de la ligne 471)

**Interfaces :**
- Consomme : rien.
- Produit : **le vocabulaire que toutes les tâches 8 à 14 recopient.** Aucune
  chaîne visible n'est écrite ailleurs que depuis ce tableau.

**Pourquoi elle est première.** Le §4 pose que « tout terme apparaissant dans
l'interface doit figurer dans ce tableau », et que « la colonne du milieu porte
aussi le libellé affiché quand il diffère du nom de code ». Les neuf
compositions introduisent vingt-trois libellés dont cinq contredisent ou
complètent ce qui y est écrit. Les écrire dans les composants d'abord, ce serait
choisir le vocabulaire du produit dans un gabarit HTML.

**REQUIRED SUB-SKILLS :** `clean-architecture` **et** `domain-driven-design`.
C'est une modification du spec, et `CLAUDE.md` ne fait pas d'exception : « c'est
dans le spec que les frontières et le modèle se décident ». Ici le travail est
de **vérifier** qu'aucun de ces libellés n'introduit un concept que le modèle ne
porte pas — pas de re-modéliser.

**Les deux écarts à réconcilier, et rien d'autre.**

1. **`Deadline` porte le libellé `Closing time` au glossaire ; l'écran dit
   `Closes at`.** Le comp approuvé écrivait « Ferme à », qui est une préposition
   et un instant, pas un nom de champ. Le libellé du glossaire devient
   `Closes at`. Ce n'est pas une préférence de rédaction : le glossaire est
   l'autorité, et laisser deux mots vivre pour une chose est ce que le §4
   interdit explicitement en dehors du cas « libellé habillant le nom de code ».
2. **Les cinq états n'ont aucun libellé affiché.** Le tableau donne le terme
   métier français et le nom de code, jamais ce que le joueur lit. Les cinq
   libellés viennent du registre du tableau de gare, qui est le monde retenu.

- [ ] **Étape 1 : invoquer les deux skills, et lire le §4 en entier avant de toucher au tableau**

Annoncer « Using clean-architecture to … » puis « Using domain-driven-design
to … », et suivre chaque skill telle quelle. La question à laquelle il faut
répondre avant d'écrire : *aucun de ces vingt-trois libellés ne nomme une chose
que `libs/session` ne porte pas ?* Un libellé sans concept derrière est le signe
que l'écran invente une donnée.

- [ ] **Étape 2 : corriger le libellé de `Deadline`**

Dans la ligne du tableau :

```text
| échéance, *affichée* « heure de fermeture » | `Deadline`, libellé `Closes at` | l'instant auquel le serveur s'arrête |
```

Et dans le paragraphe qui suit le tableau, remplacer « les joueurs lisent
« Closing time » » par « les joueurs lisent « Closes at » ».

- [ ] **Étape 3 : porter les libellés affichés des cinq états**

Les cinq lignes existantes reçoivent leur libellé dans la colonne du milieu :

```text
| hors service | `Idle`, libellé `Out of service` | aucune machine ; on peut ouvrir une session |
| en préparation | `Provisioning`, libellé `Preparing` | la machine naît ; la fourchette de disponibilité est annoncée |
| en service | `Running`, libellé `In service` | le point de jonction est publié, l'échéance court |
| en fermeture | `Stopping`, libellé `Closing` | la save part, la machine va être détruite |
| bloqué | `Failed`, libellé `Not cleared` | le nettoyage n'a pas pu être garanti ; le watchdog y revient |
```

`Out of service` et `In service` ne sont pas une traduction : ce sont les mots
des panneaux de transport, et c'est le monde retenu qui les appelle.

- [ ] **Étape 4 : ajouter les termes que l'écran introduit et que le tableau ne porte pas**

```text
| temps restant | libellé `Time left` | ce que le décompte affiche : l'écart entre maintenant et l'échéance affichée |
| fourchette de disponibilité | `readyWindow`, libellé `Ready between` | les deux heures entre lesquelles le serveur devrait répondre. **Une fourchette et jamais une heure** : mesuré 4 min 49 s puis 7 min 58 s sur le même gabarit (`probe/RESULTS.md`, §S) |
| coût de la session | `estimatedCost`, libellé `This session` | ce que la session ouverte a coûté à l'heure entamée (§11) |
| coût prévu | `forecastCost`, libellé `Estimated cost` | ce que coûterait la prochaine session à durée pleine. Un devis, pas une dépense |
| appel de prolongation | libellé `Extension call` | l'annonce de l'instant où la fenêtre de prolongation s'ouvre, lue comme une ligne de programme |
| visiteur | `Visitor` | un compte authentifié qui n'est pas membre. Il ne lit rien (§5) |
```

`readyWindow` et `forecastCost` sont les deux seuls noms de code neufs, et les
tâches 3 et 7 les créent.

- [ ] **Étape 5 : vérifier qu'aucun libellé de la maquette ne manque**

Relire les neuf compositions de
[`.impeccable/mocks/states/desktop.html`](../../../.impeccable/mocks/states/desktop.html)
et lister chaque chaîne visible. Celles qui ne sont ni au glossaire ni une
constante d'interface évidente (`Beacon`, `Copy`, `Close`, `Sign out`) sont un
manque de cette tâche.

Attendu : le tableau couvre tout. S'il manque un terme, l'ajouter ici plutôt
que dans la tâche qui l'affichera.

- [ ] **Étape 6 : commit**

```bash
git add docs/superpowers/specs/2026-09-02-game-hosting-design.md
git commit -m "docs(spec): donne aux cinq etats le libelle que les joueurs liront"
```

Le corps dit pourquoi `Closing time` devient `Closes at` : un nom de champ n'est
pas un instant, et le glossaire est l'autorité sur le mot affiché.

---

## Tâche 2 : Les tokens du monde, et le contrat dans le `body`

**Fichiers :**
- Modifier : `apps/web/src/styles.css`
- Modifier : `apps/web/src/index.html`
- Créer : `apps/web/src/world.spec.ts`

**Interfaces :**
- Consomme : rien.
- Produit : les variables CSS que chaque composant lit —
  `--paper`, `--ink`, `--red`, `--blue`, `--rule`, `--mute` — et les classes
  transverses `.rule`, `.rule-mid`, `.rule-thin`, `.k`, `.tabular`.

**Pourquoi un test sur une feuille de style.** `DIRECTION.md` fixe six valeurs
hexadécimales et trois poids de filet. Rien dans le dépôt ne peut constater
qu'elles sont respectées : un `#faf8f2` au lieu de `#faf8f3` ne casse aucun
build et ne se voit pas à l'œil. Ce test est la seule chose qui relie le contrat
au code.

- [ ] **Étape 1 : écrire le test qui échoue**

```ts
import { readFileSync } from 'node:fs';

/**
 * The contract of `.impeccable/DIRECTION.md` is not a preference: it is the
 * decision that produced this world. Nothing else in the repository can compare
 * the two ends, and a hex digit off by one breaks no build and shows to nobody.
 */
describe('the world contract', () => {
  const styles = readFileSync('apps/web/src/styles.css', 'utf8');

  it.each([
    ['--paper', '#faf8f3'],
    ['--ink', '#16181b'],
    ['--red', '#d8232a'],
    ['--blue', '#12457f'],
  ])('declares %s as %s, the value DIRECTION.md fixes', (token, value) => {
    expect(styles).toContain(`${token}: ${value}`);
  });

  it('declares the three rule weights, and only three', () => {
    expect(styles).toContain('--rule-heavy: 4px');
    expect(styles).toContain('--rule-mid: 3px');
    expect(styles).toContain('--rule-thin: 1px');
  });

  /** FIRST VIEWPORT fixes these two, so they are tokens and not component values. */
  it('declares the display scales the contract names', () => {
    expect(styles).toContain('--display-countdown: 172px');
    expect(styles).toContain('--display-window: 112px');
  });

  it('commits to light, with no dark surface anywhere', () => {
    expect(styles).toContain('color-scheme: light');
    expect(styles).not.toContain('prefers-color-scheme');
  });

  it('themes the browser surfaces the design system would otherwise leave default', () => {
    expect(styles).toContain('::selection');
    expect(styles).toContain(':focus-visible');
  });

  it('carries the direction contract into the body, where it survives the build', () => {
    const index = readFileSync('apps/web/src/index.html', 'utf8');
    const body = index.slice(index.indexOf('<body>'));
    expect(body).toContain('THESIS:');
    expect(body).toContain('OWN-WORLD:');
    expect(body).toContain('FORM: The Departure Board');
    // First child of the body, as the contract demands: before the app root.
    expect(body.indexOf('THESIS:')).toBeLessThan(body.indexOf('<beacon-root>'));
  });
});
```

- [ ] **Étape 2 : lancer le test, vérifier qu'il échoue**

```bash
npx nx run web:test --skip-nx-cache
```

Attendu : ÉCHEC sur chaque assertion — `styles.css` ne contient qu'une ligne de
commentaire.

- [ ] **Étape 3 : écrire les tokens et le contrat**

Les valeurs à écrire, littéralement, depuis `DIRECTION.md` :

```text
--paper  #faf8f3     le papier chaud, fond de toute surface
--ink    #16181b     l'encre
--red    #d8232a     le seul rouge : les secondes, et les avertissements
--blue   #12457f     le bleu de quai : l'adresse, et rien d'autre
--rule   rgba(22,24,27,.18)   le filet fin
--mute   #6b6f75     le texte secondaire, jamais un gris arbitraire
```

Poids de filet : 4 px, 3 px, 1 px. Capitales espacées à `.22em` en 10–11 px pour
`.k`. Chiffres tabulaires partout où un nombre s'aligne
(`font-variant-numeric: tabular-nums`).

**Les échelles d'affichage sont des tokens elles aussi**, parce que le contrat
les nomme : `--display-countdown: 172px` sur large et `84px` sur téléphone, et
`--display-window: 112px` pour la fourchette du démarrage. Écrites en dur dans
deux feuilles de composant, elles seraient deux vérités sur un chiffre que
`DIRECTION.md` fixe — et le test de cette tâche ne pourrait plus les voir.

Le bloc de contrat se recopie **tel quel** depuis `DIRECTION.md`, en commentaire
HTML, comme premier enfant du `body`, avant `<beacon-root>`. Et `<title>web</title>`
devient `<title>Beacon</title>`.

- [ ] **Étape 4 : lancer le test, vérifier qu'il passe**

```bash
npx nx run web:test --skip-nx-cache
```

Attendu : SUCCÈS.

- [ ] **Étape 5 : vérifier que le contrat survit au build de production**

C'est l'exigence explicite de `DIRECTION.md` — « doit survivre au build de
production » — et rien ne dit qu'`@angular/build:application` préserve les
commentaires d'`index.html`. La commande décide :

```bash
npx nx run web:build:production --skip-nx-cache
grep -c "THESIS:" dist/apps/web/browser/index.html
```

Attendu : `1`.

**Si le compte est `0`, l'optimiseur retire les commentaires**, et il faut alors
choisir avant de continuer : soit `optimization.styles`/`optimization.scripts`
restent et l'`index.html` est sorti de l'optimisation par la configuration du
builder, soit le contrat se porte autrement — un attribut `data-` sur le `body`
n'est **pas** une solution équivalente, le contrat étant un texte de plusieurs
lignes à lire par un humain. Traiter le cas comme une découverte à écrire, pas à
contourner en silence.

- [ ] **Étape 6 : commit**

```bash
git add apps/web/src/styles.css apps/web/src/index.html apps/web/src/world.spec.ts
git commit -m "feat(web): pose les tokens du monde, et ancre son contrat dans le body"
```

---

## Tâche 3 : Les fonctions pures de l'affichage

**Fichiers :**
- Créer : `apps/web/src/app/format.ts`
- Créer : `apps/web/src/app/format.spec.ts`

**Interfaces :**
- Consomme : `Deadline` et `SessionSettings` de `@beacon/session`.
- Produit :
  - `splitCountdown(remainingMs: number): { hoursMinutes: string; seconds: string }` —
    `hoursMinutes` porte `h:mm`, `seconds` porte `:ss`. **Deux morceaux et non une
    chaîne**, parce que seules les secondes sont rouges et qu'un composant ne
    doit pas découper du texte pour le colorer.
  - `hourLabel(instant: Date): string` — `HH:MM` en 24 h, zéro en tête.
  - `euroLabel(euros: number): string` — `€0.13`, deux décimales toujours.
  - `readyWindow(stateSince: Date): { from: string; to: string }` — les deux
    heures de la fourchette.
  - `BOOT_WINDOW_MS: readonly [number, number]` — `[300_000, 480_000]`.

**La fourchette, et pourquoi elle est ici.** Cinq à huit minutes est un fait
mesuré de `probe/RESULTS.md` §S, pas un réglage. Il vit dans une constante
nommée, avec le commentaire qui dit d'où il vient, et **pas dans
`config/settings`** : un admin qui pourrait le changer changerait une mesure,
ce qui n'a pas de sens. Le jour où de vraies soirées resserrent la fourchette,
c'est cette ligne qui bouge, et le commentaire dit laquelle.

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
import { BOOT_WINDOW_MS, euroLabel, hourLabel, readyWindow, splitCountdown } from './format';

describe('splitCountdown', () => {
  it('separates the falling second, because it is the only thing that is red', () => {
    expect(splitCountdown(2 * 3_600_000 + 47 * 60_000 + 12_000)).toEqual({
      hoursMinutes: '2:47',
      seconds: ':12',
    });
  });

  it('pads minutes and seconds, so the digits never shift under a tabular font', () => {
    expect(splitCountdown(9 * 60_000 + 5_000)).toEqual({ hoursMinutes: '0:09', seconds: ':05' });
  });

  it('never walks past zero: an elapsed deadline reads zero, not a negative', () => {
    expect(splitCountdown(-5_000)).toEqual({ hoursMinutes: '0:00', seconds: ':00' });
  });

  it('leaves the hours unpadded past ten, this being a duration and not a clock', () => {
    expect(splitCountdown(12 * 3_600_000 + 60_000)).toEqual({ hoursMinutes: '12:01', seconds: ':00' });
  });
});

describe('hourLabel', () => {
  it('reads as a departure hour, zero-padded on both halves', () => {
    expect(hourLabel(new Date('2026-09-12T00:30:00'))).toBe('00:30');
    expect(hourLabel(new Date('2026-09-12T20:14:59'))).toBe('20:14');
  });
});

describe('euroLabel', () => {
  it('always shows two decimals: 0.1 euro is not "€0.1"', () => {
    expect(euroLabel(0.13)).toBe('€0.13');
    expect(euroLabel(0.1)).toBe('€0.10');
    expect(euroLabel(0)).toBe('€0.00');
  });
});

describe('readyWindow', () => {
  /**
   * Measured, not guessed: 4 min 49 s then 7 min 58 s on the same size in the
   * same zone, an hour apart (probe/RESULTS.md, §S). A single announced hour
   * would be three minutes wrong one time in two.
   */
  it('announces a window, opened from the instant the state began', () => {
    expect(readyWindow(new Date('2026-09-12T20:14:00'))).toEqual({
      from: '20:19',
      to: '20:22',
    });
  });

  it('derives from the instant it is given, never from now', () => {
    expect(readyWindow(new Date('2026-09-12T23:58:00'))).toEqual({
      from: '00:03',
      to: '00:06',
    });
  });

  it('holds the measured bounds, and says where they come from', () => {
    expect(BOOT_WINDOW_MS).toEqual([300_000, 480_000]);
  });
});
```

- [ ] **Étape 2 : lancer les tests, vérifier qu'ils échouent**

```bash
npx nx run web:test --skip-nx-cache
```

Attendu : ÉCHEC, `./format` n'existe pas.

- [ ] **Étape 3 : écrire `format.ts`**

Cinq fonctions pures et une constante. Aucun import d'Angular, aucun accès à
`Date.now()` : chaque fonction reçoit ce dont elle a besoin. La constante porte
en commentaire la référence à `probe/RESULTS.md` §S et le fait que deux mesures
ne suffisent pas à resserrer la fourchette.

- [ ] **Étape 4 : lancer les tests, vérifier qu'ils passent**

```bash
npx nx run web:test --skip-nx-cache
```

Attendu : SUCCÈS.

- [ ] **Étape 5 : commit**

```bash
git add apps/web/src/app/format.ts apps/web/src/app/format.spec.ts
git commit -m "feat(web): decoupe la seconde qui tombe, et annonce une fourchette mesuree"
```

---

## Tâche 4 : Le signal qui bat la seconde

**Fichiers :**
- Créer : `apps/web/src/app/countdown.ts`
- Créer : `apps/web/src/app/countdown.spec.ts`

**Interfaces :**
- Consomme : `splitCountdown` de `./format`, `CLOCK` de `./clock`.
- Produit :
  - `apps/web/src/app/clock.ts` — le type `Clock` et
    `CLOCK = new InjectionToken<Clock>('beacon.clock', { factory: … })`, dont la
    fabrique rend l'horloge réelle.
  - `countdownTo(deadline: Signal<Date | null>): Signal<{ hoursMinutes: string; seconds: string } | null>` —
    un signal calculé qui se réévalue à chaque seconde, et `null` quand il n'y a
    pas d'échéance.

**L'horloge est un jeton injecté, et non une entrée de composant.** Passée en
entrée, elle apparaîtrait dans cinq signatures pour ne servir qu'aux tests — et
un paramètre de configuration offert à l'appelant est une décision qu'on a
refusé de prendre. Avec une fabrique par défaut, la production ne fournit rien
et les tests remplacent un seul fournisseur. C'est déjà la forme que
`FIREBASE_CONNECTION` a dans cette application.

**Une seule horloge, un seul intervalle.** La page a le droit à une animation et
à une seule. Deux composants qui monteraient chacun son `setInterval`
donneraient deux secondes qui tombent à des instants différents — invisible sur
un écran, visible sur une capture, et faux par construction. Le battement vit
ici, une fois, et se nettoie à la destruction de l'injecteur.

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CLOCK } from './clock';
import { countdownTo } from './countdown';

describe('countdownTo', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  /** Injected, never wall-clock: a test that reads the real time is a test that fails at midnight. */
  const clockAt = (iso: string) => {
    let now = new Date(iso);
    const clock = {
      now: () => now,
      advance: (ms: number) => {
        now = new Date(now.getTime() + ms);
        vi.advanceTimersByTime(ms);
      },
    };
    TestBed.configureTestingModule({ providers: [{ provide: CLOCK, useValue: clock }] });
    return clock;
  };

  it('reads the remaining time the instant it is created', () => {
    const clock = clockAt('2026-09-12T20:00:00');
    const deadline = signal(new Date('2026-09-12T22:47:12'));
    TestBed.runInInjectionContext(() => {
      expect(countdownTo(deadline)()).toEqual({ hoursMinutes: '2:47', seconds: ':12' });
    });
  });

  it('falls one second at a time, which is the page’s only motion', () => {
    const clock = clockAt('2026-09-12T20:00:00');
    const deadline = signal(new Date('2026-09-12T20:00:10'));
    TestBed.runInInjectionContext(() => {
      const countdown = countdownTo(deadline);
      expect(countdown()).toEqual({ hoursMinutes: '0:00', seconds: ':10' });
      clock.advance(1_000);
      expect(countdown()).toEqual({ hoursMinutes: '0:00', seconds: ':09' });
      clock.advance(4_000);
      expect(countdown()).toEqual({ hoursMinutes: '0:00', seconds: ':05' });
    });
  });

  it('stops at zero rather than counting into the negative', () => {
    const clock = clockAt('2026-09-12T20:00:00');
    const deadline = signal(new Date('2026-09-12T20:00:02'));
    TestBed.runInInjectionContext(() => {
      const countdown = countdownTo(deadline);
      clock.advance(10_000);
      expect(countdown()).toEqual({ hoursMinutes: '0:00', seconds: ':00' });
    });
  });

  it('says nothing when there is no deadline to count to', () => {
    const clock = clockAt('2026-09-12T20:00:00');
    TestBed.runInInjectionContext(() => {
      expect(countdownTo(signal(null))()).toBeNull();
    });
  });

  it('follows a deadline that moves, which is what an extension does', () => {
    const clock = clockAt('2026-09-12T20:00:00');
    const deadline = signal(new Date('2026-09-12T20:30:00'));
    TestBed.runInInjectionContext(() => {
      const countdown = countdownTo(deadline);
      expect(countdown()?.hoursMinutes).toBe('0:30');
      deadline.set(new Date('2026-09-12T21:30:00'));
      expect(countdown()?.hoursMinutes).toBe('1:30');
    });
  });

  it('leaves no timer behind when its injector is destroyed', () => {
    clockAt('2026-09-12T20:00:00');
    TestBed.runInInjectionContext(() => {
      countdownTo(signal(new Date('2026-09-12T21:00:00')));
    });
    TestBed.resetTestingModule();
    expect(vi.getTimerCount()).toBe(0);
  });
});
```

- [ ] **Étape 2 : lancer les tests, vérifier qu'ils échouent**

```bash
npx nx run web:test --skip-nx-cache
```

Attendu : ÉCHEC, `./countdown` n'existe pas.

- [ ] **Étape 3 : écrire `countdown.ts`**

Un signal source battu par un `setInterval` de 1 000 ms, un `computed` qui le
lit avec `splitCountdown`, et un `DestroyRef` qui coupe l'intervalle. `CLOCK`
s'injecte, et sa fabrique rend l'horloge réelle : rien à fournir en production.

- [ ] **Étape 4 : lancer les tests, vérifier qu'ils passent**

```bash
npx nx run web:test --skip-nx-cache
```

Attendu : SUCCÈS, les six.

- [ ] **Étape 5 : commit**

```bash
git add apps/web/src/app/countdown.ts apps/web/src/app/countdown.spec.ts
git commit -m "feat(web): fait battre la seconde une seule fois pour toute la page"
```

---

## Tâche 5 : La vue réduite de `ServerFacts` sur la face client

**Fichiers :**
- Modifier : `libs/session-record/src/lib/fields.ts`
- Modifier : `libs/session-record/src/lib/client-session.ts:42-58` (l'interface)
  et son `watch`
- Modifier : `libs/session-record/src/lib/fields.spec.ts`
- Modifier : `libs/session-record/src/lib/round-trip.spec.ts`
- Modifier : `apps/web/src/app/app.ts` (le seul appelant de `watch`)

**Interfaces :**
- Consomme : `JoinInfo` de `@beacon/session`, `ServerFacts` de
  `./server-state.js` pour le test d'aller-retour.
- Produit :
  - `DisplayedFacts` — `{ readonly ip: string | null; readonly joinInfo: JoinInfo | null; readonly lastError: string | null }`
  - `displayedFactsFrom(data: Record<string, unknown>): DisplayedFacts`
  - `ServerView` — `{ readonly session: Session; readonly facts: DisplayedFacts; readonly stateSince: Date | null }`
  - `ClientSessionRecord.watch(on: (view: ServerView | null) => void): () => void`

**`stateSince` voyage avec eux, et ce n'est pas un fourre-tout.** L'écran de
démarrage annonce une fourchette calculée depuis l'instant où l'état a commencé,
et l'agrégat ne porte pas ce champ — `startedAt` est l'ouverture de la session,
qui est le même instant aujourd'hui et ne le sera plus le jour où un état en
précède un autre. Le champ est déjà lu côté admin
(`server-state.ts:58`, la vue du watchdog) ; il n'y a donc aucune approximation
à faire, seulement la même traduction à offrir au second transport. Il n'entre
pas dans `DisplayedFacts` : ce n'est pas un fait d'infrastructure réservé, c'est
un champ demandé que le client écrit lui-même.

**La seule pièce de plomberie de la tranche, et le §4 la réclame déjà :** « trois
de ses valeurs sont **affichées** : l'`ip`, que l'écran montre à côté du nom de
domaine, le `joinInfo`, que l'écran rend lisible et copiable, et `lastError`, qui
dit qu'une tentative précédente a échoué. La face client en expose donc une vue
en lecture seule, réduite à ces trois champs. »

**Pourquoi `watch` change de forme plutôt qu'un second abonnement.** Un
`watchFacts()` séparé serait un second `onSnapshot` sur `server/current`, donc
une seconde copie du même document libre de retarder sur la première — le défaut
que `client-session.ts:66-70` refuse explicitement pour `config/settings`. Une
session et les faits qui l'accompagnent viennent du même instantané ou ne sont
pas cohérents. Le seul appelant de `watch` est `apps/web`, et il est refait de
toute façon.

**Ce qui ne change pas :** `RESERVED_FACTS` garde ses cinq noms et `Session`
garde son `hasJoinInfo` booléen. Le domaine ne voit toujours pas ces champs ; ce
sont deux lectures du même document, pour deux lecteurs différents. `lastError`
n'entre pas dans `RESERVED_FACTS` — son commentaire dit déjà pourquoi, et cette
tâche ne le touche pas.

- [ ] **Étape 1 : écrire les tests de traduction qui échouent**

Dans `libs/session-record/src/lib/fields.spec.ts` :

```ts
import { displayedFactsFrom } from './fields.js';

describe('displayedFactsFrom', () => {
  it('renders the three fields the screen shows, and no other', () => {
    const facts = displayedFactsFrom({
      state: 'RUNNING',
      instanceId: 'i-1',
      ipId: 'ip-1',
      provisionClaimedAt: new Date(),
      ip: '51.159.84.12',
      joinInfo: {
        game: 'enshrouded',
        hostname: 'enshrouded.beacon.charlouze.com',
        address: '51.159.84.12',
        port: 15637,
      },
      lastError: null,
    });
    expect(Object.keys(facts).sort()).toEqual(['ip', 'joinInfo', 'lastError']);
    expect(facts.ip).toBe('51.159.84.12');
    expect(facts.joinInfo).toEqual({
      game: 'enshrouded',
      hostname: 'enshrouded.beacon.charlouze.com',
      address: '51.159.84.12',
      port: 15637,
    });
  });

  /**
   * §8: a refused creation cleans up and returns to IDLE with lastError set.
   * That document is the most common failure screen there is, and a view that
   * dropped the field on an idle document would leave the screen unable to say
   * the previous attempt failed.
   */
  it('keeps lastError on an idle document, where it is the whole message', () => {
    const facts = displayedFactsFrom({
      state: 'IDLE',
      lastError: 'no capacity left for this machine size in the zone',
    });
    expect(facts.lastError).toBe('no capacity left for this machine size in the zone');
    expect(facts.joinInfo).toBeNull();
    expect(facts.ip).toBeNull();
  });

  it('says nothing rather than inventing, on a document that carries nothing', () => {
    expect(displayedFactsFrom({ state: 'IDLE' })).toEqual({
      ip: null,
      joinInfo: null,
      lastError: null,
    });
  });

  it('refuses a joinInfo whose game is not one this vocabulary knows', () => {
    expect(displayedFactsFrom({ joinInfo: { game: 'minecraft', hostname: 'x' } }).joinInfo).toBeNull();
  });

  it('refuses a lastError that is not a string, rather than rendering an object', () => {
    expect(displayedFactsFrom({ lastError: { code: 42 } }).lastError).toBeNull();
  });
});
```

- [ ] **Étape 2 : écrire le test d'aller-retour qui échoue**

Dans `libs/session-record/src/lib/round-trip.spec.ts`, à côté de ceux qui
existent. C'est le seul test du dépôt capable de voir les deux bouts : ce que
`publish()` écrit, et ce que l'écran lira.

```ts
it('hands the screen exactly what the functions published', () => {
  const published: ServerFacts = {
    ip: '51.159.84.12',
    joinInfo: {
      game: 'sunkenland',
      serverId: '4db51c84-24cf-459e-9e9e-88b8c3a7ce3b~639241613967341807',
      region: 'Europe',
      worldName: "Beacon's World",
    },
    instanceId: 'i-1',
    ipId: 'ip-1',
  };
  const written = factsPatch(published);
  const read = displayedFactsFrom(written);
  expect(read.joinInfo).toEqual(published.joinInfo);
  expect(read.ip).toBe(published.ip);
});
```

**`factsPatch` n'existe pas encore, et l'extraire est la première moitié de
l'étape 4.** Vérifié : `publish` construit son objet en ligne
(`server-state.ts:91-97`). Il faut donc en sortir une fonction que `publish`
appelle *et* que ce test appelle — **un test d'aller-retour qui recopie à la
main ce que l'écrivain écrit ne prouve que leur propre accord**, et la tranche 4
a payé exactement cette erreur sur le `principalSet` de la fédération : le test
affirmait la même chaîne fausse que le code, écrit depuis la même croyance.

- [ ] **Étape 3 : lancer les tests, vérifier qu'ils échouent**

```bash
npx nx run session-record:test --skip-nx-cache
```

Attendu : ÉCHEC, `displayedFactsFrom` n'existe pas.

- [ ] **Étape 4 : écrire la traduction et changer la forme de `watch`**

Trois choses, dans cet ordre :

1. `displayedFactsFrom` dans `fields.ts`, à côté de `sessionFrom`, avec la même
   discipline : ce que le vocabulaire ne reconnaît pas devient `null`, jamais un
   objet inventé. La validation de `joinInfo` réutilise `isGame`, déjà importé.
   Et l'extraction de `factsPatch` hors de `publish`, que l'étape 2 exige.
2. `watch` rend `ServerView | null` — `null` quand `sessionFrom` rend `null`,
   c'est-à-dire quand le document est illisible. `stateSince` se lit par `toDate`,
   qui sert déjà les deux transports. Le commentaire dit pourquoi les trois
   voyagent dans le même instantané.
3. `apps/web/src/app/app.ts` suit la nouvelle forme. Le pilote continue de
   fonctionner à cette étape : il est remplacé en tâche 14, pas ici.

- [ ] **Étape 5 : lancer la vérification complète des deux projets**

```bash
npx nx run-many -t lint test typecheck -p session-record web --skip-nx-cache
```

Attendu : SUCCÈS partout. Un échec de `typecheck` sur `apps/web` signifie que le
point 3 a été oublié.

- [ ] **Étape 6 : commit**

```bash
git add libs/session-record apps/web/src/app/app.ts
git commit -m "feat(session-record): rend a l'ecran les trois faits que le §4 lui promet"
```

Le corps dit pourquoi les faits voyagent dans le même rappel que la session, et
non dans un second abonnement.

---

## Tâche 6 : Les deux formes de point de jonction

**Fichiers :**
- Créer : `apps/web/src/app/join/enshrouded-join.component.ts` + `.spec.ts`
- Créer : `apps/web/src/app/join/sunkenland-join.component.ts` + `.spec.ts`
- Supprimer : `apps/web/src/app/join-info.component.ts` et son `.spec.ts`

**Interfaces :**
- Consomme : `JoinInfo`, `isEnshroudedJoinInfo` de `@beacon/session`.
- Produit : `<beacon-enshrouded-join [joinInfo]="…" />` et
  `<beacon-sunkenland-join [joinInfo]="…" />`.

**Pas de troisième composant pour aiguiller entre les deux.** Un composant qui
ne ferait que transmettre son entrée à l'un ou l'autre ajouterait une interface
sans ajouter de fonction, et le savoir qu'il prétendrait cacher — le
discriminant `game` — est déjà dans la session que l'écran en service tient.
L'aiguillage est donc un `@switch` de deux branches dans son gabarit, et la
tâche 9 le teste là.

**Deux formes, et pourquoi pas une table.** Le §4 : « ajouter un jeu ajoute une
forme — coût honnête, visible, préférable à une liste d'étiquettes et de valeurs
qui n'aurait fait que déplacer le problème dans l'écran ». Les deux jeux ne se
rejoignent pas de la même façon, et les deux portent **un moyen principal et un
recours** : l'IP brute quand le DNS tombe, le nom du monde quand l'identifiant
se perd.

**Le `~` est le seul endroit où la coupure veut dire quelque chose.** Un
identifiant de serveur fait 55 caractères et sépare un GUID d'un instant de
démarrage. Chaque moitié reste insécable, et la coupure tombe sur le `~` par
`<wbr>` — partout ailleurs elle couperait un identifiant en deux.

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
import { TestBed } from '@angular/core/testing';
import { EnshroudedJoinComponent } from './enshrouded-join.component';

describe('EnshroudedJoinComponent', () => {
  const info = {
    game: 'enshrouded',
    hostname: 'enshrouded.beacon.charlouze.com',
    address: '51.159.84.12',
    port: 15637,
  } as const;

  const render = async () => {
    const fixture = TestBed.createComponent(EnshroudedJoinComponent);
    fixture.componentRef.setInput('joinInfo', info);
    await fixture.whenStable();
    return fixture;
  };

  it('shows the main way in, and the fallback beside it', async () => {
    const text = (await render()).nativeElement.textContent;
    expect(text).toContain('enshrouded.beacon.charlouze.com');
    expect(text).toContain('51.159.84.12');
  });

  /** §8: DynHost can fail without the evening being lost, and then the raw ip is the way in. */
  it('names the fallback for what it is, so nobody wonders which to use', async () => {
    expect((await render()).nativeElement.textContent).toContain('Raw ip');
  });

  it('prints the port once, and not inside both values', async () => {
    const text: string = (await render()).nativeElement.textContent;
    expect(text.match(/15637/g)).toHaveLength(1);
  });

  it('reserves the quay blue for the address, which is the only thing it marks', async () => {
    const fixture = await render();
    const address = fixture.nativeElement.querySelector('[data-field="address"]');
    expect(address.textContent).toContain('enshrouded.beacon.charlouze.com');
  });

  it('copies host and port together, which is what gets pasted into the game', async () => {
    const fixture = await render();
    const buttons = [...fixture.nativeElement.querySelectorAll('button')];
    const values = buttons.map((b: HTMLElement) => b.getAttribute('data-copy'));
    expect(values).toContain('enshrouded.beacon.charlouze.com:15637');
    expect(values).toContain('51.159.84.12:15637');
  });
});
```

```ts
import { TestBed } from '@angular/core/testing';
import { SunkenlandJoinComponent } from './sunkenland-join.component';

describe('SunkenlandJoinComponent', () => {
  const info = {
    game: 'sunkenland',
    serverId: '4db51c84-24cf-459e-9e9e-88b8c3a7ce3b~639241613967341807',
    region: 'Europe',
    worldName: "Beacon's World",
  } as const;

  const render = async () => {
    const fixture = TestBed.createComponent(SunkenlandJoinComponent);
    fixture.componentRef.setInput('joinInfo', info);
    await fixture.whenStable();
    return fixture;
  };

  it('shows the identifier, the region, and the world name as the fallback', async () => {
    const text = (await render()).nativeElement.textContent;
    expect(text).toContain('4db51c84-24cf-459e-9e9e-88b8c3a7ce3b');
    expect(text).toContain('Europe');
    expect(text).toContain("Beacon's World");
  });

  /**
   * The identifier is a guid and a boot instant joined by a tilde. That is the
   * one place a line break separates two things rather than cutting an
   * identifier in half.
   */
  it('breaks the identifier on the tilde, and nowhere else', async () => {
    const value = (await render()).nativeElement.querySelector('[data-field="server-id"]');
    const segments = [...value.querySelectorAll('[data-seg]')];
    expect(segments).toHaveLength(2);
    expect(value.querySelector('wbr')).not.toBeNull();
    for (const segment of segments) {
      expect(getComputedStyle(segment).whiteSpace).toBe('nowrap');
    }
  });

  it('never shows an address, because this game has none', async () => {
    const text: string = (await render()).nativeElement.textContent;
    expect(text).not.toMatch(/\d+\.\d+\.\d+\.\d+/);
    expect(text.toLowerCase()).not.toContain('address');
  });
});
```

L'aiguillage entre les deux formes n'a pas de test à lui, n'ayant pas de
composant à lui : la tâche 9 le teste dans le gabarit qui le porte.

- [ ] **Étape 2 : lancer les tests, vérifier qu'ils échouent**

```bash
npx nx run web:test --skip-nx-cache
```

Attendu : ÉCHEC, les trois composants n'existent pas.

- [ ] **Étape 3 : écrire les trois composants**

Autonomes, `OnPush`, une `input()` chacun. L'aiguillage se fait sur `game` avec
`isEnshroudedJoinInfo`, jamais sur la présence d'un champ : le discriminant est
`game` parce qu'une session porte déjà son jeu, et un second champ disant la
même chose pourrait la contredire (§4).

Le bouton de copie porte sa valeur en `data-copy` et écrit dans le
presse-papiers. Son libellé passe à `Copied` puis revient : c'est une transition
d'état, pas une animation, donc autorisée.

- [ ] **Étape 4 : lancer les tests, vérifier qu'ils passent**

```bash
npx nx run web:test --skip-nx-cache
```

Attendu : SUCCÈS.

- [ ] **Étape 5 : supprimer le composant du pilote et son test**

```bash
git rm apps/web/src/app/join-info.component.ts apps/web/src/app/join-info.component.spec.ts
```

Puis retirer son import et son usage de `apps/web/src/app/app.ts`, et vérifier :

```bash
npx nx run-many -t lint test typecheck -p web --skip-nx-cache
```

Attendu : SUCCÈS. Le pilote perd sa ligne « How to join: published », qui n'avait
jamais été qu'un rendez-vous pour cette tâche.

- [ ] **Étape 6 : commit**

```bash
git add apps/web/src/app/join apps/web/src/app/app.ts
git commit -m "feat(web): donne a chaque jeu la forme par laquelle on le rejoint"
```

---

## Tâche 7 : `forecastCost` dans le domaine

**Fichiers :**
- Modifier : `libs/session/src/lib/settings.ts` ou un module voisin du même
  dossier — **pas** `session-aggregate.ts`
- Modifier/créer : le `.spec.ts` correspondant

**Interfaces :**
- Consomme : `SessionSettings`.
- Produit : `forecastCost(settings: SessionSettings): number`, et
  `Session.startedAt: Date | null`.

**`startedAt` n'a pas de getter, et c'est un oubli et non une décision.**
`startedBy` en a un (`session-aggregate.ts:117`), exposé pour exactement la même
raison : l'écran nomme l'ouvrant. Il nomme aussi l'heure — « Opened by
Charlouze · 20:14 » — et ne peut pas la lire. Les deux champs sont de même
nature, du même document, pour le même affichage ; l'un sans l'autre est une
asymétrie que rien ne justifie.

**REQUIRED SUB-SKILL :** `domain-driven-design`. `CLAUDE.md` l'exige avant de
toucher `libs/session` — « pour **vérifier** qu'on ne défait pas le §4, jamais
pour re-modéliser ».

**Pourquoi le domaine et pas l'écran.** L'écran hors service affiche ce que
coûterait la prochaine session. `estimatedCost` ne peut pas répondre : il est
sur l'agrégat, il exige des champs, et il **lève** sur une session inexistante
(`session-aggregate.ts:213-217`). La tentation est alors de multiplier dans le
composant — et c'est précisément ce que le §11 interdit : « une valeur
inventée sur le seul chiffre que ce produit montre sur l'argent serait pire que
pas de chiffre ». L'arithmétique de l'argent vit à un seul endroit.

**Pourquoi pas sur `Session`.** Ce n'est pas une question qu'on pose à une
session : il n'y en a pas. C'est une question qu'on pose aux réglages. La mettre
sur l'agrégat obligerait à un `Session.idle()` porteur de rien, pour obtenir un
devis qui ne parle d'aucune session.

- [ ] **Étape 1 : invoquer la skill**

Annoncer « Using domain-driven-design to … » et la suivre. La question à
trancher : *ce calcul appartient-il à un objet valeur des réglages, ou est-ce une
fonction du module ?* Le §4 ne porte aucun objet valeur des réglages ; une
fonction du module est la réponse par défaut, à ne quitter que pour une raison
écrite.

- [ ] **Étape 2 : écrire les tests qui échouent**

```ts
import { DEFAULT_SETTINGS, forecastCost } from './settings.js';

describe('forecastCost', () => {
  /**
   * §11: the started hour is due, and a rate already sums instance, disk and
   * ip. A full session at the default size, and nothing else — this is a quote,
   * not a spend.
   */
  it('quotes a full session at the default size', () => {
    expect(forecastCost(DEFAULT_SETTINGS)).toBeCloseTo(0.22, 2);
  });

  it('bills the started hour, so a half-hour session still quotes one', () => {
    // 0.05454 and not 0.05: asserted to four places, because two would pass on
    // a rate that had been halved.
    expect(
      forecastCost({ ...DEFAULT_SETTINGS, sessionDurationMs: 30 * 60_000 }),
    ).toBeCloseTo(0.0545, 4);
  });

  /** Same refusal as estimatedCost: an unknown size quotes zero rather than guessing. */
  it('quotes zero for a size no tariff names', () => {
    expect(forecastCost({ ...DEFAULT_SETTINGS, tariffPerHour: {} })).toBe(0);
  });

  it('follows the deployed document, never a rate compiled into a bundle', () => {
    expect(
      forecastCost({ ...DEFAULT_SETTINGS, tariffPerHour: { 'DEV1-L': 1 } }),
    ).toBe(4);
  });
});
```

- [ ] **Étape 3 : lancer les tests, vérifier qu'ils échouent**

```bash
npx nx run session:test --skip-nx-cache
```

Attendu : ÉCHEC, `forecastCost` n'existe pas.

- [ ] **Étape 4 : écrire `forecastCost`**

Même arrondi et même plancher d'heure entamée qu'`estimatedCost`, et le
commentaire renvoie à lui : deux calculs d'argent qui divergeraient sur
l'arrondi afficheraient deux chiffres pour la même grille.

- [ ] **Étape 4 bis : exposer `startedAt`, avec son test**

```ts
it('names the hour a session was opened, as it already names who opened it', () => {
  const startedAt = new Date('2026-09-12T20:14:00');
  const session = Session.from({
    state: 'RUNNING',
    sessionId: 'sess1',
    game: 'sunkenland',
    startedBy: 'Charlouze',
    startedAt,
    deadline: Deadline.at(new Date('2026-09-13T00:14:00')),
    instanceSize: 'DEV1-L',
    hasJoinInfo: true,
  });
  expect(session.startedAt).toEqual(startedAt);
});

it('says nothing about an hour no session has', () => {
  expect(Session.idle().startedAt).toBeNull();
});
```

Un getter, sur le modèle exact de `startedBy` juste au-dessus. `null` sur une
session absente, comme `sessionId` et `game` le font déjà — et non une lève,
parce que l'écran hors service lit cet objet sans savoir s'il porte une
session.

- [ ] **Étape 5 : lancer les tests, vérifier qu'ils passent**

```bash
npx nx run session:test --skip-nx-cache
```

Attendu : SUCCÈS.

- [ ] **Étape 6 : commit**

```bash
git add libs/session
git commit -m "feat(session): chiffre ce que couterait la prochaine session"
```

---

## Tâche 8 : Le plateau, et l'aiguillage d'état

**Fichiers :**
- Créer : `apps/web/src/app/session/session.page.ts` + `.html` + `.css` + `.spec.ts`

**Interfaces :**
- Consomme : `ServerView` de `@beacon/session-record/client`, `SessionSettings`,
  le membre connecté.
- Produit : `<beacon-session-page [view]="…" [settings]="…" [member]="…" (opened)="…" (extended)="…" (closed)="…" />`.

**Une entrée `view` et non trois.** `ServerView` porte déjà `session`, `facts` et
`stateSince`, et c'est exactement ce que le plateau et ses cinq corps
consomment. Les passer séparément ferait quatre entrées par composant — au-delà
de ce qu'un appel se relit — et surtout : le jour où la vue gagne un champ, cinq
signatures et cinq helpers de test changeraient pour le voir passer. Le paquet
que l'enregistrement rend est le paquet que l'écran prend.
  **Les actions sortent en événements et n'appellent rien** : le plateau ne
  connaît aucun `*-record`, et c'est ce qui le rend testable sans émulateur.

**Ce que le plateau porte, et rien de plus :** le lede — nom, jeu quand il est
figé, libellé d'état, pastille —, le filet de 4 px, l'aiguillage vers le corps
de l'état, et le pied. Les cinq corps arrivent aux tâches 9 à 13 ; ici
l'aiguillage existe et chaque branche est vide.

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
import { TestBed } from '@angular/core/testing';
import { DEFAULT_SETTINGS, Deadline, Session } from '@beacon/session';
import { CLOCK } from '../clock';
import { SessionPage } from './session.page';

const NO_FACTS = { ip: null, joinInfo: null, lastError: null };

/**
 * The board renders its state bodies for real, so one of them reads the clock.
 * Left to the token's own factory that would be the wall clock, and every
 * assertion here would drift with the time of day.
 */
const FIXED_CLOCK = { now: () => new Date('2026-09-12T21:27:00') };

const STARTED_AT = new Date('2026-09-12T20:14:00');

const sessionIn = (state: 'PROVISIONING' | 'RUNNING' | 'STOPPING' | 'FAILED') =>
  Session.from({
    state,
    sessionId: 'sess1',
    game: 'sunkenland',
    startedBy: 'Charlouze',
    startedAt: STARTED_AT,
    deadline: Deadline.at(new Date('2026-09-13T00:14:00')),
    instanceSize: 'DEV1-L',
    hasJoinInfo: state === 'RUNNING',
  });

describe('SessionPage', () => {
  const render = async (session: Session, facts = NO_FACTS) => {
    TestBed.configureTestingModule({ providers: [{ provide: CLOCK, useValue: FIXED_CLOCK }] });
    const fixture = TestBed.createComponent(SessionPage);
    fixture.componentRef.setInput('view', { session, facts, stateSince: STARTED_AT });
    fixture.componentRef.setInput('settings', DEFAULT_SETTINGS);
    fixture.componentRef.setInput('member', { uid: 'u1', name: 'Charlouze', role: 'player' });
    await fixture.whenStable();
    return fixture;
  };

  /** The glossary of §4 is the authority on every one of these five words. */
  it.each([
    [Session.idle(), 'Out of service'],
    [sessionIn('PROVISIONING'), 'Preparing'],
    [sessionIn('RUNNING'), 'In service'],
    [sessionIn('STOPPING'), 'Closing'],
    [sessionIn('FAILED'), 'Not cleared'],
  ])('names the state with the label the glossary fixes', async (session, label) => {
    const fixture = await render(session);
    expect(fixture.nativeElement.querySelector('[data-field="state"]').textContent).toContain(label);
  });

  it('carries the product name always, and the game only once it is frozen', async () => {
    const idle = await render(Session.idle());
    expect(idle.nativeElement.querySelector('[data-field="wordmark"]').textContent).toContain('Beacon');
    expect(idle.nativeElement.querySelector('[data-field="wordmark"]').textContent).not.toContain('Sunkenland');

    const running = await render(sessionIn('RUNNING'));
    expect(running.nativeElement.querySelector('[data-field="wordmark"]').textContent).toContain('Sunkenland');
  });

  /** DIRECTION.md: the falling second is the page's only animation. Nothing else moves. */
  it('animates nothing but the second, the status pip included', async () => {
    const fixture = await render(sessionIn('RUNNING'));
    const pip = fixture.nativeElement.querySelector('[data-field="state-pip"]');
    expect(pip).not.toBeNull();
    expect(getComputedStyle(pip).animationName).toBe('none');
  });

  it('renders one state body at a time, never two', async () => {
    const fixture = await render(sessionIn('RUNNING'));
    expect(fixture.nativeElement.querySelectorAll('[data-state-body]')).toHaveLength(1);
  });

  it('says so plainly when the record cannot be read, rather than showing an empty board', async () => {
    TestBed.configureTestingModule({ providers: [{ provide: CLOCK, useValue: FIXED_CLOCK }] });
    const fixture = TestBed.createComponent(SessionPage);
    fixture.componentRef.setInput('view', null);
    fixture.componentRef.setInput('settings', DEFAULT_SETTINGS);
    fixture.componentRef.setInput('member', { uid: 'u1', name: 'Charlouze', role: 'player' });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('cannot be read');
  });

  /** Constraint no. 2: never a cloud console. These words are barred from the surface. */
  it.each(['instance', 'container', 'provisioning', 'DEV1-L', 'Scaleway', 'Firestore'])(
    'never shows the infrastructure word "%s"',
    async (word) => {
      for (const session of [Session.idle(), sessionIn('RUNNING'), sessionIn('FAILED')]) {
        const text: string = (await render(session)).nativeElement.textContent.toLowerCase();
        expect(text).not.toContain(word.toLowerCase());
      }
    },
  );
});
```

- [ ] **Étape 2 : lancer les tests, vérifier qu'ils échouent**

```bash
npx nx run web:test --skip-nx-cache
```

Attendu : ÉCHEC, `SessionPage` n'existe pas.

- [ ] **Étape 3 : écrire le plateau**

Le libellé d'état se lit d'une table `SessionState → label` déclarée une fois,
et non d'une suite de `@if`. Le cas `null` — document illisible — est un
sixième cas de cette table, et il dit ce qui se passe plutôt que de se taire :
c'est ce que le pilote faisait déjà avec son `'unreadable'`.

Le `.css` porte le plateau : la grille, les trois poids de filet lus par
variable, les capitales espacées de `.k`, et la bascule de la disposition entre
téléphone et large. Les couleurs ne s'y écrivent pas en dur.

- [ ] **Étape 4 : lancer les tests, vérifier qu'ils passent**

```bash
npx nx run web:test --skip-nx-cache
```

Attendu : SUCCÈS.

- [ ] **Étape 5 : commit**

```bash
git add apps/web/src/app/session
git commit -m "feat(web): dresse le plateau, et fait mener l'etat"
```

---

## Tâche 9 : En service

**Fichiers :**
- Créer : `apps/web/src/app/session/in-service.component.ts` + `.spec.ts`
- Modifier : `apps/web/src/app/session/session.page.html` (brancher la branche)

**Interfaces :**
- Consomme : `countdownTo`, `hourLabel`, `euroLabel`, les deux composants de
  point de jonction, et du domaine `displayedDeadline`, `canExtend`,
  `canRequestStop`, `estimatedCost`.
- Produit : `<beacon-in-service … (extended)="…" (closed)="…" />`.

**L'écran de l'alt-tab de 23 h 30.** Le décompte à 172 px occupe le tiers
gauche, ses secondes seules en rouge, et c'est la seule chose qui bouge. À
droite l'heure de fermeture et l'ouvrant. Dessous le point de jonction. En
pied, le coût de la session, la ligne annoncée, et les deux actions.

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
import { TestBed } from '@angular/core/testing';
import { DEFAULT_SETTINGS, Deadline, Session } from '@beacon/session';
import { CLOCK } from '../clock';
import { InServiceComponent } from './in-service.component';

describe('InServiceComponent', () => {
  const at = (iso: string) => new Date(iso);
  const OPENED_AT = at('2026-09-12T20:14:00');
  const clock = { now: () => at('2026-09-12T21:27:00') };

  const running = (closesAt: string) =>
    Session.from({
      state: 'RUNNING',
      sessionId: 'sess1',
      game: 'sunkenland',
      startedBy: 'Charlouze',
      startedAt: OPENED_AT,
      deadline: Deadline.at(at(closesAt)),
      instanceSize: 'DEV1-L',
      hasJoinInfo: true,
    });

  const render = async (session: Session) => {
    TestBed.configureTestingModule({ providers: [{ provide: CLOCK, useValue: clock }] });
    const fixture = TestBed.createComponent(InServiceComponent);
    fixture.componentRef.setInput('view', {
      session,
      facts: { ip: null, joinInfo: null, lastError: null },
      stateSince: OPENED_AT,
    });
    fixture.componentRef.setInput('settings', DEFAULT_SETTINGS);
    await fixture.whenStable();
    return fixture;
  };

  it('leads with the time left, seconds apart so only they are red', async () => {
    const fixture = await render(running('2026-09-13T00:14:00'));
    const countdown = fixture.nativeElement.querySelector('[data-field="countdown"]');
    expect(countdown.textContent.replace(/\s/g, '')).toBe('2:47:00');
    expect(countdown.querySelector('[data-field="seconds"]').textContent).toBe(':00');
  });

  it('announces the closing hour with the word the glossary fixes', async () => {
    const text = (await render(running('2026-09-13T00:14:00'))).nativeElement.textContent;
    expect(text).toContain('Closes at');
    expect(text).toContain('00:14');
  });

  it('names whoever opened the evening', async () => {
    expect((await render(running('2026-09-13T00:14:00'))).nativeElement.textContent).toContain(
      'Charlouze',
    );
  });

  it('shows what the session has cost, as a fact and never a comparison', async () => {
    const text: string = (await render(running('2026-09-13T00:14:00'))).nativeElement.textContent;
    expect(text).toContain('This session');
    expect(text).toContain('€0.11');
    expect(text).not.toContain('7,90');
    expect(text.toLowerCase()).not.toContain('instead of');
    expect(text.toLowerCase()).not.toContain('saved');
  });

  /**
   * The Call Board's find, adopted without its dressing: the window reads as an
   * announced programme line rather than as a greyed button's excuse.
   */
  it('announces when the extension opens, above the button, while it is shut', async () => {
    const fixture = await render(running('2026-09-13T00:14:00'));
    const call = fixture.nativeElement.querySelector('[data-field="extension-call"]');
    expect(call.textContent).toContain('Extension call');
    expect(call.textContent).toContain('23:44');
    const extend = fixture.nativeElement.querySelector('[data-action="extend"]');
    expect(extend.disabled).toBe(true);
    // The reason is in plain sight, not in a title attribute.
    expect(extend.getAttribute('title')).toBeNull();
  });

  it('opens the button inside the window, and says the window is now', async () => {
    const fixture = await render(running('2026-09-12T21:40:00'));
    expect(fixture.nativeElement.querySelector('[data-action="extend"]').disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('[data-field="extension-call"]').textContent).toContain('now');
  });

  it('emits rather than writing, so the board needs no emulator to be tested', async () => {
    const fixture = await render(running('2026-09-12T21:40:00'));
    const extended = vi.fn();
    fixture.componentInstance.extended.subscribe(extended);
    fixture.nativeElement.querySelector('[data-action="extend"]').click();
    expect(extended).toHaveBeenCalledOnce();
  });

  it('offers to close, which every state that holds a machine allows', async () => {
    const fixture = await render(running('2026-09-13T00:14:00'));
    expect(fixture.nativeElement.querySelector('[data-action="close"]').disabled).toBe(false);
  });

  /**
   * The discriminant is `game`, which the session already carries (§4). This
   * two-branch switch is why no third component exists to do the forwarding.
   */
  describe('the join point', () => {
    const withJoinInfo = async (joinInfo: unknown) => {
      TestBed.configureTestingModule({ providers: [{ provide: CLOCK, useValue: clock }] });
      const fixture = TestBed.createComponent(InServiceComponent);
      fixture.componentRef.setInput('view', {
        session: running('2026-09-13T00:14:00'),
        facts: { ip: null, joinInfo, lastError: null },
        stateSince: OPENED_AT,
      });
      fixture.componentRef.setInput('settings', DEFAULT_SETTINGS);
      await fixture.whenStable();
      return fixture.nativeElement as HTMLElement;
    };

    it('picks the addressed shape for the game that has an address', async () => {
      const dom = await withJoinInfo({
        game: 'enshrouded',
        hostname: 'h',
        address: '1.2.3.4',
        port: 1,
      });
      expect(dom.querySelector('beacon-enshrouded-join')).not.toBeNull();
      expect(dom.querySelector('beacon-sunkenland-join')).toBeNull();
    });

    it('picks the identifier shape for the game that has none', async () => {
      const dom = await withJoinInfo({
        game: 'sunkenland',
        serverId: 'a~b',
        region: 'Europe',
        worldName: 'W',
      });
      expect(dom.querySelector('beacon-sunkenland-join')).not.toBeNull();
      expect(dom.querySelector('beacon-enshrouded-join')).toBeNull();
    });

    /**
     * RUNNING means the join point is published (§4), so this is the seam
     * between the state arriving and the fact arriving — a snapshot apart at
     * worst, and it must not render an empty "How to join".
     */
    it('shows no join block at all while the fact has not arrived', async () => {
      const dom = await withJoinInfo(null);
      expect(dom.querySelector('[data-field="join-point"]')).toBeNull();
      expect(dom.textContent).not.toContain('How to join');
    });
  });

  /**
   * §4: the deadline is bounded on read, so a forged one — clamped by the
   * watchdog five minutes later — cannot make the countdown walk backwards in
   * the meantime. A year out must read as four hours, the clamp bound, and the
   * closing hour must agree with the countdown.
   */
  it('counts to the displayed deadline, never to the raw one', async () => {
    const forged = running('2027-01-01T00:00:00');
    const fixture = await render(forged);
    const shownHoursMinutes: string = fixture.nativeElement.querySelector(
      '[data-field="hours-minutes"]',
    ).textContent;
    const hours = Number(shownHoursMinutes.split(':')[0]);
    expect(hours).toBeLessThanOrEqual(4);

    const shown = forged.displayedDeadline(clock, DEFAULT_SETTINGS).at;
    expect(fixture.nativeElement.querySelector('[data-field="closes-at"]').textContent).toContain(
      hourLabel(shown),
    );
  });
});
```

- [ ] **Étape 2 : lancer les tests, vérifier qu'ils échouent**

```bash
npx nx run web:test --skip-nx-cache
```

Attendu : ÉCHEC.

- [ ] **Étape 3 : écrire le composant et brancher la branche `RUNNING`**

L'instant d'ouverture de la fenêtre se calcule de l'échéance affichée moins
`extensionWindowMs`, et s'affiche par `hourLabel`. « now » remplace l'heure dès que
`canExtend` est vrai.

- [ ] **Étape 4 : lancer les tests, vérifier qu'ils passent**

```bash
npx nx run web:test --skip-nx-cache
```

Attendu : SUCCÈS.

- [ ] **Étape 5 : commit**

```bash
git add apps/web/src/app/session
git commit -m "feat(web): montre le temps restant, et annonce l'appel de prolongation"
```

---

## Tâche 10 : Hors service, et sa face après un refus

**Fichiers :**
- Créer : `apps/web/src/app/session/out-of-service.component.ts` + `.spec.ts`
- Modifier : `apps/web/src/app/session/session.page.html`

**Interfaces :**
- Consomme : `forecastCost`, `hourLabel`, `euroLabel`, `DisplayedFacts.lastError`.
- Produit : `<beacon-out-of-service … (opened)="$event" />`, dont l'événement
  porte le jeu choisi : `Game`.

**Les deux visages d'un même document.** Le §8 : « Création d'instance refusée
par le fournisseur → nettoyage, puis `IDLE` avec `lastError` : le bouton est
immédiatement recliquable. » Ce n'est pas un état de plus, c'est cet écran avec
un avertissement — et le bouton change de mot, rien d'autre.

**Le jeu s'enregistre, il ne se catalogue pas.** La soirée s'est décidée sur
Discord ; l'écran ne participe pas à ce choix-là. Deux boutons à bascule, celui
qui est choisi souligné, et le choix n'ouvre rien par lui-même.

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
import { TestBed } from '@angular/core/testing';
import { DEFAULT_SETTINGS, Session } from '@beacon/session';
import { CLOCK } from '../clock';
import { OutOfServiceComponent } from './out-of-service.component';

describe('OutOfServiceComponent', () => {
  const clock = { now: () => new Date('2026-09-12T20:14:00') };

  const render = async (lastError: string | null = null) => {
    TestBed.configureTestingModule({ providers: [{ provide: CLOCK, useValue: clock }] });
    const fixture = TestBed.createComponent(OutOfServiceComponent);
    fixture.componentRef.setInput('view', {
      session: Session.idle(),
      facts: { ip: null, joinInfo: null, lastError },
      stateSince: null,
    });
    fixture.componentRef.setInput('settings', DEFAULT_SETTINGS);
    await fixture.whenStable();
    return fixture;
  };

  it('states plainly that nothing is running', async () => {
    expect((await render()).nativeElement.textContent).toContain('Nothing is running');
  });

  it('quotes the next session from the deployed settings, hour and price', async () => {
    const text = (await render()).nativeElement.textContent;
    expect(text).toContain('Next session');
    expect(text).toContain('00:14');
    expect(text).toContain('Estimated cost');
    expect(text).toContain('€0.22');
  });

  /**
   * The surface brief settles it: a promise made before the click is not the
   * same thing as an hour observed after it. This screen is before.
   */
  it('promises no hour before the click, only that one will be told', async () => {
    const text: string = (await render()).nativeElement.textContent;
    expect(text).not.toContain('Ready between');
    expect(text).toContain('exact time');
  });

  it('records the game without opening anything by itself', async () => {
    const fixture = await render();
    const opened = vi.fn();
    fixture.componentInstance.opened.subscribe(opened);
    const [enshrouded] = [...fixture.nativeElement.querySelectorAll('[data-game]')];
    enshrouded.click();
    await fixture.whenStable();
    expect(opened).not.toHaveBeenCalled();
    expect(enshrouded.getAttribute('aria-pressed')).toBe('true');
  });

  it('opens with the game that was recorded', async () => {
    const fixture = await render();
    const opened = vi.fn();
    fixture.componentInstance.opened.subscribe(opened);
    fixture.nativeElement.querySelector('[data-game="enshrouded"]').click();
    await fixture.whenStable();
    fixture.nativeElement.querySelector('[data-action="open"]').click();
    expect(opened).toHaveBeenCalledWith('enshrouded');
  });

  describe('after a refusal', () => {
    const REFUSAL = 'no capacity left for this machine size in the zone';

    it('names the problem, and quotes what the host said', async () => {
      const text = (await render(REFUSAL)).nativeElement.textContent;
      expect(text).toContain('didn’t start');
      expect(text).toContain(REFUSAL);
    });

    /** §8: nothing was left running, and the button is clickable at once. */
    it('says nothing is being charged, and leaves the button working', async () => {
      const fixture = await render(REFUSAL);
      expect(fixture.nativeElement.textContent).toContain('nothing is costing');
      expect(fixture.nativeElement.querySelector('[data-action="open"]').disabled).toBe(false);
    });

    it('changes the word on the button, and nothing else about the screen', async () => {
      expect(
        (await render(REFUSAL)).nativeElement.querySelector('[data-action="open"]').textContent,
      ).toContain('Try again');
      expect(
        (await render()).nativeElement.querySelector('[data-action="open"]').textContent,
      ).toContain('Open the service');
    });

    it('marks the refusal with the one red, which is reserved for exactly this', async () => {
      const fixture = await render(REFUSAL);
      expect(fixture.nativeElement.querySelector('[data-field="host-said"]')).not.toBeNull();
    });
  });
});
```

- [ ] **Étape 2 : lancer les tests, vérifier qu'ils échouent**

```bash
npx nx run web:test --skip-nx-cache
```

Attendu : ÉCHEC.

- [ ] **Étape 3 : écrire le composant et brancher la branche `IDLE`**

- [ ] **Étape 4 : lancer les tests, vérifier qu'ils passent**

```bash
npx nx run web:test --skip-nx-cache
```

Attendu : SUCCÈS.

- [ ] **Étape 5 : commit**

```bash
git add apps/web/src/app/session
git commit -m "feat(web): dit qu'aucune machine ne tourne, et pourquoi la derniere n'a pas demarre"
```

---

## Tâche 11 : Démarrage — l'écran qui libère

**Fichiers :**
- Créer : `apps/web/src/app/session/preparing.component.ts` + `.spec.ts`
- Modifier : `apps/web/src/app/session/session.page.html`

**Interfaces :**
- Consomme : `readyWindow`, `hourLabel`, `euroLabel`, `estimatedCost`,
  `canRequestStop`, et `stateSince`.

**Le composant lit `stateSince` dans la vue**, que la tâche 5 a rendu lisible
côté client. Pas `startedAt` : c'est l'ouverture de la session, le même instant
aujourd'hui et un instant différent le jour où un état en précède un autre.

**Contrainte n° 3, mot pour mot :** « l'interface annonce l'heure de
disponibilité et rend l'utilisateur à sa soirée. Elle ne cherche jamais à
retenir ni à occuper l'attente. » Donc : aucune barre de progression, aucune
étape, aucun pourcentage, rien qui tourne, et une phrase qui rend la soirée.

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
import { TestBed } from '@angular/core/testing';
import { DEFAULT_SETTINGS, Deadline, Session } from '@beacon/session';
import { CLOCK } from '../clock';
import { PreparingComponent } from './preparing.component';

describe('PreparingComponent', () => {
  const startedAt = new Date('2026-09-12T20:14:00');
  const clock = { now: () => new Date('2026-09-12T20:15:30') };

  const render = async () => {
    TestBed.configureTestingModule({ providers: [{ provide: CLOCK, useValue: clock }] });
    const fixture = TestBed.createComponent(PreparingComponent);
    const session = Session.from({
        state: 'PROVISIONING',
        sessionId: 'sess1',
        game: 'sunkenland',
        startedBy: 'Charlouze',
        startedAt,
        deadline: Deadline.at(new Date('2026-09-13T00:14:00')),
      instanceSize: 'DEV1-L',
      hasJoinInfo: false,
    });
    fixture.componentRef.setInput('view', {
      session,
      facts: { ip: null, joinInfo: null, lastError: null },
      stateSince: startedAt,
    });
    fixture.componentRef.setInput('settings', DEFAULT_SETTINGS);
    await fixture.whenStable();
    return fixture;
  };

  /**
   * probe/RESULTS.md §S: 4 min 49 s then 7 min 58 s on the same size in the
   * same zone. A single hour would be three minutes wrong one time in two, and
   * an hour contradicted releases nobody.
   */
  it('announces a window and never a single hour', async () => {
    const text = (await render()).nativeElement.textContent;
    expect(text).toContain('Ready between');
    expect(text).toContain('20:19');
    expect(text).toContain('20:22');
    expect(text).not.toContain('Ready around');
  });

  it('hands the evening back, in as many words', async () => {
    const text: string = (await render()).nativeElement.textContent;
    expect(text).toContain('Nothing to watch');
    expect(text.toLowerCase()).toMatch(/close the tab|put the phone down/);
  });

  /** The interface never tries to hold or occupy the wait. */
  it('shows no progress of any kind', async () => {
    const fixture = await render();
    expect(fixture.nativeElement.querySelector('progress')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="progressbar"]')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toMatch(/%|step \d|downloading/i);
  });

  /** Nothing falls on this screen, so nothing moves on it. */
  it('runs no countdown, and animates nothing', async () => {
    const fixture = await render();
    expect(fixture.nativeElement.querySelector('[data-field="countdown"]')).toBeNull();
    for (const node of fixture.nativeElement.querySelectorAll('*')) {
      expect(getComputedStyle(node).animationName).toBe('none');
    }
  });

  it('still says when the evening closes, which is the promise of the product', async () => {
    const text = (await render()).nativeElement.textContent;
    expect(text).toContain('Closes at');
    expect(text).toContain('00:14');
  });

  /** §11: the started hour is due whatever happens next, and saying so is honest. */
  it('offers to close now, and says the first hour is charged either way', async () => {
    const fixture = await render();
    expect(fixture.nativeElement.querySelector('[data-action="close"]').disabled).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('first hour is charged');
  });
});
```

- [ ] **Étape 2 : lancer les tests, vérifier qu'ils échouent**

```bash
npx nx run web:test --skip-nx-cache
```

Attendu : ÉCHEC.

- [ ] **Étape 3 : écrire le composant et brancher la branche `PROVISIONING`**

La fourchette descend à 112 px en large et se casse en deux lignes sur
téléphone : le contrat fixe 172 px au **temps restant**, et cet écran n'en a
aucun. Deux heures et un tiret ne tiennent pas à 390 px.

- [ ] **Étape 4 : lancer les tests, vérifier qu'ils passent**

```bash
npx nx run web:test --skip-nx-cache
```

Attendu : SUCCÈS.

- [ ] **Étape 5 : commit**

```bash
git add apps/web/src/app/session
git commit -m "feat(web): annonce une fourchette de disponibilite, et rend la soiree"
```

---

## Tâche 12 : Fermeture, et bloqué

**Fichiers :**
- Créer : `apps/web/src/app/session/closing.component.ts` + `.spec.ts`
- Créer : `apps/web/src/app/session/not-cleared.component.ts` + `.spec.ts`
- Modifier : `apps/web/src/app/session/session.page.html`

**Deux états, une tâche, parce qu'ils partagent la chose qui les définit :
aucune action.** Un relecteur qui accepterait l'un et refuserait l'autre
jugerait deux fois la même décision.

**Fermeture porte la seule promesse interdite.** `PRODUCT.md` : « la sauvegarde
du serveur suit une cadence, et rien ne permet de la forcer […] L'interface ne
doit donc jamais affirmer que tout est sauvegardé à l'instant. » C'est le seul
endroit du produit où cette phrase doit se voir, et elle se dit sans alarmer :
c'est une cadence, pas un incident.

**Bloqué n'a aucun geste utile à offrir.** Le §8 : « `FAILED`, que le watchdog
retente toutes les 5 min jusqu'à `IDLE`. Aucun état du système n'est sans
issue. » Offrir un bouton serait mentir sur qui répare.

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
import { TestBed } from '@angular/core/testing';
import { DEFAULT_SETTINGS, Deadline, Session } from '@beacon/session';
import { CLOCK } from '../clock';
import { ClosingComponent } from './closing.component';
import { NotClearedComponent } from './not-cleared.component';

const session = (state: 'STOPPING' | 'FAILED') =>
  Session.from({
    state,
    sessionId: 'sess1',
    game: 'sunkenland',
    startedBy: 'Charlouze',
    startedAt: new Date('2026-09-12T20:14:00'),
    deadline: Deadline.at(new Date('2026-09-13T00:14:00')),
    instanceSize: 'DEV1-L',
    hasJoinInfo: false,
  });

const clock = { now: () => new Date('2026-09-13T00:31:00') };

describe('ClosingComponent', () => {
  const render = async () => {
    TestBed.configureTestingModule({ providers: [{ provide: CLOCK, useValue: clock }] });
    const fixture = TestBed.createComponent(ClosingComponent);
    fixture.componentRef.setInput('view', {
      session: session('STOPPING'),
      facts: { ip: null, joinInfo: null, lastError: null },
      stateSince: new Date('2026-09-13T00:30:00'),
    });
    fixture.componentRef.setInput('settings', DEFAULT_SETTINGS);
    await fixture.whenStable();
    return fixture;
  };

  it('says the machine is going, and that there is no paused server to return to', async () => {
    const text = (await render()).nativeElement.textContent;
    expect(text).toContain('Closing down');
    expect(text.toLowerCase()).toContain('no paused server');
  });

  /**
   * PRODUCT.md, and it is the one sentence this product may never say: that
   * everything is saved right now. The cadence is stated, the guarantee is not.
   */
  it('states the save cadence, and never claims the world is saved', async () => {
    const text: string = (await render()).nativeElement.textContent;
    expect(text.toLowerCase()).toContain('own schedule');
    expect(text.toLowerCase()).not.toMatch(/everything is saved|saved successfully|all saved/);
  });

  it('offers nothing to press, there being nothing useful to do', async () => {
    expect((await render()).nativeElement.querySelectorAll('button')).toHaveLength(0);
  });
});

describe('NotClearedComponent', () => {
  const render = async (lastError: string | null = 'the machine will not delete') => {
    TestBed.configureTestingModule({ providers: [{ provide: CLOCK, useValue: clock }] });
    const fixture = TestBed.createComponent(NotClearedComponent);
    fixture.componentRef.setInput('view', {
      session: session('FAILED'),
      facts: { ip: null, joinInfo: null, lastError },
      stateSince: new Date('2026-09-13T00:31:00'),
    });
    fixture.componentRef.setInput('settings', DEFAULT_SETTINGS);
    await fixture.whenStable();
    return fixture;
  };

  it('says something was left behind, and that it is still being charged', async () => {
    const text = (await render()).nativeElement.textContent;
    expect(text).toContain('left behind');
    expect(text).toContain('Still being charged');
  });

  /** §8: retried every five minutes until IDLE. No state of this system is a dead end. */
  it('says who repairs it, and that it does not give up', async () => {
    const text: string = (await render()).nativeElement.textContent;
    expect(text).toContain('five minutes');
    expect(text.toLowerCase()).toContain('nothing for you to do');
  });

  it('offers nothing to press, because no gesture would help', async () => {
    expect((await render()).nativeElement.querySelectorAll('button')).toHaveLength(0);
  });

  it('quotes what the host said, expurgated and bounded (§5)', async () => {
    expect((await render()).nativeElement.textContent).toContain('the machine will not delete');
  });

  it('holds its tongue when the record says nothing about the cause', async () => {
    const text: string = (await render(null)).nativeElement.textContent;
    expect(text).toContain('left behind');
    expect(text.toLowerCase()).not.toContain('what the host said');
  });

  /**
   * The only red figure of the product, because it is the only one still
   * climbing. The test asserts the state, not the colour: what paints
   * `data-climbing` red is the stylesheet, and `world.spec.ts` is what pins
   * that red to the value the contract fixes.
   */
  it('marks the cost as still climbing, which is what earns it the one red', async () => {
    const fixture = await render();
    expect(
      fixture.nativeElement.querySelector('[data-field="cost"]').dataset.climbing,
    ).toBe('true');
  });
});
```

- [ ] **Étape 2 : lancer les tests, vérifier qu'ils échouent**

```bash
npx nx run web:test --skip-nx-cache
```

Attendu : ÉCHEC.

- [ ] **Étape 3 : écrire les deux composants et brancher les deux branches**

- [ ] **Étape 4 : lancer les tests, vérifier qu'ils passent**

```bash
npx nx run web:test --skip-nx-cache
```

Attendu : SUCCÈS.

- [ ] **Étape 5 : commit**

```bash
git add apps/web/src/app/session
git commit -m "feat(web): dit la cadence de sauvegarde, et qu'une machine restee debout se retente seule"
```

---

## Tâche 13 : Déconnecté, et visiteur

**Fichiers :**
- Créer : `apps/web/src/app/access/signed-out.component.ts` + `.spec.ts`
- Créer : `apps/web/src/app/access/visitor.component.ts` + `.spec.ts`

**Interfaces :**
- Produit : `<beacon-signed-out (signIn)="…" />` et
  `<beacon-visitor [name]="…" (signOut)="…" />`.

**Ce que le visiteur ne doit pas apprendre.** Le §5 : « Aucune lecture n'est
ouverte à un authentifié non membre. Sans cette règle, n'importe quel compte
Google lirait les adresses e-mail de `members`, l'IP d'une machine exposée sur
Internet et les coûts. » L'écran n'a donc rien à montrer, et c'est le test qui
le tient.

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
import { TestBed } from '@angular/core/testing';
import { SignedOutComponent } from './signed-out.component';
import { VisitorComponent } from './visitor.component';

describe('SignedOutComponent', () => {
  const render = async () => {
    const fixture = TestBed.createComponent(SignedOutComponent);
    await fixture.whenStable();
    return fixture;
  };

  it('says what the product is, in the one sentence that is its positioning', async () => {
    expect((await render()).nativeElement.textContent).toContain('closes itself');
  });

  it('offers one door, and only one', async () => {
    const buttons = [...(await render()).nativeElement.querySelectorAll('button')];
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toContain('Sign in with Google');
  });

  /**
   * §5: no session state is readable without membership, so showing one would
   * mean inventing it. Silence here is the correct answer, not an empty state.
   */
  it('shows no session state at all', async () => {
    const fixture = await render();
    expect(fixture.nativeElement.querySelector('[data-field="state"]')).toBeNull();
    const text: string = fixture.nativeElement.textContent;
    for (const label of ['Out of service', 'In service', 'Preparing', 'Time left']) {
      expect(text).not.toContain(label);
    }
  });

  it('emits rather than signing in itself, the sdk living in a *-record module', async () => {
    const fixture = await render();
    const signIn = vi.fn();
    fixture.componentInstance.signIn.subscribe(signIn);
    fixture.nativeElement.querySelector('button').click();
    expect(signIn).toHaveBeenCalledOnce();
  });
});

describe('VisitorComponent', () => {
  const render = async () => {
    const fixture = TestBed.createComponent(VisitorComponent);
    fixture.componentRef.setInput('name', 'Alex Durand');
    await fixture.whenStable();
    return fixture;
  };

  it('says the one true thing: signed in, and not on the list', async () => {
    const text = (await render()).nativeElement.textContent;
    expect(text).toContain('not on the list');
    expect(text).toContain('Alex Durand');
  });

  it('says what to do about it, which is to ask a person', async () => {
    expect((await render()).nativeElement.textContent.toLowerCase()).toContain('ask whoever');
  });

  it('leaks nothing: no state, no address, no cost', async () => {
    const text: string = (await render()).nativeElement.textContent;
    expect(text).not.toMatch(/€|\d+\.\d+\.\d+\.\d+/);
    for (const label of ['Out of service', 'In service', 'How to join', 'This session']) {
      expect(text).not.toContain(label);
    }
  });

  it('offers only the way out', async () => {
    const buttons = [...(await render()).nativeElement.querySelectorAll('button')];
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toContain('Sign out');
  });
});
```

- [ ] **Étape 2 : lancer les tests, vérifier qu'ils échouent**

```bash
npx nx run web:test --skip-nx-cache
```

Attendu : ÉCHEC.

- [ ] **Étape 3 : écrire les deux composants**

- [ ] **Étape 4 : lancer les tests, vérifier qu'ils passent**

```bash
npx nx run web:test --skip-nx-cache
```

Attendu : SUCCÈS.

- [ ] **Étape 5 : commit**

```bash
git add apps/web/src/app/access
git commit -m "feat(web): ouvre une seule porte, et ne laisse rien fuir a qui n'est pas membre"
```

---

## Tâche 13 bis : La déclaration du compte Steam

**Fichiers :**
- Créer : `apps/web/src/app/session/steam-declaration.component.ts` + `.spec.ts`
- Modifier : `apps/web/src/app/session/session.page.html`

**Interfaces :**
- Consomme : le membre connecté — `{ uid, name, role, steamId }`.
- Produit : `<beacon-steam-declaration [steamId]="…" (declared)="$event" />`, dont
  l'événement porte la chaîne saisie.

**Pourquoi elle existe, alors qu'aucune maquette ne la montre.** Le §2 donne le
rôle d'administrateur **dans le jeu** à tous les membres, par `-adminSteamIDs`,
et c'est le seul moyen qu'un humain a de déclencher une sauvegarde sur
Sunkenland — où le §8 mesure que rien d'autre ne peut la provoquer. Le pilote
portait un champ de saisie nu ; le supprimer sans le remplacer retirerait cette
capacité à tout membre arrivé après cette tranche.

**La forme, décidée le 2026-09-12 : un bandeau sur le plateau, pas un modal.**
Une bande pleine largeur sous le filet de 4 px, dans le registre du bandeau
d'avertissement mais en encre et non en rouge — le rouge est réservé aux
secondes et aux avertissements, et un champ à remplir n'en est pas un. Elle
n'interrompt rien, ne se ferme pas par mégarde, et l'état reste lisible en une
seconde au-dessus d'elle : ce que le modal recouvrait est très exactement ce que
cet écran existe pour faire. Le plancher de métier d'Impeccable range d'ailleurs
le modal parmi ses refus par défaut pour une tâche qui n'a besoin ni
d'interruption ni de focus protégé.

**Une fois déclaré, le bandeau devient un contrôle discret qui porte la valeur.**
Pas un lien « change » : le SteamID s'affiche. Il est sans risque à montrer —
`members/{uid}` n'est lisible que par son sujet ou un admin (§5), donc personne
d'autre ne le voit — et un membre qui ne relit jamais ce qu'il a saisi ne peut
pas corriger une faute de frappe, dont le §5 dit que la seule conséquence est de
ne pas obtenir le rôle, silencieusement.

**Ce que le composant ne fait pas : valider.** `admin-membership.ts` porte déjà
la règle, et son commentaire dit pourquoi elle est là et pas ailleurs : « the
shape is checked here because this is where a declared value becomes an
administrator ». Un second contrôle dans l'écran serait une seconde vérité, et
c'est le plus faible des deux qui gagnerait le jour où ils divergeraient.

- [ ] **Étape 1 : écrire les tests qui échouent**

```ts
import { TestBed } from '@angular/core/testing';
import { SteamDeclarationComponent } from './steam-declaration.component';

describe('SteamDeclarationComponent', () => {
  const render = async (steamId: string | null) => {
    const fixture = TestBed.createComponent(SteamDeclarationComponent);
    fixture.componentRef.setInput('steamId', steamId);
    await fixture.whenStable();
    return fixture;
  };

  describe('before it is declared', () => {
    it('asks for it as a band, and says what it buys', async () => {
      const fixture = await render(null);
      expect(fixture.nativeElement.querySelector('[data-field="steam-band"]')).not.toBeNull();
      const text: string = fixture.nativeElement.textContent;
      expect(text).toContain('Steam account');
      expect(text.toLowerCase()).toContain('save the world from inside the game');
    });

    /** The one red is the seconds and the warnings. A field to fill is neither. */
    it('asks in ink, never in the signalling red', async () => {
      const fixture = await render(null);
      expect(fixture.nativeElement.querySelector('[data-field="steam-band"][data-warn]')).toBeNull();
    });

    it('offers a field and a way to send it', async () => {
      const fixture = await render(null);
      expect(fixture.nativeElement.querySelector('input')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[data-action="declare"]')).not.toBeNull();
    });

    it('emits what was typed, and validates nothing itself', async () => {
      const fixture = await render(null);
      const declared = vi.fn();
      fixture.componentInstance.declared.subscribe(declared);
      const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
      input.value = '76561198000000000';
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
      fixture.nativeElement.querySelector('[data-action="declare"]').click();
      expect(declared).toHaveBeenCalledWith('76561198000000000');
    });

    it('sends nothing while the field is empty', async () => {
      const fixture = await render(null);
      const declared = vi.fn();
      fixture.componentInstance.declared.subscribe(declared);
      fixture.nativeElement.querySelector('[data-action="declare"]').click();
      expect(declared).not.toHaveBeenCalled();
    });
  });

  describe('once it is declared', () => {
    it('shows the value itself, and not a bare "change"', async () => {
      const fixture = await render('76561198000000000');
      expect(fixture.nativeElement.textContent).toContain('76561198000000000');
    });

    it('stops asking: the band gives way to a quiet control', async () => {
      const fixture = await render('76561198000000000');
      expect(fixture.nativeElement.querySelector('[data-field="steam-band"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('input')).toBeNull();
    });

    /** A typo costs the in-game role silently (§5), so it has to be correctable. */
    it('reopens the field on demand, prefilled with what is recorded', async () => {
      const fixture = await render('76561198000000000');
      fixture.nativeElement.querySelector('[data-action="change"]').click();
      await fixture.whenStable();
      const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
      expect(input.value).toBe('76561198000000000');
    });

    it('aligns the digits, a seventeen-figure number being read by eye', async () => {
      const fixture = await render('76561198000000000');
      const value = fixture.nativeElement.querySelector('[data-field="steam-id"]');
      expect(getComputedStyle(value).fontVariantNumeric).toContain('tabular-nums');
    });
  });
});
```

- [ ] **Étape 2 : lancer les tests, vérifier qu'ils échouent**

```bash
npx nx run web:test --skip-nx-cache
```

Attendu : ÉCHEC, le composant n'existe pas.

- [ ] **Étape 3 : écrire le composant, et le poser sur le plateau**

Il se place sous le filet de 4 px, avant le corps de l'état, et **dans les cinq
états** : le rôle dans le jeu ne dépend pas de ce qui tourne. Le contrôle
discret, lui, vit dans le pied.

- [ ] **Étape 4 : lancer les tests, vérifier qu'ils passent**

```bash
npx nx run web:test --skip-nx-cache
```

Attendu : SUCCÈS.

- [ ] **Étape 5 : commit**

```bash
git add apps/web/src/app/session
git commit -m "feat(web): demande son compte steam une fois, et le montre ensuite"
```

---

## Tâche 14 : `App` devient une coquille, et le pilote disparaît

**Fichiers :**
- Modifier : `apps/web/src/app/app.ts` (les 208 lignes actuelles)
- Créer : `apps/web/src/app/app.spec.ts`

**Interfaces :**
- Consomme : tout ce que les tâches 8 à 13 produisent.
- Produit : l'application telle qu'un membre la voit.

**Ce qui reste dans `App`, et rien d'autre :** la connexion aux deux `*-record`,
l'aiguillage déconnecté / visiteur / membre, la gestion des abonnements, le
rechargement sur dérive de version, et le passage des actions vers les deux
enregistrements. **Tout ce qui est visible part dans les composants.** Ce que le
pilote faisait en `<h1>` et en `<button>` nus n'a aucune raison de survivre — son
propre commentaire le demandait.

**La déclaration du `steamId` a sa propre tâche**, la 13 bis, décidée le
2026-09-12. `App` ne fait que lui passer le membre et remonter son écriture.

- [ ] **Étape 1 : écrire les tests qui échouent**

`App` construit une connexion réelle dans l'initialiseur de ses champs, donc son
test fournit `FIREBASE_CONNECTION` et des doubles des deux enregistrements. Ce
que ce test tient est **l'aiguillage**, pas le rendu — celui-là est déjà tenu,
composant par composant.

`App` appelle `connectSessionRecord` et `connectMembershipRecord` dans
l'initialiseur de ses champs, donc ces deux fonctions doivent être doublées au
niveau du module. Le double publie les rappels qu'il reçoit, ce qui permet au
test de jouer la vie d'un onglet sans émulateur.

```ts
import { TestBed } from '@angular/core/testing';
import type { Viewer } from '@beacon/membership-record/client';
import { App, FIREBASE_CONNECTION } from './app';

vi.mock('@beacon/session-record/client', () => ({
  connectSessionRecord: () => sessionRecord,
}));
vi.mock('@beacon/membership-record/client', () => ({
  connectMembershipRecord: () => membershipRecord,
}));

/** The unsubscribes are the point of half these tests, so they are spies. */
const stopWatch = vi.fn();
const stopSettings = vi.fn();
const stopDrift = vi.fn();

let publishViewer: (viewer: Viewer) => void;
let publishDrift: () => void;

const sessionRecord = {
  watch: vi.fn((on) => {
    on(null);
    return stopWatch;
  }),
  watchSettings: vi.fn(() => stopSettings),
  watchVersionDrift: vi.fn((_compiled, onDrift) => {
    publishDrift = onDrift;
    return stopDrift;
  }),
  open: vi.fn(async () => undefined),
  extend: vi.fn(async () => undefined),
  requestStop: vi.fn(async () => undefined),
};

const membershipRecord = {
  watchViewer: vi.fn((on) => {
    publishViewer = on;
    return () => undefined;
  }),
  signIn: vi.fn(async () => undefined),
  signOut: vi.fn(async () => undefined),
  declareSteamId: vi.fn(async () => undefined),
};

const MEMBER: Viewer = {
  kind: 'member',
  member: { uid: 'u1', name: 'Charlouze', role: 'player' },
} as Viewer;

describe('App', () => {
  const boot = async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: FIREBASE_CONNECTION, useValue: { app: {} as never } },
      ],
    });
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    return fixture;
  };

  const show = async (fixture: Awaited<ReturnType<typeof boot>>, viewer: Viewer) => {
    publishViewer(viewer);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  };

  beforeEach(() => vi.clearAllMocks());

  it('shows the one door to somebody who is signed out', async () => {
    const dom = await show(await boot(), { kind: 'signed-out' } as Viewer);
    expect(dom.querySelector('beacon-signed-out')).not.toBeNull();
    expect(dom.querySelector('beacon-session-page')).toBeNull();
  });

  it('shows the visitor screen to an account that is not a member', async () => {
    const dom = await show(await boot(), {
      kind: 'visitor',
      identity: { name: 'Alex Durand' },
    } as Viewer);
    expect(dom.querySelector('beacon-visitor')).not.toBeNull();
    expect(dom.textContent).toContain('Alex Durand');
    expect(dom.querySelector('beacon-session-page')).toBeNull();
  });

  it('shows the board to a member, and no access screen', async () => {
    const dom = await show(await boot(), MEMBER);
    expect(dom.querySelector('beacon-session-page')).not.toBeNull();
    expect(dom.querySelector('beacon-signed-out')).toBeNull();
    expect(dom.querySelector('beacon-visitor')).toBeNull();
  });

  /**
   * Every document the session record reads is a member's (§5), so the
   * subscriptions live exactly as long as the membership does. A visitor left
   * subscribed to `server/current` is refused for the whole life of the tab,
   * and the screen would show an empty board rather than the one thing that is
   * true: it is not a member. The driver earned this behaviour in tranche 4.
   */
  it('drops every subscription the moment a membership ends', async () => {
    const fixture = await boot();
    await show(fixture, MEMBER);
    await show(fixture, { kind: 'visitor', identity: { name: 'Alex' } } as Viewer);
    expect(stopWatch).toHaveBeenCalledOnce();
    expect(stopSettings).toHaveBeenCalledOnce();
    expect(stopDrift).toHaveBeenCalledOnce();
  });

  /**
   * `watchViewer` republishes on every snapshot of `members/{uid}` — a declared
   * steam id is one — and each would open a second set.
   */
  it('opens no second set when the member document changes', async () => {
    const fixture = await boot();
    await show(fixture, MEMBER);
    await show(fixture, MEMBER);
    expect(sessionRecord.watch).toHaveBeenCalledOnce();
    expect(sessionRecord.watchSettings).toHaveBeenCalledOnce();
  });

  /**
   * The humble gesture: a tab running yesterday's rules against today's
   * deployment cannot be reasoned back into agreement, it can only start over.
   */
  it('reloads the tab when the deployed rules version drifts', async () => {
    const reload = vi.fn();
    vi.spyOn(globalThis, 'location', 'get').mockReturnValue({ reload } as never);
    const fixture = await boot();
    await show(fixture, MEMBER);
    publishDrift();
    expect(reload).toHaveBeenCalledOnce();
  });

  it('carries a refused write to the screen rather than swallowing it', async () => {
    sessionRecord.extend.mockRejectedValueOnce(new Error('permission-denied'));
    const fixture = await boot();
    const dom = await show(fixture, MEMBER);
    fixture.componentInstance.extend();
    await fixture.whenStable();
    expect(dom.querySelector('[role="alert"]')?.textContent).toContain('permission-denied');
  });
});
```

**Les doubles se recréent à chaque test, jamais partagés.** Le squelette
ci-dessus les déclare au niveau du module parce que `vi.mock` l'exige, mais
`beforeEach` doit en reposer un jeu neuf — pas seulement appeler
`clearAllMocks`. Un `let` de module qui survit d'un test à l'autre fait passer
un test grâce au précédent, et c'est la panne la plus chère à lire d'une suite :
elle n'apparaît qu'en changeant l'ordre.

**Les quatre derniers comportements ne se négocient pas** : ce sont des défauts
que la tranche 4 a payés une fois, et les commentaires de `app.ts` disent
lesquels. Un test qui les perdrait rendrait le pilote meilleur que l'écran.

- [ ] **Étape 2 : lancer les tests, vérifier qu'ils échouent**

```bash
npx nx run web:test --skip-nx-cache
```

- [ ] **Étape 3 : réécrire `App`**

Le gabarit tombe à trois branches. Les commentaires de décision du pilote qui
portent une leçon — pourquoi les abonnements suivent la qualité de membre,
pourquoi le record se laisse tomber à la déconnexion, pourquoi une erreur
s'affiche au lieu d'être avalée — **se conservent mot pour mot**. Ce sont les
seules lignes du pilote qui valaient d'être écrites.

- [ ] **Étape 4 : lancer la vérification complète**

```bash
npx nx run-many -t lint test build typecheck --all --skip-nx-cache
```

Attendu : SUCCÈS sur les seize projets.

- [ ] **Étape 5 : commit**

```bash
git add apps/web/src/app
git commit -m "feat(web): remplace le pilote par l'ecran, et ne garde que ses lecons"
```

---

## Tâche 15 : Le détecteur, et la revue de fin du monde visuel

**Fichiers :**
- Créer : `.impeccable/DESIGN.md` et son fichier annexe
- Modifier : ce que la revue désigne

**REQUIRED SUB-SKILL :** `impeccable:impeccable`. C'est sa clause `FINISH`, et
elle est dans le contrat de direction : « unreviewed and undocumented is
unfinished; this build ends with the finish review, the verdict, DESIGN.md, and
every shipping raster carrying its provenance ». Aucun raster n'est produit par
cette tranche — le monde n'en a aucun —, donc la provenance ne concerne rien
ici.

- [ ] **Étape 1 : passer le détecteur mécanique, une fois, sur ce qui a changé**

```bash
node .claude/skills/impeccable/scripts/detect.mjs --json \
  apps/web/src/styles.css apps/web/src/app/session apps/web/src/app/access apps/web/src/app/join
```

**Attention, réserve mesurée le 2026-09-11 :** sur ce poste le détecteur tourne
en mode dégradé — `htmlparser2`, `css-select`, `css-tree` et `domutils` sont
absents —, donc les propriétés personnalisées, la correspondance de sélecteurs
et le contraste calculé ne sont **pas** évalués. Un verdict vide est un
sous-comptage, pas un quitus. Installer les quatre modules ou lire le résultat
pour ce qu'il est, et l'écrire.

- [ ] **Étape 2 : corriger tout ce que le détecteur montre, en un seul lot**

- [ ] **Étape 3 : lancer la revue de fin**

Elle juge le résultat construit contre le contrat de direction, le comp approuvé
et la barre de qualité du monde retenu, et rend une liste ordonnée de
corrections matérielles.

- [ ] **Étape 4 : appliquer les corrections matérielles, et rien de plus**

Ce qui n'est pas matériel se note et ne se corrige pas : le tour d'inspection est
borné, et le polissage ouvert brûle du budget à faire moins bien ce que cette
revue fait mieux.

- [ ] **Étape 5 : écrire `DESIGN.md`**

Il se **dérive de l'artefact livré**, pas des intentions : les tokens tels
qu'ils sont dans `styles.css`, l'échelle telle qu'elle est rendue, les
composants tels qu'ils existent.

- [ ] **Étape 6 : commit**

```bash
git add .impeccable apps/web
git commit -m "docs(design): releve le systeme tel qu'il a ete livre, et ce que la revue a corrige"
```

---

## Tâche 16 : La soirée contre l'émulateur, conduite par un humain

**Fichiers :** aucun. Cette tâche produit un relevé, pas du code.

**Ce qu'aucun test de ce plan ne peut dire.** Les neuf compositions sont tenues
une par une par des tests de composant ; ce qui n'est tenu nulle part, c'est
**la traversée** — un état qui succède à un autre, un décompte qui survit à une
prolongation, un point de jonction qui apparaît, une erreur qui s'affiche puis
disparaît. Et la scène réelle : un téléphone à 390 px, une main, et personne
pour lire une notice.

**Conduite par un humain de bout en bout.** Aucun agent ne lance ces commandes
au-delà de l'émulateur.

- [ ] **Étape 1 : lever l'émulateur et semer**

```bash
npx nx run functions:emulate
```

- [ ] **Étape 2 : parcourir les neuf compositions, dans les deux largeurs**

À vérifier, dans l'ordre, et à noter : déconnecté → visiteur → hors service →
ouverture → démarrage → en service → prolongation dans la fenêtre → fermeture →
retour hors service. Puis les deux compositions rares, en forçant le document :
`IDLE` avec `lastError`, et `FAILED`.

Les deux largeurs comptent autant : **1440 px et 390 px**, pas une fenêtre
rétrécie — la scène du téléphone est une main sur un canapé.

- [ ] **Étape 3 : vérifier les trois choses qu'un test de composant ne voit pas**

- la seconde tombe, et **rien d'autre ne bouge** sur toute la page ;
- le décompte ne recule jamais, y compris après une prolongation ;
- l'identifiant de 55 caractères se coupe sur le `~` à 390 px, et le bouton de
  copie livre ce qui se colle dans le jeu.

- [ ] **Étape 4 : écrire le relevé**

Dans `docs/superpowers/plans/2026-09-12-tranche-5-session.md`, à la façon des
relevés des tranches précédentes : les durées, ce qui a surpris, ce qui reste
ouvert. **Ce que la soirée infirme corrige le spec avant que le plan de la
tranche suivante s'écrive** — c'est la règle de `CLAUDE.md`, et la tranche 0 l'a
apprise le jour de la validation du spec.

- [ ] **Étape 5 : commit**

```bash
git add docs/superpowers/plans/2026-09-12-tranche-5-session.md
git commit -m "docs(plan): releve la premiere soiree devant l'ecran"
```

---

## Tâche 17 : La typographie — décision, pas exécution

**Fichiers :** aucun, tant que la décision n'est pas prise.

**Ce que le tour de maquettes a laissé ouvert, et pourquoi c'est ici.** Les neuf
compositions tournent sur les polices système, et le plancher de métier
d'Impeccable est explicite : une police système en voix d'affichage est un échec,
pas un repli. Il faut une fonte choisie et **auto-hébergée** — donc un fichier
binaire dans le dépôt et une licence à retenir.

**Le juge est le décompte à 172 px**, où la forme des chiffres tabulaires décide
de tout. Aucune autre surface du produit ne met la typographie sous cette
contrainte.

- [ ] **Étape 1 : poser la question au commanditaire, avec un spécimen construit**

Un spécimen, pas une liste de noms : un monde visuel ne se choisit pas sur une
description, et ce dépôt l'a déjà appris une fois. Le spécimen montre le
décompte à 172 px, les capitales espacées à `.22em`, et l'identifiant de
55 caractères, pour chaque fonte candidate.

- [ ] **Étape 2 : si une fonte est retenue, l'auto-héberger et la faire porter par les tokens**

Le `@font-face` vit dans `styles.css`, le fichier dans `apps/web/public/`, et la
licence dans le dépôt. `world.spec.ts` de la tâche 2 gagne une assertion : la
pile de `--font-display` nomme la fonte retenue avant toute police système.

- [ ] **Étape 3 : si aucune n'est retenue, l'écrire**

Une décision de ne pas décider est une décision, et elle se note dans
`DESIGN.md` avec sa raison. Ce qui ne se fait pas, c'est la laisser implicite :
le prochain lecteur croirait que les polices système étaient un choix.

---

## Tâche 18 : Le lotissement, et la pull request

**Fichiers :**
- Modifier : `docs/superpowers/plans/2026-09-02-lotissement.md`
- Modifier : `CLAUDE.md` si et seulement si quelque chose y est devenu faux

- [ ] **Étape 1 : relever la tranche 5 dans le lotissement**

La ligne du tableau passe à livrée, avec la date, et la section §5 gagne ce que
la tranche a appris — pas ce qu'elle a fait, que le `git log` dit déjà.

- [ ] **Étape 2 : vérifier que la tranche 8 est toujours exacte**

Quatre surfaces y sont décrites. Si l'une a bougé — la déclaration du `steamId`
de la tâche 14 en est la candidate —, la corriger là et non ailleurs.

- [ ] **Étape 3 : la vérification complète, sans cache**

```bash
npx nx run-many -t lint test build typecheck --all --skip-nx-cache
```

Attendu : SUCCÈS sur les seize projets. **Un « tout vert » venu du cache a déjà
menti dans ce dépôt** : c'est pourquoi le drapeau n'est pas optionnel.

- [ ] **Étape 4 : commit, puis la pull request**

```bash
git add docs/superpowers/plans/2026-09-02-lotissement.md
git commit -m "docs(plan): releve la tranche 5, et l'ecran que les joueurs voient"
```

Le titre de la pull request suit Conventional Commits — une fusion en squash en
fait le sujet du commit qui atterrit sur `main`.

- [ ] **Étape 5 : la fusion est un geste humain**

**Aucun agent ne fusionne.** La fusion *est* la mise en production : elle
remplace ce qu'un membre voit aujourd'hui sur `beacon.charlouze.com`. Le délai à
annoncer est d'environ vingt minutes, dont dix-sept d'attente d'un exécuteur
GitHub — mesuré à la fusion #23.

---

## Ce que ce plan ne fait pas

Écrit pour qu'aucune tâche ne le découvre en cours de route :

- **Aucune requête sur `events`.** Donc pas de cumul du mois, pas d'heures
  jouées, pas de nombre de soirées, pas de « dernière soirée fermée à ».
  Tranche 8.
- **Aucune lecture de `saves`.** Donc pas de dernière sauvegarde, ni sa date, ni
  sa taille. La règle Firestore reste fermée. Tranche 8.
- **Aucune face écriture des membres.** Un membre entre par la console, le
  premier admin comme les suivants. Tranche 8.
- **Aucun écran de réglages, aucun sélecteur de gabarit.** `instanceSize` garde
  son défaut, que la Function applique depuis `config/settings`. Tranche 8.
- **Aucun nom de monde affiché hors du point de jonction.** Il n'a de source que
  là ; l'écrire ailleurs en dur créerait une seconde vérité à côté de celle de
  `deploy/cloud-init`.
- **Aucune route, aucun `@angular/router`.** Un seul écran sert les neuf
  compositions.
- **Aucune notification hors de l'interface**, aucune restauration d'une
  ancienne sauvegarde, aucun serveur simultané. Hors périmètre v1 (§13).
