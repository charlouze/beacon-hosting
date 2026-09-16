# Lotissement de l'implémentation

Date : 2026-09-02
Statut : **validé** par le commanditaire le 2026-09-08

Ce document dit dans quel ordre le spec
[`2026-09-02-game-hosting-design.md`](../specs/2026-09-02-game-hosting-design.md)
se construit, et pourquoi cet ordre-là. Il ne remplace pas le spec, qui reste
l'autorité sur l'architecture : ici on ne décide que de l'exécution.

Chaque tranche reçoit son propre plan d'implémentation, écrit **juste avant de
l'attaquer** — pas six plans d'avance. Un plan est meilleur quand la tranche
précédente a répondu à ses questions.

Ces plans s'écrivent avec la skill `superpowers:writing-plans`, et se nomment
`docs/superpowers/plans/AAAA-MM-JJ-tranche-N-<nom>.md`. Le présent document
n'est pas un plan : c'est ce qui dit combien il y en aura et dans quel ordre.

## Pourquoi pas d'un seul bloc

Deux raisons, et la seconde est la vraie.

**La taille.** Le spec décrit un système complet — domaine, sécurité, trois
adapters fournisseur, une image conteneur, un watchdog, une interface. Un plan
unique produirait des dizaines de tâches dont les premières invalideraient les
dernières.

**Les inconnues.** Le §12 du spec liste les questions ouvertes. Un plan écrit
aujourd'hui contiendrait des tâches dont les entrées sont des suppositions : ce
n'est pas un plan, ce sont des devinettes rédigées à l'impératif.

Deux de ces inconnues peuvent déplacer l'architecture, pas seulement le code :

- si `affectedKeys().hasOnly()` ne restreint pas champ par champ, `server/current`
  se scinde en deux documents ;
- si l'API de l'hébergeur n'accepte pas de métadonnée sur l'IP flottante, toute
  la réconciliation change de mécanisme.

Les deux ont été tranchées en tranche 0, le 2026-09-03. La première tient : les
règles restreignent bien champ par champ. La seconde a coûté un hébergeur —
l'API OVH v1 ne portait de tag ni sur l'instance ni sur l'IP, et le projet est
passé à Scaleway, qui les porte nativement. Le mécanisme, lui, n'a pas changé.
C'est exactement ce que cette liste servait à éviter : découvrir en tranche 1
qu'on bâtit sur du vide.

## Les trois règles qui produisent l'ordre

Le découpage n'est pas un découpage par couche ni par confort. Il tombe de trois
règles, et c'est par elles qu'il faut le relire s'il est un jour contesté.

1. **Le faucheur avant le semeur.** Le spec dit lui-même (§3) que le composant
   le plus critique pour le budget est celui qui garantit la destruction.
   Construire d'abord ce qui crée des machines, c'est se doter d'un moyen de
   dépenser sans moyen d'arrêter.
2. **Les règles de sécurité après les écritures qu'elles filtrent.** Des règles
   écrites avant l'existence des écritures sont écrites contre une hypothèse.
   Le prix à payer est explicite : **aucun déploiement public avant la tranche 4.**
3. **Le chemin des saves avant tout monde auquel on tient.** C'est le seul
   endroit du système où un bug détruit quelque chose d'irrécupérable.

## Les tranches

La sonde du second jeu y figure pour qu'on sache qu'elle a eu lieu, mais elle
n'est pas une tranche : elle s'est intercalée entre la 1 et la 2, comme sa
section le dit plus bas. La 3 bis, elle, en est une — c'est la 3 coupée en deux,
un jeu par tranche.

| # | Tranche | Ce qu'elle livre | État |
|---|---|---|---|
| 0 | Sonder | Un serveur jouable, démarré à la main, et les réponses du §12 | livrée |
| 1 | Le faucheur | Rien ne reste allumé, quoi qu'il arrive | livrée |
| 1 bis | Sonder le second jeu | Ce qu'une machine seule pouvait dire de Sunkenland | livrée |
| 2 | Le cycle | Une session naît, se prolonge et meurt — sans interface | livrée |
| 3 | Les saves | Le monde survit aux sessions | **livrée le 2026-09-07** |
| 3 bis | Le second jeu | Sunkenland démarre, avec ses fichiers et son ServerID | **livrée le 2026-09-08** |
| 4 | La sécurité | Le système peut être exposé | **livrée le 2026-09-11** |
| 5 | L'écran | Le produit décrit dans `.impeccable/` | maquettes validées le 2026-09-11 |
| 7 | Les mondes vont et viennent | Un monde entre dans le système, et en ressort | **livrée le 2026-09-14** |
| 6 | L'infra en code | Ce qui vit longtemps se relit en revue au lieu de se redécouvrir dans une console | à venir |
| 8 | Ce que la 5 n'a pas pris | Les quatre surfaces que l'écran de session laisse en console | née des reports de la 5, le 2026-09-11 |
| 9 | Les mondes | Plusieurs mondes par jeu, chacun avec ses joueurs, plusieurs sessions le même soir — sous l'écran | implémentée, PR #40 (avec la 9 bis) |
| 9 bis | L'écran des mondes | La liste de mes mondes, le monde, l'entrée par un lien | implémentée, PR #40 (avec la 9) |

### 0 · Sonder

Créer une instance à la main par l'API de l'hébergeur, lancer les deux
conteneurs, mesurer, et répondre aux questions du §12 : ports UDP d'Enshrouded,
comportement du conteneur amont (emplacement des backups, variables,
désactivation de l'auto-update), débit réel de SteamCMD, egress Object Storage
intra-région, restriction champ par champ dans les règles, tags sur l'instance
**et** sur l'IP flottante.

Jetable, sauf le `cloud-init` et le `docker-compose`, qui restent.

**Livre déjà de la valeur** : un serveur jouable. Démarré à la main, mais
jouable.

**Sortie** : les réponses écrites dans le §12 du spec, qui cesse d'y avoir des
trous.

### 1 · Le faucheur

Watchdog, `scaleway-compute`, réconciliation par tag. Piloté par un document
Firestore édité à la main. Pas d'interface, pas d'authentification.

**`ServerHost` ouvre et ferme un serveur, pas des ressources** (§4 du spec).
L'adapter n'implémente que le disque local en v1, mais son interface ne doit pas
supposer qu'il n'y a qu'une instance et une IP à défaire : le gabarit est libre,
et un calibre à volume bloc en ajouterait une troisième. Une signature qui
énumère les ressources se réécrit le jour où le gabarit change ; une signature
qui prend le tag de la session ne bouge pas.

Il a de quoi travailler dès le premier jour : il détruit ce que la tranche 0 a
laissé traîner.

**Sortie** : plus aucune ressource Scaleway ne peut survivre à sa session, y compris
si tout le reste du système est absent.

**Trois pièces sont remontées de plus loin**, et la tranche 2 rétrécit d'autant.
La face **admin** de `libs/session-record` vient ici parce que les délais d'état
du §6 lisent et corrigent `server/current`, et que le §4 impose à cette
collection de passer par son module `*-record` ; la face client reste en
tranche 2. Les **tests de règles dans la CI** viennent ici parce que la
tranche 1 déploie des règles — fermées — et qu'un jeu de règles déployé sans sa
suite de refus n'est pas une barrière. Et le **semis de `server/current`** vient
ici parce qu'un watchdog déployé sans document à corriger n'est surveillé par
personne ; `config/settings` et le premier membre restent en tranche 4.

### 1 bis · Sonder le second jeu

Intercalée le 2026-09-05, après que Sunkenland est entré dans le périmètre et
avant que le plan de la tranche 2 s'écrive. Elle mesure ce que la section J de
la sonde n'avait pas pu mesurer sans machine : la connexion derrière un vrai
NAT, la disposition des dossiers, la cadence retenue, et l'egress objet
intra-région. Le seau des sauvegardes naît avec elle.

Elle n'ajoute pas de tranche au découpage : c'est une sonde, du même genre que
la tranche 0, et son plan est
[`2026-09-05-tranche-1-bis-sonder-le-second-jeu.md`](2026-09-05-tranche-1-bis-sonder-le-second-jeu.md).

### 2 · Le cycle

`libs/session` — `Session`, `Deadline`, `Game`, `JoinInfo` —,
`libs/session-record` et ses deux faces, `libs/ovh-dns`, le catalogue
`deploy/cloud-init/`, `ServerHost.open()`, `onServerStateChange`, et les deux
lignes d'échéance du watchdog. Un pilote Angular nu exerce la face client ; le
monde jetable est celui d'Enshrouded.

**Sans agent, et c'est une décision du 2026-09-06.** Le §6 fait constater par
l'agent que le serveur est prêt ; ici la Function conclut, comme le §4 le
permet pour ce jeu — elle connaît le point de jonction dès que l'IP est
réservée. `RUNNING` annonce donc un serveur encore en train de télécharger,
pendant cinq à huit minutes. Aucun joueur ne le voit : la règle 2 ci-dessus
interdit toute exposition avant la tranche 4, et la tranche 3 pose l'agent
avant. **`agentReport`, le jeton de session et la cadence d'une minute sont
donc en tranche 3.**

`config/settings` est semé ici et non en tranche 4 : le cycle ne tourne pas
sans durée de session ni tarif. Seul le premier `members/{uid}` reste là-bas.

**Sortie** : le cycle complet tourne de bout en bout, éprouvé une fois sur une
vraie machine.

### 3 · Les saves

`scaleway-storage`, l'image compagnon, la restauration au démarrage, la
synchronisation, les trois défenses de la règle d'or (§8 du spec) et leurs
tests dédiés.

**Et l'agent, descendu de la tranche 2** : `agentReport`, le jeton de session
haché dans `agentTokens/{sessionId}`, la cadence d'une minute, et la définition
de `RUNNING` rendue à ce que le §6 en dit — le serveur répond, et c'est le bon
monde. Le compagnon est l'endroit naturel : il est déjà sur la machine et il
sait quand la restauration est finie, ce dont la définition dépend.

**Sur un seul jeu, et c'est une décision du 2026-09-06.** Tout ce qui précède
s'éprouve sur Enshrouded, de bout en bout, jusqu'à une vraie session ; le second
jeu part en tranche 3 bis. Ce que le découpage d'origine mettait ici — l'entrée
Sunkenland du catalogue — ne partage avec le reste que le mot « restaurer » :
c'est un autre conteneur, un autre point d'entrée, une autre façon d'apprendre
que le serveur est prêt, et une autre forme de point de jonction. Les garder
ensemble aurait fait une tranche deux fois plus grosse que la 2 sans qu'aucune
de ses pièces ne serve deux fois.

**Gate ferme : aucun monde auquel on tient ne migre avant que cette tranche
soit finie et ses tests verts.** Il se lève jeu par jeu — à la fin de celle-ci
pour Enshrouded, à la fin de la 3 bis pour Sunkenland. **Les deux sont levés**,
le 2026-09-07 et le 2026-09-08.

**Livrée le 2026-09-07, et le gate est levé pour Enshrouded.** Deux sessions
consécutives sur une vraie machine : la seconde restaure la clé que la première
avait déposée, à l'octet près, et le coffre revient avec son contenu. Le relevé
est dans
[`2026-09-07-tranche-3-les-saves-session.md`](2026-09-07-tranche-3-les-saves-session.md)
et les mesures sont versées au §12 du spec. Formellement le gate se lève à la
fusion, la production étant `main`.

Deux choses de cette tranche méritent de survivre à son plan. **La méthode
d'abord** : neuf tâches de tests unitaires contre des doubles ont prouvé la
logique, et rien ne prouvait que l'artefact démarrait — le test de fumée, écrit
en dernier, a trouvé quatre défauts qui rendaient l'image inutilisable, puis la
revue de branche a trouvé l'ordre suivant du même défaut, et la première vraie
session l'ordre d'après. Chaque niveau ne voit que ce que le précédent ne
pouvait pas voir, et l'ordre dans lequel on les écrit décide de ce qu'on
découvre tard. **Et une leçon d'écriture de plan** : onze contradictions ont été
trouvées entre le code embarqué dans ce plan et ses propres tests — du code
jamais exécuté se périme entre son écriture et sa lecture. Son graphe de
dépendances omettait par ailleurs une arête que l'exécution a trouvée seule. Les
tâches ajoutées en cours de route ont été écrites avec leurs tests et leurs
contraintes, sans code d'implémentation, et c'est la forme à reprendre.

### 3 bis · Le second jeu

L'entrée Sunkenland du catalogue, l'adoption du script de démarrage que la
sonde du 2026-09-05 a écrit — avec l'`uid 7000` et le `trap` que l'image impose
—, la restauration des 2,3 Go de fichiers de jeu depuis leur seau, le ServerID
extrait par le point d'entrée monté et vérifié par son préfixe de GUID,
`SunkenlandJoinInfo`, et `tools/game-depot`.

Elle n'ajoute rien au modèle : le §4 a écrit `JoinInfo` à deux formes et le port
`ServerHost` à un jeu libre précisément pour que ce jeu-ci ne coûte qu'une
entrée de catalogue. **C'est vérifié** : hors du catalogue, le second jeu n'a
coûté qu'un champ optionnel au protocole, une branche sur un *refus* dans la
Function, et des valeurs — jamais un `if` sur un nom de jeu.

**Livrée le 2026-09-08, et le gate est levé pour Sunkenland.** Deux sessions
consécutives : la seconde restaure la `pre-shutdown` de la première, et les onze
fichiers qui font foi sont identiques à l'octet près. Un joueur est entré **par
la liste**, sans qu'aucune adresse ait jamais été annoncée. Coût réel **0,10 €**
pour les deux, sous le budget de 0,30 €. Le relevé est dans
[`2026-09-09-tranche-3-bis-session.md`](2026-09-09-tranche-3-bis-session.md) et
les mesures sont versées au §12 du spec. Formellement le gate se lève à la
fusion, la production étant `main`.

**Une phrase de cette section était fausse et l'est restée jusqu'ici** : elle
annonçait « `SunkenlandJoinInfo` **et son affichage** ». L'affichage n'est pas
ici — le domaine ne transporte vers le navigateur qu'un `hasJoinInfo` booléen,
le champ lui-même est réservé, et le lire demanderait à `libs/session-record` un
travail qui est celui de l'écran. Décision du 2026-09-08 : la forme est produite
en 3 bis, elle s'affiche en tranche 5, et c'est là que « ajouter un jeu ajoute
une forme » se paiera pour de bon.

**Ce que la tranche 3 lui laissait, et qui est fait :** la sonde connaît une
seconde forme, `catalogFor` ne lève plus, le compagnon restaure deux sources, la
règle de cycle de vie est posée sur `saves/sunkenland/auto/`, et
**`beacon-stop.path` a enfin été observé après avoir tiré** — le drapeau vit
exactement 2 s, l'unité n'est jamais `failed`, et le jeu s'arrête en 1 s, ce qui
valide le `trap` amont.

**Ce qu'elle laisse à son tour :**

- **L'egress objet intra-région reste ouvert.** La restauration a bien tiré
  2,3 Go, mais la facture n'a pas encore été lue.
- **`-adminSteamIDs` est nourri par une constante du catalogue.** La tranche 4
  apporte `members` et son `steamId`, et reprendra cette valeur. Mesuré au
  passage : un admin **peut** déclencher une sauvegarde depuis la console, ce qui
  est le seul moyen d'en provoquer une sur ce jeu.
- **La fermeture d'une soirée coûte trois minutes de machine de plus** que sur
  l'autre jeu, mesuré deux fois : la sonde qui lit un fichier ne redevient jamais
  fausse, donc la fenêtre de grâce est épuisée en entier.
- **L'import/export de monde n'a pas de domicile.** Le geste d'amorçage vit dans
  `deploy/scaleway/bootstrap-world.ps1` ; il ne peut pas rejoindre `game-depot`,
  que le §4 tient délibérément aveugle au préfixe des sauvegardes. La tranche 5,
  qui apporte l'écran, en est le domicile naturel.
- **La charge à plusieurs joueurs n'est toujours pas mesurée**, et le décalage de
  version Photon reste une déduction — qui se combine mal avec une mise à jour
  manuelle : une archive non rafraîchie produit une panne que rien ne
  diagnostique.

### 4 · La sécurité

Firebase Auth, `members/{uid}` avec le rôle en base lu par `get()` dans les
règles, `libs/membership-record` qui en est la seule porte côté navigateur,
`firestore.rules` et leur suite de tests de refus — d'écriture **et de
lecture**. Le premier admin, lui, entre par la console une fois le système
déployé : son `uid` Google n'existe pas avant (§5, §10).

**Gate levé le 2026-09-11.** Il se lève à la fusion, et pas autrement : la
production *est* `main`, donc la pull request qui ferme la tranche est le geste
qui expose le système. `beacon.charlouze.com` sert l'application depuis, un
membre s'y connecte, et ce que les règles refusent a été mesuré — le relevé est
dans [`2026-09-11-tranche-4-session.md`](2026-09-11-tranche-4-session.md).

Ce que la tranche a laissé derrière elle et qui commande la 5 : la face
écriture de `libs/membership-record` n'existe pas — ni liste, ni ajout, ni
retrait, ni changement de rôle —, donc **un membre entre par la console**, le
premier admin comme les suivants. Et le pilote est laid, et il est en ligne :
la tranche 5 a maintenant un vrai utilisateur à servir.

### 5 · L'écran

Le monde visuel retenu — The Departure Board, voir
[`.impeccable/mocks/decision/README.md`](../../../.impeccable/mocks/decision/README.md)
— les états sur un seul écran, le décompte, l'affichage du coût, et la
libération pendant le démarrage. **Pas « les quatre minutes »** : la durée n'a
jamais été mesurée, l'estimation précédait le changement d'hébergeur, et le
brief de surface la retire — la contrainte porte sur le comportement, pas sur le
nombre.

**Neuf compositions, et non cinq**, tranchées au tour de maquettes du
2026-09-11 dont la trace est
[`.impeccable/mocks/states/README.md`](../../../.impeccable/mocks/states/README.md).
Le §8 du spec distingue deux choses que le mot « panne » confondait : un
démarrage refusé rend `IDLE` avec `lastError` et un bouton immédiatement
recliquable, là où `FAILED` veut dire qu'une machine est restée debout et
facture — et que le membre n'a rien à y faire. S'y ajoutent la forme
« adresse + IP brute + port » du premier jeu, que les fichiers conservés du tour
de décision ne montraient nulle part, l'écran déconnecté, et le visiteur non
membre.

**Deux pièces de plomberie, et pas une de plus.** La vue en lecture seule de
`ServerFacts` sur la face client de `libs/session-record` — `ip`, `joinInfo`,
`lastError` —, que le §4 promet déjà et dont le client ne calcule aujourd'hui
qu'un `hasJoinInfo` booléen ; et le second composant de point de jonction, que
`join-info.component.ts` se donne en rendez-vous. Tout le reste existe depuis
les tranches 2 à 4.

**La copie de l'interface passe en anglais**, décidé le 2026-09-11 :
`CLAUDE.md` et `PRODUCT.md` l'exigeaient tous les deux, et les maquettes de
décision avaient été jugées en français. Conséquence qui ne se voit pas dans une
maquette : **tout terme visible doit entrer au glossaire du §4 du spec.**

**Quatre reports, qui font la tranche 8.** Ils sont ce qui garde cette tranche
livrable, et ils retirent de l'écran approuvé le pied de cumuls, la ligne de
dernière soirée, la dernière sauvegarde et le nom du monde. Le pied ne porte
plus que le coût de la session.

### 6 · L'infra en code

**Recadrée le 2026-09-15, et sur les deux axes à la fois.** Ce qui suit remplace
« sept ressources en Terraform, pour un énoncé relisible ». La cible et le
mécanisme ont changé ; ce que la sonde a mesuré, non.

**La cible est un compte reconstructible.** Beacon se réinstalle sur un compte
vide par une suite de gestes écrits, en un temps connu. Pas pour changer de
compte — il n'y en a qu'un, et le §10 en fait une décision — mais parce que
c'est le seul énoncé qui se vérifie. Un fichier qui décrit un compte déjà
conforme ne prouve rien ; le même fichier sur un compte vide prouve tout. C'est
d'ailleurs ce que la sonde disait déjà sans le nommer : le seul verdict qu'elle
tenait pour valable était un `plan` vide sur le compte réel.

**Le mécanisme est `tools/deploy-setup` étendu, et non Terraform.** L'outil
existe depuis la tranche 4 : il lit ce qui existe, calcule l'écart avec ce qui
est déclaré, l'imprime sous `--check`, demande, puis le comble — un `plan` et un
`apply` qui ne disent pas leur nom, en TypeScript et testés. La tranche 6 telle
qu'elle était écrite aurait introduit une **seconde** mécanique déclarative à
côté, sans que personne voie le doublon.

Trois raisons, dans cet ordre :

- **Le §8 survit sans garde-fou ajouté.** Un outil sans état n'a pas de notion
  de « remplacer » : il n'existe aucun chemin par lequel un changement de nom
  emporte `beacon-saves` et les mondes dedans. Terraform en avait un, et sa
  contrepartie était un `prevent_destroy` posé en condition d'entrée — c'est-à-dire
  une garde à ne jamais oublier, sur la seule donnée irremplaçable du système.
  La frontière retenue est au §14 du spec : l'outil **déclare le contenant,
  jamais le contenu**.
- **Le savoir reste dans la langue où il a été payé.**
  `tools/deploy-setup/src/lib/wanted.ts` est le fichier le plus cher du dépôt à
  redécouvrir : que `firebase deploy` interroge l'API des extensions avant de
  rien publier et qu'aucun rôle étroit ne le permette, qu'activer
  `compute.googleapis.com` soit *ce qui crée* le compte par défaut que trois
  liaisons nomment. Ça se transpose ; ça ne se réinvente pas.
- **Un outil sans état ne se dispute pas avec le watchdog**, parce qu'il ne
  croit rien détenir.

Ce que ça coûte, et il faut le savoir : on ne détecte pas ce qui existe **en
trop**, seulement ce qui diverge sur un attribut déclaré. Pour un compte d'une
vingtaine de ressources connues, c'est le bon marché — et c'est exactement le
défaut qui a mordu en tranche 3, qu'une comparaison d'attribut déclaré attrape :
`beacon-saves` était versionné sans que personne l'ait décidé, une règle
d'expiration n'y supprimait donc rien, et seule une relecture depuis le seau l'a
montré.

**Elle passe en dernier parce qu'elle ne débloque rien**, et ça n'a pas changé.
Aucun joueur ne la voit, aucun gate n'en dépend, et elle est la seule tranche du
découpage dont l'absence ne coûte que de la vigilance.

#### Ce que la sonde a mesuré, et qui tient toujours

Section F de [`probe/RESULTS.md`](../../../probe/RESULTS.md), le 2026-09-08,
sans toucher au compte. Le mécanisme a changé, pas les faits :

- **Le DNS sort du périmètre**, et pour une raison qui ne dépend d'aucun outil :
  l'IP de l'enregistrement est réécrite à chaque session, donc seule son
  *existence* se déclare — c'est elle qui manquait le jour du `http 404`. Le §14
  du spec le dérive maintenant de la frontière au lieu de le constater.
- **Le login DynHost reste dehors.** L'adopter demanderait de le détruire et de
  le recréer, donc d'en changer le mot de passe et de faire perdre sa mise à
  jour DNS à la session en cours.
- **La règle d'expiration est un attribut du seau**, pas une ressource séparée.
  Avec un outil sans état c'est une simple pose de document — `create` remplace
  la configuration entière, et [`deploy/scaleway/`](../../../deploy/scaleway/README.md)
  porte déjà les deux JSON qui en tiennent lieu.

**Deux questions de la sonde n'ont plus d'objet.** « Terraform ou OpenTofu » :
ni l'un ni l'autre. « Importer ou détruire pour recréer » : ni l'un ni l'autre
non plus — sans état, il n'y a rien à importer, et rien n'a besoin d'être
détruit. Toute la controverse du nuke s'éteint avec la prémisse qui la portait.

Elle se serait éteinte de toute façon : **la tranche 7 a rendu le monde
portable.** `world-depot retrieve` le rend sur la machine d'un administrateur et
`adopt` le redépose, GUID compris. Ce qui rendait `beacon-saves` intouchable
depuis le 2026-09-08 — un monde ne se retélécharge pas — a cessé d'être vrai le
2026-09-14, et par un outil écrit pour une autre raison.

#### La frontière avec `firebase deploy`, qui ne bouge pas

`apps/web`, les règles, les index, les Functions et le job Scheduler qu'emporte
`onSchedule` restent à la CLI, déployés par la fusion dans `main`. **La CLI
livre l'app, l'outil déclare le compte.** Ce qui rend la seconde moitié
nécessaire est l'alerte Cloud Monitoring du watchdog : la CLI ne la pose pas,
elle est née d'un clic de console en tranche 1, et le §6 en fait le seul
garde-fou du composant le plus critique pour le budget.

**Ce que cette tranche ne revendique jamais** : l'instance et l'IP flottante,
qui appartiennent au watchdog et se réconcilient par tag ; les règles, les
index, les Functions, le Hosting et le job Scheduler, que `firebase deploy`
déploie. Deux outils sur le même objet est une guerre d'états.

#### Les sous-lots

**6a — la carte.** *Livrée le 2026-09-15.* Le §14 du spec, la table des huit
mécanismes dans [`deploy/README.md`](../../../deploy/README.md), et la ligne de
`CLAUDE.md` qui les ressort au bon moment. Aucun code. Elle se tient seule : sans
elle, une session future rouvre cette section et écrit du Terraform.

**6b — le compte visé cesse d'être une constante.**
`tools/deploy-setup/src/lib/wanted.ts` code en dur le numéro du projet, dont
`agentBindings()` compose trois membres parce que seul le numéro est accepté
dans un `principalSet`. Sur un projet neuf, l'outil configure donc l'ancien.
C'est la condition pour que 6d veuille dire quelque chose.

**6c — le compte Scaleway et OVH entre dans l'outil.** Les deux seaux et leurs
politiques, la clé S3, l'alerte de budget, l'alerte Cloud Monitoring et son
canal, l'enregistrement A en existence seulement. Les deux JSON de
`deploy/scaleway/` cessent d'être posés à la main. Les ports existent déjà —
`libs/scaleway-storage`, `libs/ovh-dns` —, et l'outil ne les atteint que pour
leur configuration, jamais pour leurs objets (§14).

**6d — la répétition.** Un compte neuf, la suite de gestes, chronométrée, et ce
qu'elle fait tomber. C'est le seul lot qui prouve quelque chose, et il est
**entièrement un geste humain** : les commandes s'écrivent ici, un humain les
lance.

### 7 · Les mondes vont et viennent

**Proposée le 2026-09-08, pas encore acceptée.** Un administrateur dépose dans le
système un monde qui vient d'ailleurs, et récupère celui qui y est. Le système
sait aujourd'hui faire naître un monde et le faire survivre à ses sessions ; il
ne sait ni en adopter un, ni en rendre un.

`tools/game-depot` donne la forme : un geste d'administrateur, depuis sa machine,
vers un seau — pas une surface d'interface, pas un rôle de plus dans les règles.
Ce qui change est la nature de ce qu'on dépose. Les fichiers d'un jeu se
retéléchargent ; un monde, non.

**Et c'est la seule opération du système qui écrase.** Le §8 pose que rien dans
le dépôt n'efface une sauvegarde, et le port `SaveStore` n'expose ni suppression
ni élagage. Déposer un monde par-dessus un autre contourne cette propriété sans
la contredire : personne n'efface, mais la clé précédente cesse d'être celle
qu'on restaure. Ce que le §8 devient alors se décide dans le spec, pas dans un
plan — c'est la première chose à faire si cette tranche est acceptée.

**Acceptée le 2026-09-11, et placée avant la 6** — ce qui renverse ce que cette
section disait jusque-là. L'argument était que la 6 repose sur un nuke gratuit
tant que les seaux ne portent rien, et que cette tranche-ci est l'événement qui
y met fin. Il est caduc : le monde d'amorçage de Sunkenland est dans
`beacon-saves` depuis le 2026-09-08, déposé par la tranche 3 bis. L'import que
cet argument voulait éviter est déjà dû, quel que soit l'ordre.

Ce qui reste vrai, et qui compte davantage : cette tranche est **la seule
opération du système qui écrase**, et ce que le §8 devient alors se décide dans
le spec avant qu'un plan s'écrive.

### 8 · Ce que la 5 n'a pas pris

**Née le 2026-09-11, en cadrant la tranche 5.** Quatre surfaces que l'écran de
session laisse en console, reportées ensemble et pour la même raison : chacune
demandait une face de lecture ou d'écriture qui n'existe pas, et les quatre
réunies auraient fait de la 5 deux tranches déguisées en une.

| Ce qui manque | Ce qu'il faut pour l'avoir | Ce que ça coûte de ne pas l'avoir |
|---|---|---|
| **La face écriture des membres** — lister, inviter, retirer, changer le rôle | Quatre méthodes sur `ClientMembershipRecord` et un écran. **Les règles de la tranche 4 l'autorisent déjà** : `adminEnrols`, `adminManagesMembership`, `allow delete: if isAdmin()`, et un admin peut lister | Tout membre entre par la console Firebase, le premier admin comme les suivants |
| **Les réglages** `config/settings` et le **choix du gabarit** | Un écran d'admin, et `instanceSize` que `ownsEveryTouchedField` réserve déjà à l'admin | Durée de session, pas de prolongation, fenêtre et tarifs se changent en console. Le gabarit garde son défaut |
| **Les cumuls sur `events`** — le mois, les heures jouées, le nombre de soirées, la dernière soirée fermée | Une face de lecture par requête sur `events`, que tout membre est déjà autorisé à lire (§5), et que le §11 prévoit | **`PRODUCT.md` annonce « le coût estimé de la session en cours et le cumul du mois »** : c'est une capacité produit annoncée qui n'est pas livrée, et non un chiffre de maquette en moins |
| **La lecture des `saves`** — la dernière sauvegarde, sa date et sa taille | Une règle de lecture pour les membres et une face de lecture. Le §5 l'a prévu textuellement : « à ouvrir aux membres le jour où l'interface les montrera » | La seule ligne de l'écran qui rassurait sur ce que le produit protège vraiment n'existe pas |

**Elle ne débloque rien, et c'est pourquoi elle attend.** Aucun joueur n'en est
empêché de jouer : le §2 veut que n'importe qui démarre, prolonge et arrête, et
c'est vrai sans une seule de ces quatre surfaces. Ce qu'elle coûte est de la
manœuvre en console pour une seule personne, et un écart assumé entre ce que
`PRODUCT.md` annonce et ce que l'écran montre.

**L'ordre à l'intérieur n'est pas indifférent.** Les cumuls sont les seuls à
figurer dans la comp approuvée du tour de décision — ils ont été dessinés, jugés,
puis retirés ; les trois autres n'ont jamais eu de maquette. Un tour de
maquettes est donc dû pour les surfaces d'administration, pas pour le pied de
cumuls, qui se relit dans
[`.impeccable/mocks/decision/desktop.html`](../../../.impeccable/mocks/decision/desktop.html)
tel qu'il avait été approuvé.

### 9 · Les mondes

**Née le 2026-09-15, d'une phrase du commanditaire** : plusieurs groupes d'amis jouent au même jeu,
sans partager leur monde, et voudront jouer le même soir. Le spec a été révisé le jour même, avant
qu'une ligne de plan s'écrive — c'est la règle de la tranche 0, et elle a tenu : le jeu tenait lieu
de monde partout, et « un seul serveur à la fois » était la seule ligne du §13 qui décrivait une
limite du modèle plutôt qu'un choix.

**Deux plans, une fusion.** Le premier,
[`2026-09-15-tranche-9-les-mondes.md`](2026-09-15-tranche-9-les-mondes.md), fait tout ce qui est
sous l'écran : le monde entre dans le domaine, `server/current` descend sous lui, la clé de
sauvegarde change, les règles, les Functions, la machine et l'outil suivent. Le second — la 9 bis,
l'écran des mondes — s'écrit **après** un tour de maquettes sous `impeccable`, parce que l'écran
gagne des routes et trois surfaces que personne n'a dessinées, et que `PRODUCT.md` se régénère au
même tour.

**Le gate est ferme, et il est nouveau dans sa forme** : la 9 ne se fusionne pas sans la 9 bis. La
fusion est la mise en production (§10), et la 9 retire `server/current` de la racine, que l'écran
d'aujourd'hui lit. Fusionnée seule, elle laisserait un produit déployé dont l'écran ne lit plus
rien. Les deux plans s'exécutent sur une branche, et partent ensemble.

**Ce que la migration demande, et qui n'est pas dans un plan** : rendre les deux mondes réels avant
la fusion, les adopter vers leur slug après, effacer l'ancien document, remplacer la règle
d'élagage, créer un enregistrement DNS par monde Enshrouded. Le plan de la 9 les liste dans
l'ordre, en fin de document ; ce sont des gestes humains, et le CLAUDE.md dit pourquoi.

**Elle passe devant la 6 et la 8**, pour la raison qui a fait passer la 7 devant la 6 : ce que le
commanditaire attend pour jouer prime sur ce qui rend le compte reconstructible, et la 8 dessine des
surfaces d'administration qui se dessinent mieux une fois que l'écran connaît les mondes.

### 9 bis · L'écran des mondes

**Née avec la 9, écrite après le tour de maquettes du 2026-09-15.** Son plan est
[`2026-09-15-tranche-9-bis-l-ecran-des-mondes.md`](2026-09-15-tranche-9-bis-l-ecran-des-mondes.md).
La liste de mes mondes, chacun avec son état et son décompte s'il tourne ; le monde, qui est l'écran
d'aujourd'hui sous `/worlds/{worldId}`, plus le nom modifiable sur place, le lien d'invitation à
copier ou régénérer, et « quitter ce monde », tous confirmés sur place ; et `/join/{worldId}/{code}`,
qui entre tout de suite puis redirige — rouvrir son propre lien ne fait rien et réussit. Un membre
sans monde voit la liste vide, avec la phrase qui dit de demander un lien. **Le cumul du mois n'y
est pas** : le tour de maquettes a tranché que la face client ne lit pas `events`, et qu'il arrive
avec la tranche 8, pas ici.

Livrée : `apps/web` gagne son routeur, jamais utilisé jusque-là — trois routes, trois conteneurs
humbles, des pages pures qui ne connaissent aucun `*-record`. `App` cède ses connexions Firebase à
`Records`, racine de composition du navigateur. Consomme ce que la 9 laisse prêt : la face client de
`libs/session-record` avec ses onze opérations, testée contre les règles, et un monde de
développement dans `mise run dev`.

**Reste, avant la fusion :** la soirée contre l'émulateur, humaine (tâche 12 du plan) — la dernière
vérification que rien n'y manque qu'un test ne peut pas voir.

## La livraison ne fait pas de tranche

Le §10 du spec (livraison, CI, semis, tags d'images) ne s'implémente pas d'un
bloc non plus, et ne mérite pas de tranche à lui : chaque morceau naît dans
celle qui en a besoin.

| Morceau du §10 | Naît en |
|---|---|
| CI de pull request — lint, tests unitaires, build | 1 |
| Tests de règles dans la CI | 1 |
| Semis de `server/current` | 1 |
| Semis de `config/settings` | 2 |
| Workflow de déploiement | 4 |
| Workflow de construction du compagnon vers ghcr.io, tag immuable, test de fumée | 3 |
| Tag immuable sur l'image amont dans le `cloud-init` | 0 |

**Cette ligne-là a coûté quelque chose, et ce n'est plus le cas depuis le
2026-09-11.** Le §10 pose que « le déploiement se fait à la fusion dans `main` »
et que « `main` est donc toujours égal à ce qui tourne ». Ce n'était pas vrai
jusqu'à la tranche 4 : le seul workflow du dépôt était celui des pull requests,
et ce qui tournait en production y avait été mis par un humain lançant
`firebase deploy` depuis son poste — la tranche 1 le fait faire explicitement,
pour les règles et les index. **`main` pouvait donc différer de la production
sans que rien ne le signale.**

C'était une conséquence assumée du découpage, pas un oubli : les règles n'avaient
personne à filtrer avant la tranche 4, et un workflow qui aurait déployé des
règles fermées n'aurait rien prouvé.

**La tranche 4 l'a fait cesser**, et le paragraphe est corrigé plutôt que
supprimé : une session qui lirait le §10 sans savoir que l'écart a existé ne
comprendrait pas pourquoi les tranches 1 à 3 bis ont un relevé qui parle de
déploiements manuels. Depuis la fusion qui a levé le gate, ce qui tourne porte
la référence du commit déployé dans `config/settings.rulesVersion`, et un onglet
resté ouvert se recharge quand elle bouge (§4).

## Ce qui reste ouvert

- La typographie définitive, le rouge de signalisation, et la ligne « prêt vers
  20:18 » qui annonce une prédiction que la tranche 0 permettra enfin de fonder.
  Voir le dossier de surface dans `.impeccable/surfaces/`.
- Si **une sonde** invalide une hypothèse d'architecture, le spec est corrigé
  **avant** d'écrire le plan de la tranche suivante. Écrite pour la tranche 0,
  la règle vaut pour toute sonde : la tranche 1 bis en est la deuxième
  démonstration, et elle s'est intercalée exactement pour ça.
- **Les ressources qui ne sont pas dans le dépôt** — *cette question est close
  depuis le 2026-09-08 : c'est la tranche 6, et ce qui suit est l'histoire qui
  l'a produite.* Le seau et ses règles de cycle de vie, la clé S3 et sa
  politique, l'alerte de budget, l'alerte Cloud Monitoring, l'enregistrement A et
  son identifiant DynHost : tout cela naît d'un geste de console, tranche après
  tranche, et rien ne dit ce qui existe. **À terme, ces ressources se décrivent
  en code** — Scaleway et GCP ont chacun leur fournisseur —, et la question n'est
  pas de savoir si c'est souhaitable mais quand ça vaut le détour.

  **Le fournisseur n'a finalement pas été la réponse**, tranché le 2026-09-15 :
  c'est `tools/deploy-setup` qui les prend, sans état et sans verbe de
  destruction. La question de la ligne ci-dessus reste posée telle quelle — elle
  est l'histoire, et elle a produit la bonne tranche pour la mauvaise raison.

  Cette liste portait aussi **le job Scheduler**, et c'était faux :
  `apps/functions/src/main.ts` le déclare en `onSchedule`, donc `firebase deploy`
  le crée. Il n'a jamais été un geste de console.

  Deux choses le rendent moins urgent qu'il n'y paraît : il n'y a qu'un seul
  environnement, donc rien à reproduire, et le watchdog rend déjà la seule
  ressource qui coûte de l'argent — l'instance — entièrement éphémère et gérée
  par du code. Ce qui reste à la main est ce qui vit longtemps et change
  rarement. La bascule se paiera le jour où l'un de ces gestes sera fait de
  travers sans que personne ne s'en aperçoive, et le candidat le plus probable
  est une règle de cycle de vie sur les sauvegardes.

  **C'est arrivé une tranche plus tard, et exactement là.** Le seau des
  sauvegardes était versionné, ce que personne n'avait décidé ; sur un seau
  versionné une règle d'expiration ne supprime rien et facture la version
  précédente indéfiniment. La règle paraissait juste à la relecture, et seule
  une relecture depuis le seau l'a montrée. Un premier pas a été fait sans
  attendre la bascule : la politique du seau des fichiers de jeu et cette règle
  de cycle de vie vivent maintenant dans
  [`deploy/scaleway/`](../../../deploy/scaleway/README.md), avec les commandes
  qui les posent et les relisent. Ce ne sont pas des ressources gérées en code —
  rien ne les applique —, mais elles se relisent en revue au lieu de se
  redécouvrir dans une console.

  **Le détour a été chiffré le 2026-09-08**, sans toucher au compte : section F
  de [`probe/RESULTS.md`](../../../probe/RESULTS.md). Il vaut moins large qu'on
  ne le croyait — le DNS dynamique en sort, parce que sa valeur est réécrite à
  chaque session — et il coûte une garde qui n'existait pas : un `prevent_destroy`
  sur le seau des sauvegardes, obligatoire dès qu'un monde auquel on tient y
  entre, sa règle d'élagage étant un bloc interne du seau.

  **Cette garde a disparu avec l'outil qui la réclamait.** Le mécanisme retenu
  le 2026-09-15 est sans état et n'a aucun verbe de destruction : il n'y a plus
  de chemin par lequel le seau se ferait remplacer, donc plus rien à protéger.
  C'est le §14 du spec qui porte maintenant cette propriété.

- **L'alerte du watchdog devient payante, et c'est la propriété qui est touchée,
  pas le budget.** Google facturera l'alerting le **1er septembre 2027 au plus
  tôt**, 0,35 $ par mois et par référence de métrique, avec un préavis annoncé à
  90 puis 30 jours. Pour l'alerte du watchdog, une trentaine de centimes par
  mois : négligeable en argent.

  **Ce qui ne l'est pas, c'est que ce coût soit fixe.** Tout le produit tient sur
  « on ne paie que quand on joue », et le §11 pose la ligne du plan de contrôle à
  0 €. Un mois sans partie cesserait de coûter zéro. C'est le seul endroit du
  système où une facture courrait sans qu'on ait joué.

  **La sortie est écrite dans le même document** : les alertes fondées sur une
  métrique de disponibilité ne sont pas facturées, jamais. Le §6 ne demande qu'une
  chose — savoir que le watchdog tourne encore — et `health/watchdog` sait déjà
  dire depuis quand il ne tourne plus. Un contrôle de disponibilité qui lirait cet
  état rendrait la surveillance gratuite. C'est une piste, pas une mesure : le
  coût propre des contrôles reste à vérifier, et la tranche 1 a déjà appris qu'une
  métrique documentée peut ne pas exister. Le détail est en section F de
  [`probe/RESULTS.md`](../../../probe/RESULTS.md), avec ce que les alertes sur les
  logs laissent d'ambigu.

  Rien à décider avant que le préavis arrive.

  Deux endroits mentent déjà par anticipation et devront bouger : la **section D**
  de [`probe/RESULTS.md`](../../../probe/RESULTS.md), qui donne l'alerting gratuit
  sans réserve, et le **§11** du spec. La mesure, elle, est en section F.

- **Éprouver un outil d'administration contre un seau demande un harnais qui
  n'existe pas.** La tranche 7 livre `tools/world-depot`, dont les deux gestes
  ne se prouvent qu'en parlant à un seau : aucun test unitaire ne dit si les
  identifiants se lisent, si le transfert aboutit, ni si ce qui revient est ce
  qui est parti. La vérification a donc été faite à la main le 2026-09-14 — un
  conteneur MinIO, une configuration rclone jetable, un monde de test — et tout
  a tenu, aller-retour à l'octet près.

  **Ce qui mérite d'être consigné est ce que ce montage a coûté à trouver**, et
  qui se reperdra sinon. L'isolation ne passe pas par le nom du seau :
  `BEACON_SAVES_BUCKET` ne change que lui, tandis que l'endpoint, la région et
  la clé viennent tous du remote rclone `scw-admin`. Pointer la variable sur un
  seau local tout en laissant la vraie configuration en place **signe une
  écriture vers Scaleway** dans un seau portant le nom du local. Le seul levier
  qui isole vraiment est `RCLONE_CONFIG`, qui fait lire à l'outil une
  configuration ne contenant que MinIO. Seconde trouvaille du même ordre :
  Scaleway étant adressé en virtual-hosted style (`forcePathStyle: false`,
  parce que c'est ce que la production parle), un MinIO local n'est joignable
  depuis l'hôte que si `<seau>.<domaine>` résout — d'où `MINIO_DOMAIN` posé sur
  un domaine à DNS joker.

  **La moitié du harnais existe déjà** : le test de fumée du compagnon monte son
  propre MinIO dans `deploy/companion/smoke/`, avec le même problème d'adressage
  résolu autrement — par des alias de réseau Docker, ce qui ne sert que les
  conteneurs et pas un outil lancé depuis l'hôte.

  Le geste se répétera à chaque tranche qui touche au seau, et la règle du dépôt
  est qu'un geste récurrent devient un outil testé plutôt qu'une recette
  transmise de mémoire. Ça n'est pas une tranche : c'est une cible Nx à écrire
  le jour où une tranche a de nouveau besoin du seau, et le bon moment pour la
  payer est celui-là, pas avant.

- **`deploy/cloud-init` s'appelle mal : c'est le catalogue des jeux.** Son nom
  désigne une sortie de rendu, alors que le projet porte tout ce que Beacon sait
  d'un jeu — l'image et son digest, le port mesuré, la cadence d'autosauvegarde,
  comment la disponibilité s'observe, comment le point de jonction se construit,
  et depuis la tranche 7 à quoi ressemble un monde sur le disque.

  Le dépôt le sait déjà partout ailleurs : son tag Nx est `scope:catalog`, et les
  contraintes de frontières d'`eslint.config.mjs` parlent du « catalogue », pas
  du cloud-init. Le nom du projet est le seul endroit qui dit autre chose.

  Ce que ça coûte se voit à la lecture : qui cherche « où est décrit ce que Beacon
  sait de Sunkenland » n'ouvre pas `deploy/cloud-init`. La question s'est posée
  telle quelle le 2026-09-14, en revue d'une garde ajoutée à `worldLayoutRefusal`.

  Le renommage — `deploy/catalog`, paquet `@beacon/catalog` — est mécanique mais
  traverse le dépôt : imports d'`apps/functions` et de `tools/world-depot`,
  tsconfig, cibles Nx, et les renvois de ce lotissement. `nx move` fait le gros
  et le reste se relit. À payer le jour où une tranche ouvre déjà ce projet en
  grand, pas pour lui-même : un renommage seul produit un diff large qui ne dit
  rien, et masquerait le changement suivant dans sa revue.
