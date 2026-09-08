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
| 3 bis | Le second jeu | Sunkenland démarre, avec ses fichiers et son ServerID | à venir |
| 4 | La sécurité | Le système peut être exposé | à venir |
| 5 | L'écran | Le produit décrit dans `.impeccable/` | à venir |
| 6 | L'infra en code | Ce qui vit longtemps se relit en revue au lieu de se redécouvrir dans une console | à venir |

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
lu dans la sortie du conteneur et vérifié par son préfixe de GUID,
`SunkenlandJoinInfo` et son affichage, et `tools/game-depot`.

Elle n'ajoute rien au modèle : le §4 a écrit `JoinInfo` à deux formes et le port
`ServerHost` à un jeu libre précisément pour que ce jeu-ci ne coûte qu'une
entrée de catalogue. C'est ce que cette tranche vérifie.

**Ce que la tranche 3 lui laisse nommément**, au-delà de son propre périmètre :

- **La sonde de disponibilité ne connaît que `a2s://`.** `probeFor` refuse tout
  le reste en nommant ce qu'elle a reçu ; la 3 bis ajoute la forme qui lit le
  ServerID dans la sortie du conteneur, et le §6 dit déjà pourquoi ce n'est pas
  un pis-aller.
- **`catalogFor('sunkenland')` lève toujours**, et son message nomme encore la
  tranche 3 : il devra désigner celle qui l'implémente.
- **Le compagnon ne restaure pas de fichiers de jeu.** `beacon-games` existe, sa
  politique de lecture seule est posée et mesurée, et le compagnon lit déjà le
  nom du seau ; rien d'autre n'est écrit — ni clé d'objet, ni chemin de
  restauration.
- **La règle de cycle de vie de ce jeu n'est pas posée**, sur
  `saves/sunkenland/auto/` et rien d'autre : les sauvegardes de fin de session
  n'expirent jamais (§5, §8). Le préfixe est littéral, donc aucun test ne
  réclamera cette ligne et personne ne verra qu'elle manque — les poussées
  automatiques d'un second jeu s'accumuleraient sans fin. Le fichier à modifier
  est [`deploy/scaleway/beacon-saves-lifecycle.json`](../../../deploy/scaleway/beacon-saves-lifecycle.json).
- **L'egress objet intra-région**, ouvert depuis la tranche 0, se mesure enfin
  ici : c'est la première tranche dont la restauration tire 2,3 Go plutôt que
  72 Ko.
- **`beacon-stop.path` après avoir tiré.** L'unité est vue armée et vue
  fonctionner ; l'état qu'elle laisse une fois déclenchée n'a pas été observé,
  la machine ayant été détruite avant. À interroger **entre** l'arrêt du jeu et
  la destruction, une fenêtre de quelques dizaines de secondes qu'il faut viser
  exprès.

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

### 6 · L'infra en code

Les ressources du compte qui vivent longtemps cessent de n'exister que dans une
console : les deux seaux avec leur versionnement, leur politique et leur règle
d'élagage, la clé IAM, l'alerte de budget Scaleway, l'alerte Cloud Monitoring et
son canal, et l'enregistrement A **en existence seulement**. Sept ressources, pas
une de plus.

**Elle passe en dernier parce qu'elle ne débloque rien.** Aucun joueur ne la
voit, aucun gate n'en dépend, et elle est la seule tranche du découpage dont
l'absence ne coûte que de la vigilance. Ce qu'elle rapporte n'est pas de
l'automatisation — sans identifiant d'hébergeur dans la CI (`STACK.md`), c'est
un humain qui lancera `apply` depuis son poste — mais **un énoncé relisible en
revue et une dérive détectable par un `plan`**, qui ne touche rien.

C'est très exactement le défaut qui a mordu en tranche 3 : `beacon-saves` était
versionné sans que personne l'ait décidé, une règle d'expiration n'y supprimait
donc rien, et seule une relecture depuis le seau l'a montré.

**Sondée en avance de phase le 2026-09-08**, section F de
[`probe/RESULTS.md`](../../../probe/RESULTS.md). Trois de ses réponses valent
d'être connues avant d'écrire le plan :

- **Le DNS sort du périmètre.** Terraform y déclarerait l'IP que la Function
  réécrit à chaque session : dérive permanente, et un `apply` qui repointe le
  sous-domaine vers une session morte pendant qu'une autre tourne. Seule
  l'*existence* de l'enregistrement se déclare — c'est elle qui manquait le jour
  du `http 404` —, et le login DynHost ne s'importe pas du tout.
- **On ne réimporte rien : tout se détruit et se recrée.** Décidé le 2026-09-08 —
  rien dans les seaux ne vaut d'être gardé, le monde du 2026-09-07 était un monde
  d'épreuve. Ça règle le seul trou de la sonde, le login DynHost ne s'important
  pas, et ça supprime le critère délicat : sur un compte vide, l'`apply` produit
  ce que le fichier dit. En échange, **l'état porte désormais la clé S3 et le mot
  de passe DynHost** — son seau se verrouille, et reste hors Terraform faute de
  pouvoir se contenir lui-même.
- **Le seau porte sa règle d'expiration en bloc interne**, faute de ressource
  séparée : adopter `beacon-saves` met dans le dépôt, pour la première fois, un
  outil capable d'effacer une sauvegarde, là où le §8 dit que rien ici n'en est
  capable. `prevent_destroy` ne protège rien le jour du nuke, et redevient
  obligatoire dès qu'un monde auquel on tient entre dans le seau.

**Cette tranche a une date de péremption**, et c'est ce qui la lie à la 7. Le
nuke n'est gratuit que tant que les seaux ne portent rien. Si le vrai monde
arrive avant elle, `beacon-saves` repasse en import — lui seul, avec son critère
de `plan` vide et tout ce que la sonde en dit.

**La frontière avec la CLI, et pourquoi elle est là.**
`google_firebase_hosting_version` ne supporte pas les fichiers statiques :
`apps/web` ne se déploie pas en Terraform. La CLI reste donc, et tant qu'elle
reste, autant qu'elle garde tout ce qu'elle sait déjà faire — règles, index,
Functions, et le job Scheduler qui vient avec. **La CLI livre l'app, Terraform
déclare le compte.** Ce qui rend la seconde moitié nécessaire est l'alerte Cloud
Monitoring du watchdog : la CLI ne la pose pas, elle est née d'un clic de console
en tranche 1, et le §6 en fait le seul garde-fou du composant le plus critique
pour le budget.

**Ce que cette tranche ne revendique jamais** : l'instance et l'IP flottante,
qui appartiennent au watchdog et se réconcilient par tag ; les règles, les
index, les Functions, le Hosting et le job Scheduler, que `firebase deploy`
déploie. Deux outils sur le même objet est une guerre d'états.

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

**Et il faut dire ce que cette ligne-là coûte, parce qu'elle ne se voit pas.**
Le §10 pose que « le déploiement se fait à la fusion dans `main` » et que
« `main` est donc toujours égal à ce qui tourne ». **Ce n'est pas vrai
aujourd'hui, et ça ne le sera pas avant la tranche 4.** Le seul workflow du
dépôt est celui des pull requests ; ce qui tourne en production y a été mis par
un humain lançant `firebase deploy` depuis son poste — la tranche 1 le fait
faire explicitement, pour les règles et les index.

C'est une conséquence assumée du découpage, pas un oubli : les règles n'ont
personne à filtrer avant la tranche 4, et un workflow qui déploierait des règles
fermées ne prouverait rien. Mais **jusque-là, `main` peut différer de la
production sans que rien ne le signale**, et une session qui lirait le §10 sans
ce paragraphe croirait le contraire.

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
