---
status: open
---

# 04 — Aucun serveur de jeu ne naît d'une copie du jeu en retard

## Scope

Une mise en place commence par une vérification préalable, avant qu'aucun
serveur de jeu soit créé, et l'écran la montre avant les quatre étapes.

La vérification préalable d'une session dont le jeu passe par une copie échoue
quand cette copie manque ou n'est pas à la version que l'éditeur du jeu publie,
ou quand le système ne peut pas lire cette version. La mise en place est alors
abandonnée, et l'écran dit pourquoi.

Avant l'ouverture, l'écran d'un monde dit que son jeu attend que sa copie soit
remplacée, d'après la dernière version que le système a lue chez l'éditeur, et
n'offre pas d'ouvrir.

Une session qu'on ferme pendant sa vérification préalable cesse d'être en
cours dès que celle-ci se termine, sans serveur de jeu, et sa mise en place
n'est pas abandonnée.

L'outil de dépôt enregistre la version de la copie qu'il dépose. Il refuse de
déposer une installation dont il ne peut pas lire la version, ou quand il ne
peut pas l'enregistrer, et `update` exige désormais que l'exploitant nomme le
projet Firebase.

L'outil de dépôt amène lui-même l'installation locale à la version que
l'éditeur publie, puis la dépose. Quand la version installée est déjà celle de
la copie enregistrée, il le dit et demande à l'exploitant s'il dépose quand
même. Il propose les jeux du catalogue qui passent par une copie.

Le lot prend en charge trois entrées de `docs/specs/session.gaps.md`, réservées
à son nom :

- **Violations**, `The life of a session` : une session peut passer de en
  préparation à en fermeture, transition que le diagramme ne porte pas. Le
  produit veut ce geste : le lot corrige la spec, qui le permet pendant toute
  la mise en place.

- **Gaps**, `Running a game` : rien ne compare ce qui est déposé à ce que
  l'éditeur publie, ni à l'installation locale depuis laquelle le dépôt se
  fait.
- **Gaps**, `Running a game` : le geste de rafraîchissement imprime la commande
  exacte à lancer quand il ne trouve pas l'installation locale.

Aucun bloc ne décrit l'outil de dépôt. La clôture récrit les deux entrées
de la catégorie Gaps pour dire ce qu'il fait désormais, sans les retirer du registre.

Le lot ne promet aucun délai entre une publication de l'éditeur et le moment où
l'écran d'un monde la reflète.

Le lot n'ajoute aucune alerte, et ne touche pas `infrastructure`.

Le lot ne vérifie rien pour un jeu qui ne passe pas par une copie : sa
vérification préalable réussit toujours.

Le lot ne ferme pas une session en cours quand l'éditeur de son jeu publie une
version.

Le lot ajoute quatre termes au glossaire de `session` et y corrige cinq
définitions que la vérification préalable rend fausses : la session, l'étape,
hors service, en préparation et en fermeture.

Le lot ne renomme ni l'outil `game-depot` ni ce que les ADR appellent le dépôt
des jeux : un dépôt est le geste qui dépose une copie.

## Spec delta

### D1 — `docs/specs/session.md`, `Ubiquitous language`

```diff
-| session | `Session` | une partie ouverte sur un monde, en cours de son ouverture à la disparition de son serveur |
+| session | `Session` | une partie ouverte sur un monde, en cours de son ouverture à la disparition de son serveur ou, quand aucun serveur n'a été créé, à la fin de sa mise en place |
 | serveur de jeu | `HostedServer` | ce qu'une session fait naître chez l'hébergeur, qui fait tourner le jeu et qu'on rejoint |
 | heure de fermeture | `Deadline`, affiché `Closes at` | l'instant auquel une session se ferme |
 | ouvrir une session | `opening` | la faire naître sur un monde |
 | prolonger | `extend` | repousser l'heure de fermeture d'une session |
 | fermer | `requestStop` | demander qu'une session se ferme avant son heure de fermeture |
 | durée d'une session | `sessionDurationMs` | ce qui sépare l'ouverture d'une session de sa première heure de fermeture |
 | pas de prolongation | `extensionStepMs` | ce dont une prolongation repousse l'heure de fermeture |
 | fenêtre de prolongation | `extensionWindowMs` | le temps, avant l'heure de fermeture, pendant lequel prolonger est possible |
 | gabarit | `InstanceSize` | le calibre du serveur de jeu |
 | réglages | `SessionSettings` | la durée d'une session, le pas et la fenêtre de prolongation, et le gabarit |
 | jeu | `Game` | un jeu que Beacon sait faire tourner, désigné par son identité |
+| version d'un jeu | `GameVersion` | ce qui identifie une publication d'un jeu par son éditeur |
+| copie du jeu | `GameCopy` | les fichiers d'un jeu, à l'une de ses versions, que Beacon garde pour ses serveurs de jeu |
+| copie en retard | `behind` | une copie du jeu qui manque, ou qui n'est pas à la version que l'éditeur du jeu publie |
 | point de jonction | `JoinInfo`, affiché `How to join` | les moyens de rejoindre le serveur d'une session |
 | fourchette de disponibilité | `readyWindow`, affiché `Ready between` | les deux heures entre lesquelles le serveur devrait devenir joignable |
 | mise en place | `setup` | ce qu'une session traverse entre son ouverture et son passage en service |
-| étape | `SetupStep` | l'une des quatre parties d'une mise en place |
+| vérification préalable | `preflight` | ce que le système vérifie d'une session avant de créer son serveur de jeu |
+| étape | `SetupStep` | l'une des quatre parties d'une mise en place qui suivent sa vérification préalable |
 | activité | `SetupActivity` | ce qu'un serveur de jeu fait à l'intérieur d'une étape |
 | avancement | `SetupProgress` | la part déjà faite de l'activité en cours, ou de l'étape quand elle n'en a pas, en pourcentage |
 | réponse de l'hébergeur | `lastError`, affiché `What the host said` | ce que l'hébergeur a répondu au dernier échec |
-| hors service | `IDLE`, affiché `Out of service` | le monde n'a aucun serveur de jeu |
-| en préparation | `PROVISIONING`, affiché `Preparing` | le serveur se met en place |
+| hors service | `IDLE`, affiché `Out of service` | le monde n'a aucune session en cours |
+| en préparation | `PROVISIONING`, affiché `Preparing` | la session se met en place |
 | en service | `RUNNING`, affiché `In service` | on peut rejoindre le monde dans le jeu |
-| en fermeture | `STOPPING`, affiché `Closing` | la session a commencé à se fermer, et son serveur n'a pas encore disparu |
+| en fermeture | `STOPPING`, affiché `Closing` | la session a commencé à se fermer, et n'a pas encore cessé d'être en cours |
```

### D2 — `docs/specs/session.md`, `Opening a session`

```diff
+Une mise en place commence par une vérification préalable, avant qu'aucun
+serveur de jeu soit créé.
+
 Une mise en place qui aboutit traverse quatre étapes : le serveur se réveille,
 le jeu est installé, le monde est restauré, le jeu démarre. Le réveil du
-serveur commence à l'ouverture de la session et le démarrage du jeu vient en
-dernier ; l'ordre des deux autres dépend du jeu de la session.
+serveur commence quand la vérification préalable a réussi et le démarrage du
+jeu vient en dernier ; l'ordre des deux autres dépend du jeu de la session.
 
 Pendant la mise en place, l'écran affiche l'étape en cours, son rang sur quatre
 et l'heure à laquelle cette étape a commencé.
+
+Exception : pendant la vérification préalable, l'écran affiche qu'elle est en
+cours, et aucune étape.
```

### D3 — `docs/specs/session.md`, `Opening a session`

```diff
 Une mise en place est abandonnée dès que le serveur de jeu déclare qu'il ne
 peut pas la finir.
 
+Une mise en place est abandonnée dès que sa vérification préalable échoue,
+sauf celle d'une session qu'on a fermée pendant cette vérification.
+
+La vérification préalable d'une session dont le jeu passe par une copie
+n'échoue que dans deux cas : quand cette copie est en retard, et quand le
+système ne peut pas lire la version que l'éditeur du jeu publie.
+
+La vérification préalable d'une session dont le jeu ne passe pas par une copie
+réussit.
+
 Après l'abandon d'une mise en place, et jusqu'à l'ouverture suivante d'une
 session sur le même monde, l'écran affiche l'étape à laquelle elle s'est
 arrêtée et l'heure de l'abandon.
+
+Exception : après une mise en place abandonnée à sa vérification préalable,
+l'écran affiche, à la place de l'étape, la vérification préalable et celui de
+ses deux cas d'échec qui s'est produit.
```

### D4 — `docs/specs/session.md`, `Opening a session`

```diff
 Qui ouvre une session sur un monde qui en a déjà une en cours apprend qu'elle
 existe.
 
+Quand la copie d'un jeu était en retard la dernière fois que le système a lu
+la version que l'éditeur de ce jeu publie, et qu'elle n'a pas été remplacée
+depuis, l'écran d'un monde hors service de ce jeu dit, à la place d'offrir
+d'ouvrir une session, que le jeu attend que sa copie soit remplacée.
+
 Le nombre de mondes qui tournent en même temps n'a aucun plafond.
```

### D5 — `docs/specs/session.md`, `Closing a session`

```diff
 Une session dont l'heure de fermeture est passée se ferme sans que personne ait
 à agir.
 
+Une session qu'on ferme pendant sa vérification préalable cesse d'être en
+cours dès que celle-ci se termine : sa mise en place s'arrête là, et aucun
+serveur de jeu n'est créé pour elle.
+
 Une fermeture qui n'aboutit pas est forcée.
```

### D6 — `docs/specs/session.md`, `Opening a session`

```diff
 Une mise en place qui n'aboutit pas est abandonnée.
 
+Exception : la mise en place d'une session qu'on ferme pendant sa vérification
+préalable n'est pas abandonnée, quelle que soit l'issue de cette vérification.
+
 Une mise en place est abandonnée dès que le serveur de jeu déclare qu'il ne
```

### D7 — `docs/specs/session.md`, `The life of a session`

```diff
     RUNNING --> STOPPING : on la ferme, ou son heure de fermeture passe
+    PROVISIONING --> STOPPING : on la ferme
     STOPPING --> IDLE : le serveur a disparu
+    STOPPING --> IDLE : la vérification préalable est terminée, et aucun serveur n'a été créé
     PROVISIONING --> IDLE : la mise en place a échoué, mais rien ne subsiste
```

## Technical design

### Ce qui est mesuré

`probe/RESULTS.md`, section E, porte les relevés du 2026-10-11, du 2026-10-13
et du 2026-10-14. Le design repose sur eux :

- Steam rend le build public d'une application à une session anonyme, sans le
  binaire `steamcmd`, par la bibliothèque `steam-user`, y compris pour une
  application que le compte anonyme ne peut pas télécharger ;
- la lecture prend 0,6 à 1,8 s connexion comprise, depuis un poste et depuis
  Cloud Shell ;
- l'API web officielle de Steam refuse l'application d'un serveur dédié ;
- une installation faite par `steamcmd +force_install_dir` porte son manifeste
  en `<installation>/steamapps/appmanifest_<application>.acf`, dans le dossier
  que `game-depot` archive, et son `buildid` est celui que Steam publie ;
- `steamcmd` sort sur le code `5` quand Steam refuse sa connexion, et sur le
  code `0` quand un `app_update validate` trouve l'installation à jour. Il se
  connecte alors par le jeton du poste, sans rien demander, et se met à jour
  lui-même au premier lancement ;
- le serveur dédié pèse 8,69 Gio au build `25746735`, et non plus les 2,3 Gio
  relevés au début du projet.

`api.steamcmd.net` rend le même build, plus vite. Il n'est pas retenu, même en
recours : une version illisible abandonne la mise en place, et un service tiers
deviendrait le point de panne de tout le jeu.

### Le domaine

`libs/session` reçoit trois valeurs :

- `GameVersion`, opaque, que deux publications ne partagent pas. Une seule
  fonction la construit depuis ce qu'une plateforme rend, et refuse ce qui
  n'est pas une suite de chiffres. L'adapter et l'outil de dépôt passent tous
  deux par elle, et un test l'épingle : ils sont deux à produire la valeur
  qu'une égalité compare ;
- `GameCopy`, la version d'une copie et l'heure de son dernier dépôt ;
- la dernière lecture chez l'éditeur, une version et son heure.

Trois fonctions pures portent les règles :

- une copie est en retard sur une version publiée quand sa version manque ou
  diffère. Elle ne compare que l'égalité : une copie en avance sur l'éditeur
  est en retard comme une autre ;
- un jeu attend que sa copie soit remplacée quand une lecture existe, que la
  copie est en retard sur elle, et que le dernier dépôt, s'il y en a un, la
  précède. Il l'attend aussi quand la dernière mise en place du monde a été
  abandonnée pour une copie en retard et que ni un dépôt ni une lecture
  enregistrée ne suit cet abandon : la lecture que la Function a faite compte,
  même quand son enregistrement a échoué ;
- la vérification préalable d'un jeu réussit quand il ne passe pas par une
  copie, échoue pour une version illisible quand la lecture chez l'éditeur n'a
  rien rendu, échoue pour une copie en retard selon la première fonction, et
  réussit sinon.

La Function applique la troisième à tout jeu, et ne lit rien pour un jeu qui
ne passe pas par une copie. L'écran applique la deuxième à ce que
l'enregistrement de la copie garde et à la marque d'abandon du monde.

`libs/session` déclare le port par lequel le contexte demande la version que
l'éditeur d'un jeu publie. Il parle d'un jeu et d'une version, jamais d'une
application ni d'un build.

La mise en place gagne la vérification préalable, hors de `SETUP_STEPS`. Rien
ne la garde : une session en préparation dont aucune étape n'est gardée est en
vérification préalable, depuis son ouverture. `shownSetup` rend aujourd'hui la
première étape dans ce cas ; il rend désormais la vérification préalable, et
`ShownSetup` devient soit elle, soit une étape. Il en va de même après un
abandon : sans étape gardée pour la session abandonnée, la mise en place s'est
arrêtée à la vérification préalable, avec ou sans cause. `setupStepRank` et
l'écran de préparation, qui lisent l'étape et son rang, changent avec lui.
`SetupStepOrder` et ce qu'un serveur de jeu déclare ne changent pas.

Un échec de la vérification préalable porte une cause parmi une liste fermée,
qui en compte deux : copie en retard, version illisible. La marque d'une mise
en place abandonnée la porte quand il y en a une. `AbandonedSetup`,
`StateCorrection.abandonedSetup`, que la surveillance produit aussi,
`ServerStateStore.apply`, `abandonedSetupFrom` et `stoppedAt` changent avec
elle.

### Ce que chaque jeu apporte

L'entrée de catalogue d'un jeu dit s'il passe par une copie et, si oui, quelle
application Steam son éditeur publie. Le champ est propre à Steam, et le dit.
Sans lui, la vérification préalable réussit sans rien lire. Un test l'épingle
pour chaque jeu du catalogue.

`tools/game-depot` importe ce champ du catalogue, comme `world-depot` importe
déjà `catalogFor`, et cesse de nommer l'application lui-même.

L'entrée de catalogue d'un jeu qui passe par une copie dit aussi l'exécutable
que son installation doit porter : c'est celui que `sunkenland.ts` garde
aujourd'hui pour le lancer, qui devient public. `tools/game-depot` l'importe et
contrôle chaque dossier avec celui du jeu qu'il dépose. Le commentaire de
`sunkenland.ts` qui le dit recopié, et le test de `game-depot` qui épingle sa
valeur, disparaissent.

L'adapter ne dépend que du domaine et ne lit pas le catalogue : la racine de
composition de `apps/functions` lui donne la correspondance entre un jeu et son
application.

Le code dit déjà, de deux autres façons, qu'un jeu passe par une copie :
l'ordre de ses étapes et la clé de son archive. Le lot ne les réunit pas.

### La lecture chez l'éditeur

Une nouvelle bibliothèque, créée par `nx g`, implémente le port avec
`steam-user` : une session anonyme par lecture, `getProductInfo`, le `buildid`
de la branche `public`, puis déconnexion. Le modèle de Steam s'arrête là : ce
qui en sort est une `GameVersion`.

Une lecture qui ne répond pas en dix secondes, qui échoue, ou qui rend une
application sans branche `public` est une version illisible. Le port rend alors
une version illisible avec sa cause, un texte que seul le journal de la
plateforme lit, sans rejeter. Chaque appelant écrit cette cause au journal
sous sa propre source, une nouvelle pour la mise en place et une autre pour le
rafraîchissement, jamais sur une surface qu'un membre lit.

Le client est créé sans dossier de données ni reconnexion automatique, et
garde un écouteur d'erreur jusqu'à sa déconnexion : une erreur tardive, après
le délai, ne doit pas faire tomber l'instance.

`steam-user` lit un fichier à son chargement. Il reste hors du bundle de
`apps/functions`, et l'adapter ne le charge qu'à la première lecture : un
chargement qui échoue rend une version illisible, et ne touche ni la
surveillance ni le rapport des serveurs de jeu, qui partagent ce bundle.

### L'enregistrement de la copie

Un document par jeu, `gameCopies/{game}`, dans `libs/session-record` : la
version déposée et l'heure du dépôt, la version lue chez l'éditeur et l'heure
de la lecture. Tout utilisateur le lit, comme `completedSetups/{game}`, et
aucun client ne l'écrit. Les versions sont
publiques : le document ne porte rien d'autre.

Les Functions et l'outil de dépôt l'écrivent par le SDK d'administration,
chacun ses champs, par fusion : aucun n'efface ce que l'autre a posé. Les deux
heures sont celles du serveur Firestore, pour que leur ordre ne dépende pas de
l'horloge d'un poste.

### L'outil de dépôt

`pushGameFiles` lit le `buildid` du manifeste dans le dossier qu'il archive,
et enregistre la version lui-même, une fois son dépôt relu : c'est lui qui
sait quand le dépôt est vérifié. Il reçoit pour cela un port d'enregistrement,
que `update` et `push` lui donnent.

Avant de construire l'archive, il refuse un dossier sans manifeste ou dont le
manifeste dit l'installation incomplète, et vérifie que l'enregistrement est
joignable. Le parcours guidé fait ces deux vérifications avant de poser sa
question à l'exploitant.

Une interruption entre le dépôt et l'enregistrement laisse l'ancienne version
sur une archive neuve : la vérification préalable échoue à tort, et relancer
l'outil le corrige, au prix d'un second envoi. L'inverse, une version neuve sur
une archive ancienne, n'a pas de chemin.

L'outil écrit avec l'identité que `gcloud auth application-default login` a
laissée sur le poste. `adminFirestore`, que `world-depot` porte aujourd'hui,
sort dans une bibliothèque que les deux outils importent : un outil n'en
importe pas un autre. `update` exige désormais `BEACON_FIREBASE_PROJECT`, sans
valeur par défaut, et cesse de se lancer sans rien exporter.

L'outil ne gagne aucun verbe qui supprime, et n'écrit que la version déposée et
l'heure du dépôt.

### La récupération du jeu

`update` lance lui-même `steamcmd` avant de déposer. `push`, le dépôt scripté,
ne le lance pas.

Le parcours guidé suit cet ordre :

1. la clé d'administration, comme aujourd'hui ;
2. `steamcmd`, cherché dans le `PATH` sans le lancer, puisqu'un lancement
   déclenche sa mise à jour. Absent, l'outil s'arrête ;
3. le terminal : sans terminal pour répondre, l'outil s'arrête avant de lancer
   `steamcmd`, qui demanderait mot de passe et Steam Guard à personne ;
4. le jeu, par `--game` ou par une question parmi les jeux du catalogue dont
   `copySteamApp` n'est pas nul. Avec un seul jeu, l'outil l'annonce sans
   poser la question. Un `--game` qui nomme un jeu sans copie est refusé, avec
   la raison. L'en-tête qui nomme le jeu s'imprime après ce choix ;
5. le dossier : l'installation trouvée dans les bibliothèques Steam, ou
   `steamapps/common/beacon-<jeu>` dans la première bibliothèque quand il n'y en
   a aucune, un nom qu'aucun client Steam ne prend. Le compte Steam est connu à
   cette étape : sans compte trouvé ni `--steam-account`, l'outil s'arrête.
   Sinon, avant de lancer `steamcmd`, il dit quel compte il prend et, quand il
   l'a trouvé plutôt que reçu, ce que vaut ce choix. `sayAccountConfidence`,
   que seul `sayHowToInstall` appelle aujourd'hui, est déplacée là, ses textes
   cessent de renvoyer à une commande imprimée, et ses tests la suivent.
   L'outil lit la version de la copie déposée avant le téléchargement ;
6. `steamcmd +force_install_dir <dossier> +login <compte> +app_update
   <application> +quit`, dans le terminal de l'exploitant, sans `validate`. Un
   code de sortie non nul arrête tout, rien n'est déposé, et l'outil sort en
   échec ;
7. le manifeste, qui doit dire l'installation complète, et sa version, puis
   l'exécutable du jeu dans le dossier. Le parcours les contrôle ici pour
   refuser avant de poser sa question, et `pushGameFiles` les contrôle de
   nouveau pour `push`.
   Quand elle est celle de la copie déposée, l'outil le dit et demande s'il
   dépose quand même, non par défaut. Sinon, il pose la question du dépôt comme
   aujourd'hui ;
8. le dépôt, la relecture et l'enregistrement, comme aujourd'hui.

Le parcours guidé gagne trois ports : savoir si un terminal peut répondre ;
choisir parmi plusieurs jeux ; `steamcmd`, qui dit s'il est présent et lance
une installation. Le port `steamcmd` cherche dans le `PATH` un `steamcmd.exe`,
seul fichier que `spawn` lance sans shell, le garde pour lui et le lance avec
ce même fichier. Il
reçoit le dossier, le compte et l'application, et rend un code de sortie. Un
lancement qui échoue sans code de sortie rend un échec. `update.ts`
l'implémente par `spawn`, sans shell, sur le terminal de l'exploitant.

Le port construit ses arguments par la fonction qui construit aujourd'hui la
commande imprimée, dans `steam-install.ts`. Elle rend désormais un tableau, où
le dossier est un seul argument sans guillemets. Ses tests restent :
`+force_install_dir` avant `+login`, aucun mot de passe, et désormais aucun
`validate`. Celui des guillemets devient celui d'un dossier à espaces passé en
un seul argument. L'outil n'imprime plus de commande à copier.
`sayHowToInstall`, la question qui attend la fin de `steamcmd`, l'issue
`not-installed` et le compte de remplacement `<your-steam-account>`
disparaissent. Le texte du refus de `installedVersion`, le commentaire des
codes de sortie de `update.ts`, le README de l'outil et les tests qui épinglent
la commande imprimée changent avec eux.

Le port d'enregistrement gagne la lecture de la version déposée, qui remplace
`reach` : une lecture qui aboutit prouve que l'enregistrement répond.

L'outil trouve une installation par le manifeste de son application,
`steamapps/appmanifest_<application>.acf` dans un dossier de `steamapps/common`,
et contrôle l'exécutable à l'étape 7. La garde de `update.ts` qui ne connaît
que sunkenland disparaît, ainsi que l'exécutable et le nom de dossier que
`game-depot` écrit aujourd'hui en dur.

Le seuil de poids qui reconnaissait le client de jeu disparaît avec son
avertissement : le manifeste reconnaît l'application, et le serveur a dépassé
le seuil.

Le compte Steam reste celui que `--steam-account` nomme, ou celui que le client
Steam du poste désigne.

### La vérification préalable

`provision` vérifie après la revendication de la session, et avant de garder la
première étape, d'émettre le jeton, d'ouvrir le registre de provisionnement et
d'appeler l'hébergeur.

Pour un jeu qui passe par une copie, la Function lit la version publiée par le
port, l'enregistre avec son heure, lit la version déposée, puis applique la
fonction de la vérification préalable de `libs/session`. L'enregistrement de
la version lue n'arrête rien s'il échoue : sa cause va au journal de la
plateforme.

Que la vérification réussisse, échoue ou finisse sur un refus ordinaire, chaque
écriture d'état qui la suit est conditionnelle : une transaction relit la
session et n'écrit que si elle est toujours celle-ci et dans l'état que
l'écriture attend. Une condition qui ne tient pas arrête la Function.

Quand la vérification réussit, la Function garde la première étape, à l'heure
où la vérification a réussi, par une écriture conditionnelle à une session
toujours en préparation. Cette écriture termine la vérification préalable.
Quand elle n'a pas lieu, la Function n'appelle pas l'hébergeur. Sinon elle
continue comme aujourd'hui.

Quand la Function trouve la session en fermeture, un membre l'a fermée pendant
la vérification : elle la remet hors service, sans marque d'abandon ni erreur,
avec l'événement `SessionStopped` à coût nul. Cette transition est une méthode
de l'agrégat `Session`, à côté de `requestStop`, et sa décision s'écrit comme
une `StateCorrection`.

Une session fermée avant que la Function l'ait revendiquée est remise hors
service de la même façon : la Function réagit à une session qui passe en
fermeture sans revendication ni étape gardée.

La surveillance rattrape, par le délai de fermeture, une session en fermeture
que la Function n'a pas remise hors service. Quand aucune étape n'est gardée
pour elle, aucun serveur n'a été demandé : la surveillance la remet hors
service sans fermer chez l'hébergeur, sans erreur, avec `SessionStopped` à coût
nul.

La remise hors service d'une session fermée et l'abandon à la vérification
préalable passent par `ServerStateStore.apply` avec `clearFacts`, rendu
conditionnel à l'état attendu : il efface ce que la revendication a posé, pour
que l'ouverture suivante puisse revendiquer. `abandonSetup` et la surveillance
gardent leur écriture actuelle.

Quand elle échoue, la Function ramène la session hors service avec la marque
d'abandon et sa cause, et l'événement `ProvisioningFailed` au journal des
sessions. Elle ne passe pas par `abandonSetup`, qui commence par fermer chez
l'hébergeur et peut laisser la session bloquée : rien n'a été créé, il n'y a
rien à fermer ni à facturer.

Une erreur qui n'est aucun des deux cas, comme une lecture de
`gameCopies/{game}` qui échoue, est un refus ordinaire : elle suit le chemin
d'abandon qui existe, et `lastError` en garde le détail expurgé.

L'invariant « aucun serveur de jeu ne naît d'une copie en retard » tient dans
la Function : immédiat, et incontournable, puisqu'elle seule détient les
identifiants de l'hébergeur.

La durée d'une mise en place aboutie court toujours depuis l'ouverture de la
session : la vérification préalable y entre, pour une à deux secondes.

### Le rafraîchissement de la version lue

Une Function planifiée à part, toutes les heures, relit la version publiée de
chaque jeu qui passe par une copie et l'enregistre. Une lecture qui échoue
n'écrit rien et va au journal de la plateforme.

Elle ne loge pas dans la surveillance, qui garde ce qui meurt avec une session
et dont une passe ne doit pas dépendre d'un appel à Steam.

La Function de mise en place et celle-ci partagent une seule opération, lire
puis enregistrer, qui rend ce qu'elle a lu.

### L'écran

L'écran de préparation affiche la vérification préalable tant qu'aucune étape
n'est gardée pour la session, puis les quatre étapes comme aujourd'hui. La
fourchette de disponibilité s'annonce dès la vérification préalable : elle
court depuis l'ouverture.

L'écran hors service lit le document du jeu de son monde et demande à
`libs/session` si le jeu attend que sa copie soit remplacée.

- Il l'attend : l'écran le dit, à la place du bouton d'ouverture. Tout dépôt
  rend le bouton, et la lecture suivante tranche de nouveau.
- Il ne l'attend pas, ou le document manque ou ne se lit pas : le bouton reste,
  et la vérification préalable tranche.
- Après un abandon à la vérification préalable : l'écran dit que la mise en
  place s'y est arrêtée, à quelle heure, et pour laquelle des deux causes quand
  la marque en porte une.
- Après un abandon dû à une copie en retard, le jeu attend aussi que sa copie
  soit remplacée : l'écran dit les deux, et n'offre pas de réessayer.

Pendant la vérification préalable, l'écran de préparation ne dit pas que la
première heure est due quand on ferme : aucun serveur n'existe encore.

Ce que l'écran retient est contournable : un navigateur peut ouvrir une session
malgré une copie en retard. La Function le rattrape à la vérification
préalable.

Les mots et la forme de ces états passent par `impeccable` et par une
maquette, dans la story qui les livre.

### Les tests

- `libs/session` : la construction d'une `GameVersion` ; une copie en retard,
  pour deux versions égales, différentes, et une version déposée absente ; la
  vérification préalable pour un jeu sans copie, une lecture qui n'a rien
  rendu, une copie en retard et une copie à jour ;
  l'attente d'un remplacement, pour une lecture après le dépôt, avant lui, sans
  dépôt, et sans lecture, puis après un abandon pour une copie en retard, suivi
  ou non d'un dépôt ; la remise hors service d'une session fermée pendant la
  vérification préalable, avec `SessionStopped` à coût nul ; `shownSetup` sans étape gardée, et avec une marque
  d'abandon qui porte une cause ou n'en porte pas.
- L'adapter : un client `steam-user` simulé qui répond, échoue, ne répond pas
  dans le délai, émet une erreur après le délai, rend une application sans
  branche `public` ; un chargement de la bibliothèque qui échoue.
- `provision`, contre l'émulateur : un jeu qui ne passe pas par une copie
  n'appelle jamais le port ; une copie à jour ouvre ; une copie en retard, une version déposée
  absente et une lecture qui échoue abandonnent chacune sans aucun appel à
  l'hébergeur, sans jeton ni entrée au registre de provisionnement ; une
  session fermée pendant une vérification qui réussit, qui échoue, puis qui
  finit sur un refus ordinaire, revient hors service sans marque ni erreur,
  avec `SessionStopped`, et n'ouvre rien ; une session fermée avant la
  revendication revient hors service de la même façon ; une fermeture entre
  la fin de la lecture et la première étape gardée fait refuser cette écriture,
  et l'hébergeur n'est jamais appelé ; une écriture d'abandon ne remplace pas
  une fermeture ; une ouverture revendique après un abandon à la vérification
  préalable comme après une fermeture pendant celle-ci ; un enregistrement de
  la version lue qui échoue laisse la vérification trancher ;
  une lecture de `gameCopies/{game}` qui échoue suit le refus ordinaire.
- La surveillance : une session en fermeture sans étape gardée, au délai de
  fermeture, revient hors service sans appel à l'hébergeur, sans erreur, avec
  `SessionStopped` à coût nul ; une session en fermeture avec une étape gardée
  suit le rattrapage d'aujourd'hui.
- Le rafraîchissement : un jeu qui ne passe pas par une copie n'est pas lu, une
  lecture qui réussit est enregistrée, une lecture qui échoue n'écrit rien.
- L'outil : le manifeste lu, absent, incomplet ; l'enregistrement injoignable
  refusé avant l'archive ; la version enregistrée après la relecture du dépôt,
  et pas quand la relecture échoue.
- La récupération du jeu, par des ports simulés : `steamcmd` qui rend `0` et un
  manifeste qui passe au nouveau build, puis le dépôt ; `steamcmd` qui rend `5`,
  et rien de déposé ; `steamcmd` absent du `PATH`, et l'arrêt avant
  l'enregistrement et le téléchargement ; aucun lancement sans terminal ; la
  version installée égale à celle de la copie, la question, et rien de déposé
  sur un non ; un `--game` sans copie refusé ; aucun compte trouvé, et l'arrêt
  avant `steamcmd` ; l'installation trouvée par son manifeste, et un client de
  jeu installé à côté qui n'est pas pris pour elle ; un dossier sans
  l'exécutable que le catalogue donne pour ce jeu refusé, par `update` comme
  par `push`.
- Les règles : un utilisateur lit `gameCopies/{game}`, un visiteur non, aucun
  client n'écrit.
- L'écran : la vérification préalable en cours, l'abandon avec chacune des
  deux causes et sans cause, l'attente d'un remplacement seule et après un
  abandon, par des tests de composant.
- Le bundle construit de `apps/functions` se charge dans l'émulateur avec
  l'adapter câblé, et l'adapter y charge `steam-user` depuis les dépendances
  que le bundle déclare. Aucune cible ne le fait aujourd'hui : la story qui
  livre l'adapter l'ajoute.

Aucun test n'atteint Steam. La sonde `steam:version` reste le moyen de le
faire à la main.

### Les risques pris

La lecture de Steam n'est mesurée que depuis un poste et depuis Cloud Shell.
La mesurer depuis une Function demande une mise en production : sa première
exécution là est la première ouverture après la fusion de la story qui
vérifie. Si elle échoue là, par le réseau, par le
système de fichiers ou par le chargement de la bibliothèque, toute mise en
place d'un jeu qui passe par une copie est abandonnée jusqu'à une fusion qui la
corrige.

Une panne de Steam, un changement de son protocole ou un refus des sessions
anonymes ferment de la même façon tout jeu qui passe par une copie. C'est le
prix de la décision d'abandonner sur une version illisible.

`steam-user` est une bibliothèque communautaire qui suit un protocole non
documenté.

Rien ne mesure le délai entre une publication de l'éditeur et le moment où
Steam la rend à une session anonyme, ni ce que Steam répond à des lectures
répétées sur des jours. Le rafraîchissement en fait vingt-quatre par jour et
par jeu, et chaque ouverture en ajoute une.

Rien ne mesure que deux builds différents sont toujours incompatibles en jeu.
Une publication qui n'aurait rien cassé fait échouer la vérification préalable
comme une autre, jusqu'au dépôt suivant.

L'éditeur peut publier pendant que personne ne peut déposer une copie : seul
le poste qui possède le jeu le fait. Personne ne joue à ce jeu dans
l'intervalle.

La vérification préalable juge la version enregistrée, pas l'archive. Une
version enregistrée sur une archive absente passe ; aucun outil ne supprime
une archive.

Le manifeste d'une installation faite par le client Steam plutôt que par
`steamcmd` n'est pas mesuré. S'il n'est pas dans son dossier, l'outil ne la
trouve pas et installe à côté, dans `beacon-<jeu>` : le poste porte alors deux
installations.

L'installation que le poste porte aujourd'hui est dans le dossier que le client
Steam donnerait au serveur dédié. L'outil la retrouve par son manifeste et la
reprend : si le client Steam installe un jour cette application, deux outils
mettent à jour le même dossier.

L'installation et l'archive que l'outil construit dans le dossier temporaire
demandent ensemble environ 17 Gio libres sur le poste. Un disque plein ne se
découvre qu'après le téléchargement.

Le port `steamcmd` réel, sa recherche dans le `PATH` et son lancement par
`spawn` avec un dossier dont le chemin porte des espaces, n'est essayé par
aucun test : la story l'essaie à la main.

Un dépôt de la même version, accepté à la question « déposer quand même ? »,
rend le bouton d'ouverture alors que la copie reste en retard. L'ouverture
suivante échoue à la vérification préalable.

Si la lecture anonyme de Steam rend un build plus ancien que celui que
`steamcmd` vient de télécharger avec le compte de l'exploitant, chaque
ouverture est abandonnée pour une copie en retard, et l'écran cache le bouton
jusqu'à une lecture qui rend le nouveau build.

Le rafraîchissement et la mise en place écrivent tous deux la version lue,
chacun à l'heure de son écriture. Une lecture plus ancienne écrite après une
plus récente l'emporte jusqu'à la lecture suivante, sur l'écran seulement :
l'écran offre alors d'ouvrir, et la vérification préalable, qui juge sa propre
lecture, abandonne cette ouverture. L'abandon qu'elle laisse rend l'attente à
l'écran de ce monde.

Chaque story qui touche `libs/session` ou `package-lock.json` change l'empreinte
de l'image du compagnon, et ne fusionne qu'après sa republication par le
commanditaire.

De ce que `steamcmd` rend, seuls le refus d'une connexion et un
`app_update validate` sur une installation à jour sont mesurés. Un `app_update`
sans `validate`, qui télécharge un nouveau build, ou que `steamcmd` fait suivre
de sa propre mise à jour, n'est pas mesuré. S'il
échouait sur un code `0`, il laisserait l'ancienne installation, complète :
l'outil dirait alors la copie déjà à cette version, et demanderait s'il dépose
quand même.

Sans `--steam-account`, le compte reste deviné depuis le client Steam du poste.
Ce que `steamcmd` rend pour un compte qui ne possède pas le jeu n'est pas
mesuré.

Sans `validate`, `steamcmd` ne relit pas les fichiers locaux : un fichier abîmé
sur le poste part dans l'archive.

Une Function qui tombe pendant la vérification préalable laisse la session en
préparation jusqu'au délai d'abandon, vingt-cinq minutes, l'écran sur la
vérification préalable. L'abandon qui suit ne porte aucune cause, comme celui
d'un refus ordinaire : l'écran dit alors la vérification préalable sans cas
d'échec, ce qu'aucune règle de la spec ne décrit. Une session qu'on ferme
pendant ce temps reste en fermeture jusqu'au rattrapage de la surveillance, et
non jusqu'à la fin de la vérification préalable.

Un refus ordinaire pendant la vérification préalable, comme une lecture de
`gameCopies/{game}` qui échoue, s'affiche comme une réponse de l'hébergeur,
ainsi que tout refus ordinaire aujourd'hui.

La première étape gardée devient la condition de l'appel à l'hébergeur : une
écriture qui échoue là, et qui n'arrêtait rien aujourd'hui, laisse désormais la
session en préparation sans serveur, jusqu'au délai d'abandon.

Un onglet ouvert avant la mise en production affiche la première étape pendant
la vérification préalable, et l'étape un après un abandon dû à la copie,
jusqu'à ce que le changement de version le recharge.

## Constraints

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

## Feature flag

Feature flag: none — aucune story fusionnée seule ne laisse un comportement à
moitié livré : une version enregistrée que rien ne lit encore, une vérification
préalable qui réussit toujours, un abandon qui dit sa cause, puis l'annonce
avant l'ouverture. L'ordre entre la première et la troisième, et le dépôt
entre elles, sont une contrainte, pas un flag. La récupération du jeu par
l'outil de dépôt ne sert qu'à l'exploitant, et sa story est complète seule.
