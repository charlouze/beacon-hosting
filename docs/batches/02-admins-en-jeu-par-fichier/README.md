---
status: closed
---

# 02 — Les admins en jeu passent par un fichier

## Scope

Un serveur `sunkenland` démarre avec tous les admins en jeu que son monde
désigne, quel que soit leur nombre.

Le lot prend en charge une entrée de `docs/specs/session.gaps.md`, réservée par
cette pull request :

- **Violations**, `Running a game` : les identifiants que les membres d'un monde
  déclarent sont transmis au serveur de jeu sous une forme qu'il refuse, et il
  démarre alors sans aucun admin en jeu.

Le lot ne modifie aucune donnée en production. Le compte Steam retiré à la main des
membres d'un monde y revient par un geste du commanditaire, une fois la story
déployée.

Le lot ne désigne aucun joueur banni.

Le lot ne touche que `sunkenland`. `enshrouded` ignore toujours les comptes
Steam déclarés.

## Spec delta

none — `Running a game`, dans `docs/specs/session.md`, promet déjà qu'un serveur
de jeu démarre avec les admins en jeu que son monde désigne.

## Technical design

### Ce que le jeu fait, mesuré

`probe/RESULTS.md`, section A, porte le relevé du 2026-10-10 sur le serveur
dédié `0.8.93`, et celui du 2026-09-17 en production pour le premier de ces
faits. Le design repose sur eux :

- `-adminSteamIDs` suivi de deux identifiants joints par une virgule est refusé,
  et le serveur démarre sans aucun admin ;
- `AdminSteamIDs.txt`, dans le dossier du monde, est lu sans l'argument ;
- le fichier porte un identifiant par ligne, et le compte de la deuxième ligne
  est admin ;
- un LF en fin de chaque ligne suffit ;
- le fichier est lu à l'arrivée d'un joueur ;
- le serveur ne modifie pas le fichier ;
- un point d'entrée monté dans l'image du jeu tourne sous l'uid 7000, celui à
  qui la restauration rend le dossier du monde ;
- sous cet uid, `rm -f` puis une écriture passent, y compris sur un fichier en
  lecture seule ou possédé par root, que l'écrasement seul ne remplace pas ;
- dans un dossier du monde resté à root, ni création ni suppression ne passent.

### Le point d'entrée

`startSh`, dans `deploy/cloud-init/src/lib/sunkenland.ts`, cesse de passer
`-adminSteamIDs` : `adminOption` disparaît.

Après la ligne `beacon: opening`, donc une fois le dossier du monde dérivé et
son guid vérifié, et avant de lancer le serveur, le script supprime
`AdminSteamIDs.txt` de ce dossier, puis l'écrit : un identifiant par ligne,
chaque ligne finie par un LF. La suppression d'abord écarte un fichier que
l'écrasement seul ne remplace pas.

Quand aucun membre n'a déclaré de compte Steam, le script supprime le fichier
et n'écrit rien. Un fichier absent est l'état d'un serveur sans admin
aujourd'hui ; rien ne mesure ce que le jeu fait d'un fichier vide.

Une sauvegarde automatique porte le fichier, donc un dossier restauré peut
porter celui d'une session précédente : le script le récrit ou le supprime à
chaque démarrage, sans le lire.

Une suppression ou une écriture refusée arrête le script avant le lancement du
serveur, par `set -e`. Le conteneur redémarre alors en boucle, aucun point de
jonction n'est publié, et la session est abandonnée au délai de mise en place.

Le script imprime le nombre d'identifiants, zéro compris, jamais les
identifiants.

À l'arrêt, `_terminate` supprime le fichier une fois le serveur arrêté, après
`wineserver -k -w`, pour que la sauvegarde de fin de session, que rien ne
supprime, ne garde pas les comptes Steam des membres. C'est un mieux et non une
garantie : il tient à ce que le compagnon archive à la fin de son délai de
grâce de 180 s, plus long que les 90 s d'arrêt du conteneur, et aucun contrat
entre les deux ne porte cet écart. Un commentaire le dit à chacun des deux
endroits.

Une suppression refusée à l'arrêt n'empêche pas l'arrêt : `_terminate` la rend
non fatale, pour que `set -e` ne coupe pas la suite de l'arrêt.

Les identifiants restent rendus dans le script à la composition du cloud-init.
`BootRequest.adminSteamIds`, ce que `refuseAnythingButDigits` refuse et ce que
`apps/functions` passe au catalogue ne changent pas.

### Les tests

`sunkenland.ts` exporte le fragment qui pose le fichier, rendu pour une liste
d'identifiants, comme il exporte déjà `SERVERID_FILTER`. Le fragment lit le
dossier du monde dans `WORLD_DIR`, que le script pose en tête, et `world`, que
la dérivation pose. `sunkenland.spec.ts` l'exécute tel quel sur un vrai dossier, ces deux
variables posées par le test, sous `set -euo pipefail` :

- deux identifiants donnent deux lignes finies par un LF, dans un dossier dont
  le nom porte un espace et une apostrophe ;
- un fichier laissé par une session précédente est récrit ;
- sans identifiant, un fichier présent est supprimé, et un fichier absent ne
  fait pas échouer le script ;
- sans identifiant, un dossier nommé `AdminSteamIDs.txt`, que le script ne
  peut pas supprimer, l'arrête avec un code de sortie non nul ;
- la sortie porte le nombre d'identifiants, zéro compris, et aucun identifiant.

Un test sur le script rendu entier vérifie qu'il contient le fragment exporté,
après la vérification du guid et avant la ligne qui lance le serveur, et que
`_terminate` supprime le fichier après `wineserver -k -w`, sous une forme qui
n'arrête pas le script.

Les tests de la dérivation du monde ne changent pas : ils s'arrêtent à
`beacon: opening` et n'exécutent pas le fragment.

Une écriture refusée après une suppression réussie, la suppression d'un
fichier en lecture seule et la suppression à l'arrêt n'ont pas de test qui les
exécute : rien ne produit les deux premières de la même façon sur un poste
Windows et sur un serveur de jeu, et `_terminate` ne tourne qu'avec le serveur.
La sonde a mesuré la deuxième, et le refus d'une création dans un dossier resté
à root ; l'arrêt du script sur une écriture refusée ne repose que sur `set -e`.

Aucun script rendu ne contient plus `-adminSteamIDs`, pour une liste vide, un
identifiant ou plusieurs. Les trois tests qui épinglent l'argument dans
`sunkenland.spec.ts` suivent. Des deux de `provisioning.spec.ts`, l'un vérifie
que le rendu porte l'identifiant déclaré, sans épingler sous quelle forme, et
l'autre qu'il ne porte aucune suite isolée de dix-sept chiffres quand personne
n'a déclaré de compte.

Le test de `enshrouded.spec.ts` qui épingle l'absence de l'argument vérifie à la
place que le rendu ne porte aucun des identifiants déclarés.

Le test de fumée n'exécute pas ce script : son conteneur de jeu est un bouchon.

### Ce qui change ailleurs

Les commentaires que le changement rend faux se récrivent, dont ceux qui
nomment `-adminSteamIDs`, une option ou la ligne de lancement du jeu, ceux qui
disent que Beacon n'écrit rien dans un dossier de sauvegarde, et ceux qui
présentent `_terminate` comme l'arrêt de l'image amont, avec le titre du test
qui l'épingle. Ils sont dans
`sunkenland.ts`, `sunkenland.spec.ts`, `catalog.ts`, `catalog.spec.ts`,
`catalogue-fixtures.spec-helper.ts`, `enshrouded.spec.ts`,
`apps/functions/src/provisioning.ts`,
`apps/functions/src/provisioning.spec.ts`,
`libs/membership-record/src/lib/admin-membership.ts`, son test, et
`apps/web/src/app/session/steam-declaration.component.ts`.

Le commentaire de `deploy/companion/src/lib/config.ts` qui interdit d'écrire
dans un monde reste : il porte sur le compagnon, qui n'y écrit toujours pas.

La trace de `deploy/companion/smoke/serverid-extraction.sh` reste : c'est un
relevé d'un démarrage réel.

`probe/sunkenland/start.sh` ne change pas.

### Les risques pris

La mesure des droits est locale, sur un volume Docker : ni le volume bloc d'un
serveur de jeu réel, ni les modes que l'archive du compagnon rend au dossier
restauré n'y sont. Le dossier appartient à `SERVER_OWNER`, que le dépôt fixe,
et le script tourne sous l'utilisateur de l'image empruntée, épinglée par son
empreinte : rien dans le dépôt ne vérifie que les deux sont le même.

Le test de fumée n'exécutant pas ce script, sa première exécution réelle est la
première session ouverte après la fusion. Un refus y coûte la session, et sa
cause ne se lit que dans le journal du conteneur, sur une machine détruite
ensuite. Si la cause dure, aucune session de ce monde, ou de ce jeu, ne s'ouvre
jusqu'à une fusion qui la corrige. Le seul refus mesuré est un dossier du monde
resté à root, où le serveur ne peut pas non plus écrire ses sauvegardes.

Le conteneur relance le script si le serveur tombe en cours de session. Un
refus à ce moment laisse la session en service, son point de jonction publié,
sans serveur derrière.

Rien ne mesure que `_terminate` supprime le fichier avant que le compagnon
archive. Le fichier reste dans la sauvegarde de fin de session quand le
conteneur est tué au terme de son délai d'arrêt, quand l'arrêt arrive alors
que le serveur est tombé et que le conteneur n'est pas encore relancé, et
quand la session est fermée avant que le serveur ait annoncé son identifiant :
le compagnon archive alors sans attendre.

La mesure porte sur deux identifiants, pour des mondes de trois ou quatre
membres, et sur la version `0.8.93`, qui peut ne pas être celle du dépôt des
jeux.

Les comptes Steam des membres d'un monde voyagent dans ses sauvegardes
automatiques, et dans celle qu'un administrateur récupère si c'en est une.

Un retour à un script qui ne gère pas le fichier, sur un monde restauré d'une
sauvegarde automatique, laisse le fichier de la dernière session, que le
serveur continue de lire : un membre retiré du monde resterait admin en jeu.

Un `AdminSteamIDs.txt` déposé à la main dans une sauvegarde est écrasé au
premier démarrage.

Un membre qui déclare son compte Steam pendant une session n'est admin qu'à la
suivante, comme aujourd'hui.

Rien ne mesure ce que le serveur fait d'un fichier modifié pendant qu'il tourne.
Le script ne l'écrit qu'avant le lancement.

Une version du jeu qui cesserait de lire le fichier laisserait le serveur sans
admin, sans rien dans son journal avant l'arrivée d'un joueur.

## Constraints

none

## Feature flag

Feature flag: none — lot correctif, il rétablit ce que la spec promet déjà
