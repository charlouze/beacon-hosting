---
status: open
---

# 01 — Le serveur de jeu démarre sur un volume bloc

## Scope

Tout serveur de jeu démarre sur un volume bloc dont la taille dépend du jeu, ce
qui rend commandable un gabarit livré sans disque local.

Un volume qui porte les tags du système se détruit par tag, à la fermeture de
sa session, et au balayage s'il lui a échappé.

Un volume dont les tags ne se sont jamais posés se détruit par son attachement
au serveur. Si cette suppression échoue une fois le serveur disparu, il reste
signalé et n'est pas détruit.

Ni un détail d'événement ni `lastError` ne recopient plus ce qu'un fournisseur
ou un serveur de jeu a répondu : ils sont bornés et expurgés.

Le lot prend en charge deux entrées de `docs/specs/session.gaps.md`, réservées
par cette pull request :

- **Violations**, `Closing a session` : ce dont le système ne sait plus dire à
  quelle session il appartenait est signalé et jamais détruit. Le lot la ferme
  pour tout volume tagué ; le volume jamais tagué en reste.
- **Violations**, `CLAUDE.md`, « Rien de ce qu'un membre peut lire ne révèle un
  secret du système » : ce qui vient d'un échec d'hébergeur est recopié tel quel
  dans la trace que tout membre peut lire.

Le lot ne change pas le gabarit par défaut, et ne modifie aucun réglage en
production.

## Spec delta

none — aucune règle de `docs/specs/session.md` ne parle de disque ni de volume ;
la destruction d'un volume tagué orphelin rétablit « Aucun serveur de jeu ne
coûte hors d'une session en cours », que la spec promet déjà ; et l'expurgation
rétablit une règle que `CLAUDE.md` et
`docs/adr/chaque-geste-sur-une-session-laisse-un-evenement-dans-un-journal.md`
portent déjà.

## Technical design

### Ce que le fournisseur fait, mesuré

`probe/RESULTS.md`, section B, porte le relevé du 2026-10-08 sur `DEV1-L` et
`PLAY2-MICRO`. Le design repose sur ces faits :

- un serveur se crée et démarre sur un volume racine `sbs_volume`, avec l'image
  de type `instance_sbs` ;
- le volume naît sans tag, attaché dès la création du serveur ;
- l'API bloc pose des tags, et son filtre sur un tag entier est exact ;
- `deleteServer` laisse le volume, détaché en moins d'une seconde ;
- `terminate` laisse le volume, détaché en 1 à 13 s ;
- un volume détaché ne porte plus aucune référence, lu par `getVolume` ;
- l'API bloc refuse de supprimer un volume attaché, et supprime un volume
  détaché ;
- l'API instance ne liste pas un volume bloc, et répond `404` à sa suppression ;
- `server.volumes` porte le type de chaque volume.

### La taille du disque

`GameCatalogEntry`, dans `deploy/cloud-init`, gagne `diskGb` : 40 pour
`sunkenland`, mesuré à 26 Go occupés, et 30 pour `enshrouded`, mesuré à 15 Go
sur un volume de 40.

`ScalewayServerHost` reçoit à sa construction une fonction qui donne la taille
du disque pour un jeu. `apps/functions/src/container.ts` la câble sur le
catalogue.

`OpenServerRequest` ne change pas : il porte le monde, donc le jeu, que
l'adapter lit pour la première fois. Un champ de disque dans la demande ferait
entrer une ressource du fournisseur dans un port qui parle d'ouvrir un serveur
de jeu.

### L'API bloc

`libs/scaleway-compute` déclare, à côté de `InstanceApi`, la tranche de l'API
bloc dont l'adapter se sert : lister les volumes, poser des tags sur un volume,
supprimer un volume. Elle a sa traduction depuis le SDK et son faux.

Un volume y est détaché quand il ne porte aucune référence.

L'adapter filtre la liste sur un seul tag et revérifie ce qui revient, comme il
le fait pour une IP et un serveur.

`InstanceApi.createServer` gagne le volume racine, et le faux de l'API instance
rend un serveur qui en porte un.

`ScwServer.volumes` gagne le type de chaque volume, local ou bloc.

### L'image et le volume racine

Une fonction de `libs/scaleway-compute` compose la demande de création d'un
serveur : l'image de type `instance_sbs` et le volume racine `sbs_volume` de la
taille demandée. `open()` et la suite de contrat passent par elle.

`ImageResolver` rend l'image de type `instance_sbs`. Il rend aujourd'hui la
première image compatible, qui est de type `instance_local` sur `DEV1-L`.

### Ouvrir

`open()` enchaîne : réserver l'IP, créer le serveur sur son volume racine,
poser les deux tags sur ce volume, déposer le cloud-init, allumer.

Les tags se posent après la création parce que le volume naît du serveur, et
que le SDK n'offre aucun tag sur le volume d'une demande de création.

Un tag qui ne se pose pas fait échouer l'ouverture par le même chemin que les
autres appels : l'erreur nomme l'IP et son tag, et `open()` ne détruit rien.

Entre sa création et la pose de ses tags, le volume n'est atteint que par son
attachement au serveur.

### Fermer

`close()` détruit les IP et les serveurs, puis attend que plus aucun volume ne
porte le tag de la session, en supprimant par l'API bloc ceux qui se détachent.

La destruction des volumes d'un serveur par l'attachement reste. Elle supprime
un volume local par l'API instance, et un volume bloc par l'API bloc, dans la
même attente.

Un `close()` attend 30 s au plus, en tout. Un volume de la session encore là à
ce terme, tagué ou atteint par l'attachement, fait échouer `close()`, comme un
serveur qui refuse de mourir.

Pendant l'attente, le refus d'un volume encore attaché se retente. Tout autre
refus met fin à l'attente, et c'est lui que l'erreur de `close()` porte.

`apps/functions` donne à l'adapter cette borne et une fonction d'attente que
les tests remplacent. Un même adapter sert les trois Functions qui appellent
`close()` : la borne se règle sur la plus courte, `agentReport`, à 60 s.

`list()` ne change pas : un volume n'y compte pas.

### Balayer

`sweepUnclaimed()` détruit tout volume détaché qui porte le tag du système, avec
ou sans tag de session, et le compte dans `destroyed`. L'entrée nomme la
session, que `sweepEvents` range comme aujourd'hui dans un événement sans
session.

Détaché et tagué, un volume n'appartient à aucun serveur vivant.

Ce filet sert où aucun `close()` n'est rejoué : une session en service dont le
serveur disparaît chez le fournisseur, et une reprise sans monde dont le
`close()` a échoué.

Le contrat de `sweepUnclaimed()`, dans `libs/session/src/lib/ports.ts`, change :
il détruit ce qu'aucune session ne revendique, et aussi ce qui reste d'un
serveur de jeu disparu.

`stranded` porte les volumes détachés sans tag du système : ceux de la liste de
l'API instance, comme aujourd'hui, et ceux de la liste de l'API bloc.

Un refus de la liste de l'API bloc fait échouer le balayage, comme un refus de
celle de l'API instance aujourd'hui.

Un refus de suppression va dans `errors`, et le passage continue.

### Le journal et `lastError`

`apps/functions` expurge toute erreur à l'endroit où il la reçoit, avant de la
passer au domaine ou de l'écrire. Cela couvre chaque détail d'événement et
chaque `lastError` qui en découle :

- un `close()` refusé et les entrées `errors` d'un balayage, dans le watchdog,
  où `lastError` est aujourd'hui écrit brut ;
- une mise en place et un nettoyage échoués, dans `provisioning` et
  `agentReport` ;
- une mise à jour DNS refusée et une sauvegarde refusée, dans `agentReport` ;
- ce qu'un serveur de jeu rapporte de son propre échec.

L'expurgation est `sanitizeLastError`, qui borne la longueur et masque toute
chaîne de vingt caractères ou plus.

Elle masque aussi les identifiants du fournisseur : le journal qu'un membre lit
ne nomme plus la ressource qui a refusé.

`apps/functions` écrit l'erreur entière dans le journal de la plateforme, que
seul l'exploitant lit. Aucune Function n'y écrit aujourd'hui.
`WatchdogDeps`, `ProvisionDeps` et `AgentReportDeps` gagnent de quoi y écrire.

`destroyed` et `stranded` ne passent pas par l'expurgation : l'adapter les
compose, et ils ne portent aucune réponse du fournisseur.

L'adapter ne change pas : il rend ce que le fournisseur a répondu, et c'est
`apps/functions` qui décide de ce qu'un membre en lit.

### Le tarif

`tariffPerHour` garde un taux par gabarit, tout compris, calculé avec le disque
le plus grand du catalogue. L'écart avec le disque le plus petit est de
0,0013 €/h.

`DEFAULT_SETTINGS` et le semis portent deux taux :

| Gabarit | Instance | Disque, 40 Go | IP | Taux |
|---|---|---|---|---|
| `DEV1-L` | 0,04284 | 0,0052 | 0,005 | 0,05304 €/h |
| `PLAY2-MICRO` | 0,05508 | 0,0052 | 0,005 | 0,06528 €/h |

Le volume bloc y compte pour 0,000130 €/Go/h, tarif public lu le 2026-10-08, et
l'IP pour 0,005 €/h. Aucun des deux n'est recoupé par une facture.

`defaultInstanceSize` reste `DEV1-L`.

Ces taux n'atteignent qu'un système sans réglages. En production, le
commanditaire les pose à la main dans `config/settings`. D'ici là, `DEV1-L` y
garde 0,05454 €/h et un gabarit sans taux y affiche un coût nul.

Les tests épinglés sur 0,05454 €/h et sur `€0.22` suivent le nouveau taux.

### Les tests

Les tests unitaires couvrent chaque règle de `Ouvrir`, `Fermer` et `Balayer`
sur les deux faux : chaque refus, le terme de l'attente, et un `close()` et un
balayage qui suppriment le même volume.

`ImageResolver` gagne son test, sur les images que la sonde a relevées.

Chaque endroit où `apps/functions` reçoit une erreur a un test qui lui donne
une réponse chargée d'un secret, et vérifie le détail écrit, `lastError`, et la
ligne du journal de la plateforme. Le test `keeps the full detail in the
journalled event` de `provisioning.spec.ts` s'inverse.

La suite de contrat exerce sur le compte réel les appels bloc de l'adapter :
poser les tags, lister, lire les références d'un volume listé, supprimer, et
supprimer une seconde fois. Ses vérifications de volumes par l'API instance
passent à l'API bloc, et son budget se recalcule sur un volume bloc. Elle ne
démarre toujours aucune machine.

Le chemin d'un serveur démarré, de `terminate` au volume supprimé, n'est tenu au
fournisseur que par la sonde, qui mesure le fournisseur et non l'adapter.

### Ce qui change ailleurs

Les commentaires et les tests qui disent qu'un volume ne porte aucun tag, qu'il
n'est jamais détruit, ou que le balayage saute ce qui porte un tag de session,
se récrivent : dans `libs/session` (`ports.ts`, `watchdog/reconcile.ts`), dans
`apps/functions` (`watchdog-health.ts`) et dans `libs/scaleway-compute`.

Le commentaire de `sanitize-last-error.ts` cesse de dire que le détail d'un
événement garde le texte entier.

Tout appel au constructeur de `ScalewayServerHost` reçoit ses nouveaux
arguments.

`STACK.md` cesse de dire que `DEV1-L` n'a pas de repli faute de volume bloc, et
gagne le stockage bloc.

### Les risques pris

À la fusion de la story qui change `open()`, `DEV1-L` passe du disque local à
un disque réseau, sans drapeau : seul un retour arrière le défait. Sa création,
son démarrage et sa destruction sur un volume bloc sont mesurés ; aucun jeu n'y
a été chargé.

Le temps de mise en place et le délai d'abandon ont été calibrés sur le disque
local, et aucune mesure ne les revoit.

Aucun volume de 30 Go n'a été créé : la taille de `enshrouded` repose sur son
occupation mesurée sur 40.

Le taux de `DEV1-L` suppose que la ligne de facture de son disque local
disparaît sur un volume bloc. Rien ne le mesure.

Le volume s'est détaché en 1 à 13 s sur six machines, sans cause connue à
l'écart. Au-delà de 30 s, une session ordinaire passe par `FAILED` avant qu'une
nouvelle tentative la résolve.

Chaque fermeture ordinaire retient `agentReport` le temps du détachement. Tuée
pendant l'attente, la Function n'écrit rien, et la session reste `STOPPING`
jusqu'au délai de fermeture forcée.

Après un allumage qui n'aboutit pas, `onServerStateChange` n'a plus qu'une
minute pour un `close()` puis un passage du watchdog. Tuée avant d'écrire, elle
laisse la session `PROVISIONING` jusqu'au délai d'abandon.

Le watchdog appelle `close()` une fois par session à fermer, à la suite, et une
session `FAILED` dont le volume reste tagué lui coûte 30 s à chaque passage.
Une dizaine d'attentes longues remplissent ses 300 s : tué avant la fin, le
passage n'écrit ni correction, ni événement, ni battement, et ne balaie pas.

Un passage du watchdog qui balaie pendant qu'un `close()` attend, ou juste après
un `close()` échoué, détruit le volume à sa place. Le journal porte alors une
reprise sans session pour une session connue.

Un balayage peut signaler un volume que la destruction par l'attachement
supprime dans la seconde qui suit.

Rien ne mesure qu'un volume reste attaché à travers un redémarrage ou une
migration de son serveur chez le fournisseur.

La taille du disque est une constante. Une mise à jour d'un jeu qui la dépasse
bloque la restauration sans un mot, et la session attend le délai d'abandon.

L'expurgation repose sur la longueur des chaînes, pas sur ce qu'est un secret :
un mot de passe court la traverse, comme il traverse `lastError` aujourd'hui.

## Constraints

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

## Feature flag

Feature flag: none — toutes les stories sont techniques ou correctives : chacune, fusionnée seule, laisse un système complet
