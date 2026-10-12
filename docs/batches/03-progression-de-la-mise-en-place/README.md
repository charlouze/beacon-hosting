---
status: open
---

# 03 — La mise en place dit où elle en est

## Scope

Pendant qu'une session se met en place, l'écran dit l'étape en cours parmi
quatre, son rang, son heure de début, son avancement quand il se mesure et
l'activité que le jeu précise.

Un serveur de jeu qui déclare ne pas pouvoir finir sa mise en place la fait
abandonner aussitôt. Après un abandon, l'écran dit à quelle étape la mise en
place s'est arrêtée, et à quelle heure.

La fourchette de disponibilité se tire des dernières mises en place abouties du
jeu, et non plus de deux durées fixes.

Le journal de la plateforme reçoit chaque changement d'étape et d'activité, et,
à un échec déclaré, sa cause entière et les dernières lignes de la sortie du
jeu.

Le lot prend en charge une entrée de `docs/specs/session.gaps.md`, réservée par
cette pull request :

- **Gaps**, `Opening a session` : la fourchette de disponibilité n'existe que
  dans la mise en forme de l'écran, et le cœur de décision ne la porte pas.

Le lot n'ajoute aucune alerte, et ne touche pas `infrastructure`.

Le lot ne découpe pas en activités l'étape où le jeu démarre.

Le lot ne déclare pas en échec un jeu dont le conteneur redémarre en boucle : le
délai d'abandon reste seul à le rattraper.

Le lot ne dit pas ce que l'écran affiche quand un serveur de jeu déclare une
étape antérieure à celle qu'il avait déclarée.

Le lot ne change ni l'attente à la fermeture d'une session, ni ce que l'écran
fait d'un identifiant de serveur périmé.

## Spec delta

### D1 — `docs/specs/session.md`, `Ubiquitous language`

```diff
 | fourchette de disponibilité | `readyWindow`, affiché `Ready between` | les deux heures entre lesquelles le serveur devrait devenir joignable |
+| mise en place | `setup` | ce qu'une session traverse entre son ouverture et son passage en service |
+| étape | `SetupStep` | l'une des quatre parties d'une mise en place |
+| activité | `SetupActivity` | ce qu'un serveur de jeu fait à l'intérieur d'une étape |
+| avancement | `SetupProgress` | la part déjà faite de l'activité en cours, ou de l'étape quand elle n'en a pas, en pourcentage |
 | réponse de l'hébergeur | `lastError`, affiché `What the host said` | ce que l'hébergeur a répondu au dernier échec |
```

### D2 — `docs/specs/session.md`, `Opening a session`

```diff
 Une session ouvre le monde sur sa dernière sauvegarde, quelle qu'ait été la
 cause de la fermeture de la précédente.
 
+Une mise en place qui aboutit traverse quatre étapes : le serveur se réveille,
+le jeu est installé, le monde est restauré, le jeu démarre. Le réveil du
+serveur commence à l'ouverture de la session et le démarrage du jeu vient en
+dernier ; l'ordre des deux autres dépend du jeu de la session.
+
+Pendant la mise en place, l'écran affiche l'étape en cours, son rang sur quatre
+et l'heure à laquelle cette étape a commencé.
+
+L'écran affiche l'avancement quand le serveur de jeu en déclare un.
+
+L'écran affiche l'activité de l'étape en cours quand le serveur de jeu en
+déclare une.
+
 Pendant la mise en place, l'écran annonce une fourchette de disponibilité,
 jamais une heure unique ni une durée.
```

### D3 — `docs/specs/session.md`, `Opening a session`

```diff
 Pendant la mise en place, l'écran annonce une fourchette de disponibilité,
 jamais une heure unique ni une durée.
 
+Exception : tant que le jeu de la session compte moins de deux mises en place
+abouties, l'écran n'annonce aucune fourchette.
+
+La fourchette de disponibilité se tire des cinq dernières mises en place
+abouties du jeu de la session, ou de toutes s'il y en a moins de cinq, sans
+distinguer les mondes ni les gabarits. Elle va de l'ouverture de la session
+plus la durée de la plus courte, à cette ouverture plus la durée de la plus
+longue.
+
+La durée d'une mise en place aboutie va de l'ouverture de sa session à son
+passage en service.
+
+Quand les deux heures de la fourchette tombent dans la même minute, l'écran
+annonce la minute suivante pour la plus tardive.
+
 Quand l'hébergeur refuse une mise en place, l'écran dit ce qu'il a répondu.
```

### D4 — `docs/specs/session.md`, `Opening a session`

```diff
 Une mise en place qui n'aboutit pas est abandonnée.
 
+Une mise en place est abandonnée dès que le serveur de jeu déclare qu'il ne
+peut pas la finir.
+
+Après l'abandon d'une mise en place, et jusqu'à l'ouverture suivante d'une
+session sur le même monde, l'écran affiche l'étape à laquelle elle s'est
+arrêtée et l'heure de l'abandon.
+
 La durée d'une session et le gabarit sont les mêmes pour tous les mondes, et
 seul un administrateur les change.
```

### D5 — `docs/specs/session.md`, `Seeing a session`

```diff
-Seuls les membres d'un monde et les administrateurs voient sa session en cours.
+Seuls les membres d'un monde et les administrateurs voient sa session en cours,
+et ce que l'écran affiche de sa dernière mise en place quand elle a été
+abandonnée.
```

## Technical design

### Ce qu'un serveur de jeu montre, mesuré

`probe/RESULTS.md`, section P, porte le relevé local des 2026-10-11 et
2026-10-12. Le design repose sur ces faits :

- la sortie du conteneur d'Enshrouded, qui télécharge le jeu lui-même, porte
  une ligne d'avancement toutes les deux secondes environ, et une ligne quand
  l'installation est finie ;
- cette sortie porte une ligne `ERROR!` sur un démarrage qui réussit, et une
  ligne d'avancement à zéro après le téléchargement ;
- `docker compose logs -f` suit un service à travers ses redémarrages, et écrit
  ce que `docker logs` rend ;
- lancée avant que le conteneur existe, cette commande rend la main aussitôt,
  sans erreur ;
- un conteneur sans socket Docker lit le fichier où cette commande écrit moins
  de deux secondes après l'écriture d'une ligne ;
- une requête UDP vers un conteneur qui existe et n'écoute pas est refusée en
  15 ms, sur un socket connecté comme celui de la sonde de l'agent.

La section B porte l'ordre de grandeur de la reprise de Sunkenland depuis le
dépôt des jeux, téléchargement et décompression ensemble : environ trois
minutes pour 9,33 Go sur `PLAY2-MICRO`.

### Les étapes et les activités, dans le domaine

`libs/session` déclare `SETUP_STEPS`, quatre valeurs, et `SETUP_ACTIVITIES`,
une liste fermée commune à tous les jeux. Un jeu se sert des activités qui lui
conviennent ; en ajouter une ajoute une valeur ici et ses mots à l'écran, comme
un jeu ajoute déjà une forme de point de jonction.

Une fonction pure y décide de ce qu'une déclaration fait de l'étape gardée :

- une autre étape la remplace, avec l'heure de la déclaration, qu'elle vienne
  avant ou après elle dans l'ordre du jeu ;
- la même étape garde son heure, et met à jour l'activité et l'avancement.

Elle rend aussi ce qui a changé, l'étape, l'activité, l'avancement ou rien, et
l'étape quittée avec son heure de début quand l'étape change.

Le rang d'une étape se lit dans l'ordre du jeu.

Une fonction pure, `shownSetup`, dit ce que l'écran montre d'une mise en place,
à partir de l'état de la session, de son identifiant, de son heure d'ouverture,
de la marque d'abandon et de ce que le document de la mise en place garde :

- en préparation, l'étape gardée si elle porte la session en cours, et la
  première étape depuis l'ouverture sinon ;
- sur une marque d'abandon qui porte la dernière session ouverte, l'étape
  gardée si elle porte cette session, et la première étape sinon, avec l'heure
  de l'abandon ;
- rien dans les autres cas.

Elle rend l'ordre des étapes du jeu avec l'étape gardée, et aucun ordre avec la
première étape.

Une autre fonction pure rend la fourchette de disponibilité. Elle reçoit
l'heure d'ouverture et les durées gardées, de la plus ancienne à la plus
récente, ne retient que les cinq dernières, et rend deux heures, ou rien sous
deux durées. La seconde heure est repoussée d'une minute quand elle tombe dans
la même que la première : « jamais une heure unique » est une règle de la spec,
pas une mise en forme.

`readyWindow` quitte `apps/web/src/app/format.ts`, et `BOOT_WINDOW_MS` disparaît
avec le test qui l'épingle. La fourchette part de `startedAt`, et non plus de
`stateSince` : c'est le même instant aujourd'hui, et la spec dit l'ouverture.

`StateCorrection` gagne la session dont la correction abandonne la mise en
place, ou rien. `reconcileWorld` la donne pour l'abandon au délai, que la
fermeture aboutisse ou non.

### Le rapport du serveur de jeu

`AgentReport`, dans `libs/agent-protocol`, gagne deux champs facultatifs :

- `setup` : une étape, et à volonté une activité et un avancement ;
- `gameLog` : les dernières lignes de la sortie du jeu, sur un rapport `failed`.

`parseReport` écarte un `setup` dont l'étape ou l'activité sort de sa liste, ou
dont l'avancement n'est pas un entier de 0 à 100, et un `gameLog` de plus de
16 384 caractères. Il n'en refuse pas le rapport : un rapport `ready` ne doit
pas tomber sur une donnée d'affichage. C'est le seul endroit où `parseReport`
écarte un champ qu'il connaît au lieu de refuser. Il rend, avec le rapport, le
nom des champs qu'il a écartés ; `main.ts` passe les deux à `runAgentReport`,
qui l'écrit au journal de la plateforme une fois le jeton vérifié.

La borne de `gameLog` est une constante du protocole, que le compagnon lit.

`parseReport` écarte déjà les champs qu'il ne connaît pas : un plan de contrôle
d'avant ce lot ignore `setup` sans refuser le rapport.

Le protocole gagne une seconde cadence, 10 s. `REPORT_INTERVAL_MS` ne change
pas.

### Ce que le plan de contrôle garde

L'étape gardée vit dans un document à elle, `worlds/{worldId}/server/setup`, à
côté de `server/current`. Chaque écriture de `server/current` relance
`onServerStateChange` : y écrire l'avancement toutes les 10 s mettrait une
Function et une transaction derrière chaque rapport.

Le document porte l'identifiant de la session, l'ordre des étapes du jeu,
l'étape en cours, son heure de début, son activité et son avancement.

Les règles Firestore en donnent la lecture aux membres du monde et aux
administrateurs, comme pour `server/current`, et l'écriture à personne.

`libs/session-record` gagne le magasin de ce document, avec deux gestes :

- commencer : écrire l'identifiant de la session, l'ordre du jeu, la première
  étape et l'heure d'ouverture de la session ;
- avancer : dans une transaction, appliquer la fonction du domaine à l'étape
  gardée, et rendre ce qu'elle rend. Il lit `server/current` dans la même
  transaction, et n'écrit rien et ne rend aucun changement si le document
  porte une autre session ou si la session n'est plus en préparation.

Rien n'efface ce document : commencer le récrit en entier.

`provision`, une fois `claimProvisioning` acquis, commence avec l'ordre que le
catalogue donne pour le jeu. Un échec de cette écriture va au journal de la
plateforme et n'arrête pas la mise en place.

`agentReport`, sur un rapport qui porte `setup` pendant qu'une session est en
préparation, avance. Hors de la préparation, il ignore `setup`.

Un changement d'étape n'est pas un changement d'état : il n'écrit aucun
événement.

L'abandon, lui, se marque dans `server/current`, dans la même écriture que le
changement d'état : un champ porte la session dont la mise en place est
abandonnée et l'heure de l'abandon. `apply` l'écrit quand la correction donne
cette session. `claimProvisioning` l'efface, comme il efface déjà `lastError`.

Seules les Functions écrivent ce champ : un membre n'écrit dans ce document
que les champs de `demandedFields()`. Il reste hors de `RESERVED_FACTS`, comme
`lastError`, pour que le nettoyage d'un abandon ne l'efface pas.
`idleServerDocument()` le sème à `null`, et le test qui garde `lastError` hors
des faits réservés le garde aussi.

Une session arrêtée avant que `claimProvisioning` ne l'acquière laisse la
marque en place : `shownSetup` l'écarte, parce qu'elle ne porte plus la
dernière session ouverte.

`ServerView`, que l'écran lit, gagne ce que `shownSetup` rend : l'étape à
montrer en préparation, ou celle d'une mise en place abandonnée, et l'ordre des
étapes quand il est connu. `libs/session-record` l'appelle ; aucun écran ne
compare d'identifiant de session.

### Ce que chaque jeu apporte

`GameCatalogEntry` gagne l'ordre des quatre étapes de son jeu, que le plan de
contrôle écrit et que l'écran range.

`GameCatalogEntry` gagne aussi ce que l'agent déclare pour ce jeu : l'étape de
départ, et une liste de marqueurs, vide pour un jeu qui n'en a pas. Le
cloud-init de chaque jeu les dépose dans un fichier que le conteneur de l'agent
monte en lecture seule.

| | Enshrouded | Sunkenland |
|---|---|---|
| ordre des étapes | `waking`, `restoring-world`, `fetching-game`, `starting-game` | `waking`, `fetching-game`, `restoring-world`, `starting-game` |
| qui déclare `fetching-game` | l'agent, sur la sortie du conteneur du jeu | la restauration, qui reprend le jeu du dépôt |
| avancement de `fetching-game` | celui que la sortie du jeu donne | les octets reçus du dépôt, puis rien pendant la décompression |
| étape de départ de l'agent | `fetching-game` | `starting-game` |
| marqueurs | oui | aucun |

Un test du catalogue vérifie, pour chaque entrée, que les quatre étapes
figurent une fois dans l'ordre, la première et la dernière à leur place, et que
l'étape de départ et celle de chaque marqueur viennent après la première.

Le format de ce fichier vit dans `libs/agent-protocol`, avec ce qui l'écrit et
ce qui le lit : le catalogue l'écrit par là, le compagnon le lit par là, et le
test du catalogue relit ce que chaque entrée rend. `scope:catalog` gagne le
droit de dépendre de `scope:protocol`.

Le compagnon lit ce fichier à son démarrage. Un fichier qu'il ne sait pas lire
le fait déclarer un échec.

- Le fichier est du JSON : une étape de départ, et des marqueurs dans l'ordre.
- Un marqueur porte une expression régulière, une étape et, à volonté, une
  activité.
- Le premier groupe que l'expression capture, s'il y en a un, est l'avancement.
  Le compagnon l'arrondit à l'entier inférieur et le borne de 0 à 100, et
  n'envoie aucun avancement si ce n'est pas un nombre.
- La dernière ligne du journal qui répond à un marqueur décide. Sur une ligne
  qui répond à plusieurs, le premier de la liste l'emporte.

Les marqueurs d'Enshrouded tiennent compte de ce que la sonde a relevé : seule
une ligne `downloading` donne un avancement, et aucun marqueur ne s'arrête sur
`ERROR!`.

### Le compagnon

`ObjectApi.get`, dans `libs/scaleway-storage`, accepte une fonction appelée
avec les octets reçus et la taille de l'objet, que l'adapter lit dans la
réponse du seau. Son faux la reçoit aussi.

La restauration déclare, par un rapport `alive`, l'étape de chaque opération
qu'elle commence : l'installation du jeu avant de reprendre un jeu du dépôt,
ce qu'elle ne fait aujourd'hui que pour Sunkenland, et la restauration du
monde avant de chercher sa dernière sauvegarde, qu'il en ait une ou non. Elle
ne connaît pas l'ordre du jeu.

Pendant le téléchargement d'un jeu du dépôt, elle déclare l'activité
« téléchargement » avec l'avancement tiré des octets reçus, au plus une fois
toutes les 10 s ; puis l'activité « décompression », sans avancement.

La restauration attend la réponse à chaque rapport d'étape, 5 s au plus, avant
d'envoyer le suivant. Un rapport d'étape qui échoue ou qui tarde n'arrête pas
la restauration : elle l'écrit dans son journal et continue. `httpReporter`
accepte ce délai pour un envoi ; aucun autre rapport n'en reçoit.

Tant qu'il n'a pas annoncé le serveur, l'agent déclare à chaque tour de sa
boucle l'étape que décident les marqueurs sur la fin du fichier de journal. Il
ne lit que les 65 536 derniers octets du fichier. Un fichier absent ou
illisible vaut un fichier vide.

L'agent déclare l'étape de départ tant qu'aucune ligne n'a répondu. Ensuite il
garde ce qu'un marqueur a décidé tant qu'aucune autre ligne ne répond, même si
la ligne sort de ce qu'il lit.

Une fois le serveur annoncé, l'agent ne déclare plus d'étape et ne lit plus le
fichier.

La boucle de l'agent attend 10 s au lieu de 60 tant que le serveur n'est pas
annoncé et que son jeu a des marqueurs.

Sur un rapport `failed` envoyé avant d'avoir annoncé le serveur, l'agent joint
les 16 384 derniers caractères du fichier de journal.

`CompanionConfig` gagne deux chemins, celui du fichier de journal et celui du
fichier des marqueurs. Le compagnon ne connaît toujours aucun jeu.

### La sortie du jeu, dans un fichier

Le cloud-init de chaque jeu gagne une unité systemd qui lance
`docker compose logs -f --no-color --no-log-prefix` sur le service du jeu, vers
`/opt/beacon/log/game.log`, que chaque lancement de l'unité récrit depuis le
début.

L'unité se relance sans limite, toutes les deux secondes : avant que le
conteneur du jeu existe, la commande rend la main aussitôt.

L'unité démarre avant `docker compose up -d`.

Le conteneur de l'agent monte `/opt/beacon/log` en lecture seule. Aucun
conteneur ne reçoit le socket Docker.

Le code interdit aujourd'hui au compagnon de lire la sortie de Sunkenland,
parce qu'elle porte le mot de passe du serveur. Le commanditaire a levé
cette interdiction le 2026-10-12 : ce mot de passe n'ouvre rien du système. Les
commentaires de `deploy/cloud-init` qui la portent se récrivent, et le filtre
qui extrait l'identifiant du serveur reste ce qu'il est.

### L'abandon déclaré

`agentReport`, sur un rapport `failed` pendant qu'une session est en
préparation, abandonne la mise en place : fermer le serveur, puis passer hors
service, ou bloqué si la fermeture échoue.

`provisioning.ts` suit déjà ce chemin quand l'hébergeur refuse. Il en sort,
dans un fichier de `apps/functions` que `provisioning.ts` et `agent-report.ts`
appellent tous deux. Il reçoit la session, le détail de l'événement, et ce que
`lastError` porte quand la fermeture aboutit et quand elle échoue. Il relit
l'enregistrement après la fermeture, et n'écrit que si la session est encore
celle-là et encore en préparation.

La fermeture d'une session en service garde son propre chemin, dans
`agent-report.ts`.

Chacun des trois abandons donne la session abandonnée dans sa correction :
l'abandon déclaré et le refus de l'hébergeur par ce chemin, l'abandon au délai
par `reconcileWorld`.

L'événement `ProvisioningFailed` d'un abandon déclaré a pour détail une phrase
fixe. Il ne porte ni l'étape atteinte, que tout utilisateur lirait dans le
journal, ni rien de ce que le serveur de jeu a écrit.

Le refus de l'hébergeur garde ses écritures d'aujourd'hui, `lastError`
compris. L'abandon déclaré n'écrit `lastError` que si la fermeture échoue, et y
met ce que l'hébergeur a répondu à la fermeture.

`agentReport` répond l'ordre de s'arrêter à un rapport `failed` qui abandonne,
quelle que soit l'issue : l'agent cesse de rapporter.

Hors de la préparation, un rapport `failed` garde son traitement d'aujourd'hui.

### Le journal de la plateforme

`PlatformJournal` gagne une entrée qui n'est pas un échec : un changement
d'étape ou d'activité, avec la session, le monde, le jeu et, quand l'étape
change, l'étape quittée et le temps passé dans celle-ci. `agentReport` l'écrit
quand avancer rend un changement d'étape ou d'activité, jamais pour un
avancement seul.

Il en gagne une seconde, pour les champs qu'un rapport portait et que
`parseReport` a écartés, avec la session et le nom de ces champs. L'échec de
commencer est une entrée d'échec, sous une source nouvelle.

À un abandon déclaré, l'entrée d'échec existante porte la cause entière, et
gagne l'étape atteinte et les dernières lignes de la sortie du jeu.

Rien de `gameLog` n'est écrit ailleurs que dans ce journal.

### La fourchette

Une collection `launches`, un document par jeu, garde les mises en place
abouties les plus récentes, cinq au moins : pour chacune, l'identifiant de sa
session et sa durée, de `startedAt` à l'heure du rapport.

`becomeRunning` y ajoute celle qui aboutit, après `publish`, dans une
transaction qui n'ajoute pas deux fois la même session. Un échec de cette
écriture va au journal de la plateforme et ne fait pas échouer le rapport.

Les règles Firestore en donnent la lecture à tout utilisateur et l'écriture à
personne.

`libs/session-record` rend la fourchette avec le monde, calculée par la
fonction du domaine, à l'écran d'un monde comme à la liste des mondes.

### L'écran

`preparing.component.ts` prend la forme de la variante C de
`.impeccable/mocks/progress/` : l'étape à la place d'honneur, la fourchette à
droite, le filet en quatre longueurs, la longueur qui passe pour une étape sans
avancement.

Tant que l'ordre des étapes du jeu ne lui est pas donné, il montre la première
étape depuis l'heure d'ouverture, et les longueurs à venir sans nom.

`out-of-service.component.ts` montre l'étape et l'heure d'une mise en place
abandonnée sous `Where it stopped`. Son titre et son bouton passent à
`It didn’t start.` et `Try again` sur une mise en place abandonnée comme sur
une réponse de l'hébergeur, qu'il montre toujours quand il y en a une.

`not-cleared.component.ts` montre aussi l'étape et l'heure d'une mise en place
abandonnée.

Les mots des étapes et des activités vivent dans `apps/web`.

Le commentaire en tête de `preparing.component.ts` cesse de citer l'ancienne
contrainte d'interface.

### Les tests

Les trois fonctions pures du domaine, la transition d'étape, `shownSetup` et la
fourchette, ont leurs tests, dont :

- une étape qui revient en arrière, la même étape déclarée deux fois, un
  avancement seul qui change ;
- la fourchette à zéro, une, deux et six durées, et à deux heures dans la même
  minute ;
- ce que l'écran montre quand l'étape gardée porte une autre session, en
  préparation comme après un abandon, et une marque d'abandon qui ne porte pas
  la dernière session ouverte.

`reconcileWorld` a ses tests sur l'abandon au délai, fermeture aboutie et
fermeture refusée.

`parseReport` a un test par `setup` écarté, un pour `gameLog`, et un rapport
`ready` qui passe avec un `setup` mal formé, et dit ce qu'il a écarté.

Le magasin de la mise en place a ses tests sur l'émulateur : commencer récrit
tout, avancer n'écrit rien sur une autre session ni hors de la préparation, et
rend ce qui a changé.
`apply` a les siens : il écrit la marque d'abandon, et `claimProvisioning`
l'efface.

`agentReport` a ses tests sur le faux hébergeur :

- une étape qui avance, un `setup` ignoré hors de la préparation, et un champ
  écarté écrit au journal de la plateforme ;
- un changement d'étape écrit au journal de la plateforme avec l'étape quittée
  et le temps passé, un changement d'activité écrit sans eux, et un avancement
  seul qui n'y écrit rien ;
- un abandon déclaré qui ferme, passe hors service et donne la session
  abandonnée ;
- un abandon dont la fermeture échoue ;
- un abandon pendant lequel la session change, qui n'écrit rien ;
- un rapport `failed` chargé d'un secret, dont ni l'événement ni aucune
  écriture ne gardent rien ;
- la réponse à un rapport `failed` qui abandonne ;
- un rapport `failed` hors de la préparation, traité comme aujourd'hui ;
- un rapport sans `setup`, qui met en service et ferme comme aujourd'hui ;
- la mise en place aboutie ajoutée une fois pour deux rapports `ready`, et un
  échec de cette écriture qui laisse le rapport réussir.

Les trois tests de `agent-report.spec.ts` qui épinglent le traitement
d'aujourd'hui d'un rapport `failed` pendant la préparation s'inversent.

`provisioning.spec.ts` vérifie que le refus de l'hébergeur donne la session
abandonnée, et qu'un échec de commencer n'arrête pas la mise en place.

Les règles ont un test qui refuse à un membre l'écriture de `server/setup`, de
la marque d'abandon et de `launches`, et qui refuse la lecture de
`server/setup` hors du monde.

Le compagnon a ses tests sur le faux seau :

- les étapes de la restauration pour chaque jeu, monde sans sauvegarde compris ;
- l'avancement du téléchargement et son rythme, et un rapport d'étape qui
  tarde ;
- les marqueurs exécutés sur la sortie que la sonde a relevée, gardée comme
  fixture, et une capture qui n'est pas un nombre ;
- un journal plus long que ce que l'agent lit, dont la ligne décisive est
  sortie ;
- un fichier de marqueurs illisible, un fichier de journal absent ;
- la cadence de la boucle, et `gameLog` joint à un échec.

Les écrans ont leurs tests : la préparation sans document de mise en place,
avec une étape, avec et sans avancement, sans fourchette ; l'écran hors service
et l'écran bloqué sur une mise en place abandonnée ; la liste des mondes.

Le test de fumée rend le fichier des marqueurs depuis le catalogue, le monte
dans l'agent, fait écrire à son faux jeu les lignes que la sonde a relevées,
et vérifie les étapes que son faux plan de contrôle reçoit, pour chaque jeu.
Son faux plan de contrôle retient `setup`.

L'unité systemd n'a pas de test qui l'exécute : le test de fumée ne démarre
aucune machine.

### Ce qui change ailleurs

`STACK.md` gagne l'unité de suivi et le fichier de journal du jeu.

Les commentaires qui disent qu'un échec déclaré pendant la préparation attend
le délai se récrivent : dans `restore.ts` et dans `agent-loop.ts`.

Les commentaires qui disent qu'un serveur de jeu rapporte une fois par minute
se récrivent : celui de `REPORT_INTERVAL_MS`, celui de `runAgentLoop`, et ceux
de `readiness.ts`, de `serverid.ts`, de `catalog.ts`, de
`apps/functions/src/main.ts`, et ceux des tests qui les répètent,
`enshrouded.spec.ts` et `agent-loop.spec.ts`.

Les commentaires de `client-session.ts` et de `preparing.component.ts` qui
disent que la fourchette part de `stateSince` se récrivent.

### Les risques pris

Rien de ce design n'a tourné sur un serveur de jeu. L'unité de suivi, son ordre
avec `docker compose up -d` et sa relance toutes les deux secondes ne sont
mesurés qu'en local, sans systemd.

Le fichier de journal grossit sur le disque du serveur pendant toute la session,
et rien ne mesure sa taille au bout de quatre heures.

La sortie d'un jeu, mot de passe du serveur compris, reste sur le disque du
serveur pendant la session, et ses dernières lignes vont au journal de la
plateforme à un échec déclaré.

Les marqueurs lisent la prose d'un outil que le projet n'écrit pas. Une version
qui la change laisse l'étape sans avancement, ou la laisse sur l'installation
du jeu jusqu'à la mise en service.

Le fichier des marqueurs traverse le gabarit du cloud-init avant d'être lu. Le
test du catalogue relit ce que chaque entrée rend, mais rien ne le relit sur un
serveur de jeu. Le test de fumée ne tourne qu'à la publication d'une image du
compagnon : un marqueur changé seul dans le catalogue ne le relance pas.

Un échec de l'écriture qui commence le document de la mise en place laisse
l'écran sur la première étape pour toute cette mise en place. Aucun de ses
changements d'étape n'atteint le journal de la plateforme, et l'écran d'un
abandon montre la première étape, quelle que soit celle où elle s'est arrêtée.

Tout rapport `failed` reçu en préparation abandonne, quelle qu'en soit la
cause : un serveur annoncé que le plan de contrôle n'a pas mis en service et
dont une sauvegarde échoue perd sa session avant le délai.

Un serveur de jeu qui déclare une étape antérieure fait revenir l'écran en
arrière, à tort ou à raison : rien ne vérifie ce qu'il déclare.

Un serveur de jeu qui déclare un échec passager perd sa session : la
déclaration abandonne sans nouvelle tentative.

Un conteneur de jeu qui redémarre en boucle ne déclare rien. Le délai d'abandon
le rattrape, et sa sortie disparaît avec le serveur.

Un abandon déclaré retient `agentReport` le temps de la fermeture, jusqu'à 30 s
d'attente du volume, dans une Function qui s'arrête à 60 s. Tuée avant
d'écrire, elle laisse la session en préparation jusqu'au délai d'abandon.

Tant qu'il n'a pas annoncé le serveur, l'agent d'un jeu à marqueurs,
Enshrouded aujourd'hui, appelle `agentReport` six fois par minute au lieu
d'une.

L'agent sonde le jeu avant chaque rapport, avec un délai de 30 s. La sonde
locale mesure un refus en 15 ms tant que rien n'écoute ; un serveur qui écoute
sans encore répondre ferait durer un tour 40 s et non 10, et rien ne le mesure.

Une étape que les marqueurs décident commence, à l'écran, à l'heure du rapport
qui la déclare : jusqu'à 10 s après la ligne du journal.

Un rapport d'étape de la restauration qui se perd n'est pas renvoyé : l'écran
reste sur l'étape précédente jusqu'au rapport suivant.

Entre l'ouverture et le début du document de la mise en place, l'écran ne
connaît pas l'ordre des étapes du jeu.

Une session ouverte avant ce lot et encore en préparation à son déploiement
reste sur la première étape, jusqu'à sa mise en service comme après son
abandon.

La fourchette mêle les mises en place de tous les mondes d'un jeu et de tous
les gabarits. Un changement de gabarit la fausse pendant cinq sessions.

Une mise en place aboutie dont l'écriture dans `launches` échoue manque à la
fourchette.

Le jour où la fourchette se tire des mises en place, chaque jeu passe par deux
sessions sans fourchette.

Après un abandon au délai, l'écran montre l'étape atteinte et, sous
`What the host said`, la phrase du délai, qui n'est pas une réponse de
l'hébergeur.

Le journal des événements est lisible par tout utilisateur, hors du monde
aussi : un abandon y reste visible, sans son étape.

## Constraints

Les quatre étapes se nomment `waking`, `fetching-game`, `restoring-world` et
`starting-game`.

Le rapport porte l'étape sous `setup`, et le plan de contrôle la garde dans
`worlds/{worldId}/server/setup`.

L'image du compagnon embarque `libs/session`, `libs/agent-protocol` et
`libs/scaleway-storage`, et la vérification refuse un arbre dont ces sources
diffèrent de l'image épinglée. Toute story qui en change une demande donc une
image publiée et épinglée avant sa fusion. Le commanditaire la publie.

L'image du compagnon qui déclare les étapes est épinglée dans le catalogue
avant que la story qui change l'écran de préparation atteigne `main`.

La story qui garde l'étape déclarée atteint `main` avant celle qui transcrit
D2 et avant celle qui transcrit D4.

Un serveur de jeu démarré sur une image du compagnon d'avant ce lot se met en
service et se ferme comme aujourd'hui.

Ce lot n'ajoute à aucun document qu'un membre lit, ni à aucun événement, un
texte venu d'un serveur de jeu.

## Feature flag

Feature flag: none — aucune story, fusionnée seule, ne laisse un joueur devant quelque chose d'incomplet : celles qui ne transcrivent aucun bloc ne changent rien à l'écran, et chaque bloc livre une règle entière, dans l'ordre que `Constraints` impose
