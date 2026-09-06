# Lotissement de l'implémentation

Date : 2026-09-02
Statut : **proposé**, non validé par le commanditaire

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

La sonde du second jeu n'y figure pas : elle est intercalée entre la 1 et la 2 et
n'ajoute pas de tranche, comme sa section le dit plus bas. La 3 bis, elle, en est
une — c'est la 3 coupée en deux, un jeu par tranche.

| # | Tranche | Ce qu'elle livre |
|---|---|---|
| 0 | Sonder | Un serveur jouable, démarré à la main, et les réponses du §12 |
| 1 | Le faucheur | Rien ne reste allumé, quoi qu'il arrive |
| 2 | Le cycle | Une session naît, se prolonge et meurt — sans interface |
| 3 | Les saves | Le monde survit aux sessions |
| 3 bis | Le second jeu | Sunkenland démarre, avec ses fichiers et son ServerID |
| 4 | La sécurité | Le système peut être exposé |
| 5 | L'écran | Le produit décrit dans `.impeccable/` |

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
pour Enshrouded, à la fin de la 3 bis pour Sunkenland, dont le monde reste dans
le seau jusque-là.

### 3 bis · Le second jeu

L'entrée Sunkenland du catalogue, l'adoption du script de démarrage que la
sonde du 2026-09-05 a écrit — avec l'`uid 7000` et le `trap` que l'image impose
—, la restauration des 2,3 Go de fichiers de jeu depuis leur seau, le ServerID
lu dans la sortie du conteneur et vérifié par son préfixe de GUID,
`SunkenlandJoinInfo` et son affichage, et `tools/game-depot`.

Elle n'ajoute rien au modèle : le §4 a écrit `JoinInfo` à deux formes et le port
`ServerHost` à un jeu libre précisément pour que ce jeu-ci ne coûte qu'une
entrée de catalogue. C'est ce que cette tranche vérifie.

### 4 · La sécurité

Firebase Auth, `members/{uid}` avec le rôle en base lu par `get()` dans les
règles, `libs/membership-record` qui en est la seule porte côté navigateur, le
semis du premier admin, `firestore.rules` et leur suite de tests de refus —
d'écriture **et de lecture**.

**Gate ferme : rien n'est déployé publiquement avant cette tranche.**

### 5 · L'écran

Le monde visuel retenu — The Departure Board, voir
[`.impeccable/mocks/decision/README.md`](../../../.impeccable/mocks/decision/README.md)
— les cinq états sur un seul écran, le décompte, l'affichage du coût, et la
libération pendant les quatre minutes de démarrage.

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
| Workflow de déploiement, et semis du premier membre | 4 |
| Workflow de construction du compagnon vers ghcr.io, tag immuable, test de fumée | 3 |
| Tag immuable sur l'image amont dans le `cloud-init` | 0 |

## Ce qui reste ouvert

- La typographie définitive, le rouge de signalisation, et la ligne « prêt vers
  20:18 » qui annonce une prédiction que la tranche 0 permettra enfin de fonder.
  Voir le dossier de surface dans `.impeccable/surfaces/`.
- Si **une sonde** invalide une hypothèse d'architecture, le spec est corrigé
  **avant** d'écrire le plan de la tranche suivante. Écrite pour la tranche 0,
  la règle vaut pour toute sonde : la tranche 1 bis en est la deuxième
  démonstration, et elle s'est intercalée exactement pour ça.
