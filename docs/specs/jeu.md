# jeu

## Boundary

Ce module porte **le jeu comme actif que l'administrateur entretient**, et qui
survit à tous les mondes qu'on y joue. Un jeu n'a ni ouverture ni fermeture : il
est déposé une fois, rafraîchi quand l'éditeur le fait bouger, et chaque monde
s'y adosse sans rien lui ajouter.

Il couvre ce que tout jeu doit apporter pour être hébergé : comment les fichiers
dont son serveur a besoin arrivent à une machine, comment ils sont rafraîchis,
la forme qu'il donne à ce que le joueur copie pour rejoindre, et la façon dont
il écrit ce qui doit survivre à la soirée.

**Aucun jeu n'est nommé ici, et aucune règle ne se décide jeu par jeu.** Ce que
chacun fait de ces concepts est une implémentation, qui bouge avec le jeu ; ce
qui est écrit ici vaut pour celui qu'on ajoutera.

**Ce qui meurt avec un monde ou avec une soirée n'est pas à lui** : le monde,
ses sauvegardes et les pouvoirs qu'un joueur y détient sont à
[`monde`](monde.md), la partie ouverte et son échéance à
[`session`](session.md), la population des membres à `membre`, la déclaration du
compte d'hébergement à `infrastructure`.

La ligne avec `monde` tient en une phrase : **une sauvegarde est le contenu d'un
monde ; la façon dont le jeu la produit est au jeu.**

## Ubiquitous language

Les noms de code sont en anglais alors que la langue métier est le français.
La colonne du milieu porte le nom de code et, quand il en diffère, le libellé
que les joueurs lisent.

| Métier | Code, et libellé s'il diffère | Ce que c'est |
|---|---|---|
| jeu | `Game` | l'identité d'un jeu hébergé, et rien d'autre |
| dépôt des fichiers de jeu | `game-depot` | ce dont un serveur de jeu a besoin pour démarrer, déposé une fois et relu à chaque session |
| rafraîchissement | `update` | remplacer ce qui est déposé par la version courante du jeu |
| forme du point de jonction | — | quels champs un jeu donne à ce que le joueur copie pour rejoindre |
| moyen principal | — | le champ par lequel on rejoint quand tout va bien |
| recours | — | le champ par lequel on rejoint quand le moyen principal échoue |
| cadence de sauvegarde | — | le temps qui sépare deux écritures du monde par le serveur de jeu |

### Ce que ce contexte emprunte, et ce qu'il en connaît

| Terme | Ce que ce contexte en connaît, et rien de plus |
|---|---|
| `World` | un monde adossé à ce jeu. Ce module ignore comment un monde naît, ce qu'il devient, qui y joue, et combien il en existe par jeu |
| `Save` | ce que le serveur de jeu écrit de lui-même. Ce module sait ce qu'une sauvegarde contient et quand elle est produite ; il ignore où elle est rangée et laquelle est reprise |

## Ce qu'un jeu est

**Un jeu est une identité, et rien d'autre.** Ce que le système sait faire d'un
jeu — le démarrer, restaurer son monde, publier ce qu'il faut pour le rejoindre
— ne vit jamais dans cette identité. Un monde et une session la lisent sans rien
pouvoir en déduire.

**Le jeu d'un monde ne change jamais.** Un monde d'un autre jeu est un autre
monde : la sauvegarde, la façon de rejoindre et ce que les joueurs y ont bâti
en dépendent tous.

**Un jeu de plus apporte une forme de point de jonction de plus, et c'est le
coût annoncé.** Il ne retire rien aux autres et ne change rien à ce qui les
manipule.

## La forme du point de jonction

**Chaque jeu décide de ce que le joueur copie pour rejoindre : quels champs, et
sous quels libellés.** Deux jeux ne se rejoignent pas de la même façon, et rien
ne ramène leurs formes à une liste commune d'étiquettes et de valeurs.

**Une forme n'est pas toujours une adresse.** Un jeu peut se rejoindre par un
nom, par une adresse brute, par un identifiant que son serveur produit à chaque
démarrage, ou par le nom sous lequel le monde apparaît dans sa propre liste de
serveurs. Rien ne garantit qu'un jeu se rejoigne par une adresse, et supposer le
contraire est ce qui a fait naître cette notion.

**Toute forme porte un moyen principal et un recours**, et c'est une règle de
forme, pas une précaution d'écran : une forme qui n'offrirait qu'un seul chemin
laisserait la soirée dépendre de lui.

## Les fichiers d'un jeu

**Aucun identifiant qui vaut possession d'un jeu n'atteint jamais une machine de
jeu.** C'est ce qui décide par où passent ses fichiers, et rien d'autre.

**Un jeu dont les fichiers s'obtiennent librement les laisse prendre par la
machine à chaque session** ; ils n'ont alors rien à faire dans un dépôt, et rien
n'est stocké entre deux soirées.

**Un jeu dont les fichiers exigent un compte qui le possède est déposé par un
administrateur, depuis sa machine**, et la machine de jeu ne fait que les lire.

**Le dépôt d'un jeu est en lecture seule pour tout ce qui tourne pendant une
session.** Rien de ce qu'une session fabrique n'a vocation à y entrer, et ce qui
peut y écrire peut l'abîmer.

**Rien dans le système n'efface les fichiers d'un jeu.** L'outil qui les dépose
n'a aucun verbe qui détruit, et il ne connaît pas l'adresse des sauvegardes —
par construction et non par prudence : ce qu'on ne peut pas nommer, on ne peut
pas l'effacer par erreur. Des fichiers sous licence ne se redéposent que depuis
une machine qui possède le jeu, et une suppression se paierait au mieux en une
soirée perdue.

## La mise à jour d'un jeu

**Un jeu bouge, et son dépôt ne bouge pas tout seul.** Les clients se mettent à
jour d'eux-mêmes ; ce qui est déposé attend qu'un administrateur le rafraîchisse.

**Un dépôt en retard ne se découvre qu'en tentant de rejoindre**, la session déjà
ouverte et la machine déjà facturée. Rien ne l'annonce avant.

**Rafraîchir est un geste d'administrateur, et seulement le sien.** Il faut le
compte qui possède le jeu, que rien dans le système ne détient. Aucun joueur ne
peut y suppléer.

> [!NOTE]
> Cette dépendance est la contrepartie de « personne n'est jamais bloqué » :
> elle ne coûte pas une soirée à qui sait la faire, mais elle ne se délègue pas.

## Ce qu'un jeu sauvegarde, et à quelle cadence

**Le système ne provoque jamais une sauvegarde : il prend ce que le jeu a écrit
de lui-même.** Aucun jeu n'est tenu de savoir écrire à la demande, et le système
ne compte sur aucun pour le faire.

**Quand un jeu laisse régler sa cadence, elle est réglée pour qu'au plus cinq
minutes de jeu se perdent.** C'est ce qu'un joueur accepte de rejouer, et c'est
dans cette unité que la valeur se décide — jamais dans celle d'un réglage.

**Une sauvegarde ne contient que ce que le serveur du jeu détient.** Un jeu peut
garder chez chaque joueur une part de ce qu'il a bâti — sa progression, son
inventaire, sa position — et cette part est hors d'atteinte du système. Ce que
le produit protège s'arrête là où s'arrête ce que le serveur écrit, et rien ne
doit laisser entendre le contraire.

## Who may do what

| Qui | Ce qu'il peut faire sur un jeu |
|---|---|
| un administrateur de Beacon | déposer les fichiers d'un jeu et les rafraîchir, depuis sa machine |
| un joueur | rien, et rien de tout cela ne lui est offert dans l'interface |
| un visiteur | rien du tout |

**Aucun geste sur un jeu ne passe par l'interface.** Ce qui touche un actif
partagé par tous les mondes se fait depuis la machine d'un administrateur, et ne
se déclenche pas d'un écran que quelqu'un consulte depuis son canapé.

## Changelog

| batch | date | change |
|---|---|---|
