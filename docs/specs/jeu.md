# jeu

## Boundary

Ce module porte **ce qu'il faut pour faire tourner un jeu sur une machine** :
ce que Beacon sait de chaque jeu hébergé, d'où viennent ses fichiers, comment
un serveur de ce jeu est lancé, et comment ce qui lui est nécessaire est mis à
disposition et tenu à jour. C'est un actif que l'administrateur entretient, et
qui survit à tous les mondes qu'on y joue.

**Ce qui meurt avec une session ou avec un monde n'est pas à lui** : quand une
machine existe, ce que le joueur copie pour rejoindre et ce qu'on en exige sont
à [`session`](session.md) ; le monde, ses sauvegardes et ce qu'on peut en
perdre sont à [`monde`](monde.md) ; la population des membres est à `membre`,
la déclaration du compte d'hébergement à `infrastructure`.

## Ubiquitous language

Les noms de code sont en anglais alors que la langue métier est le français.
La colonne du milieu porte le nom de code et, quand il en diffère, le libellé
que les joueurs lisent.

| Métier | Code, et libellé s'il diffère | Ce que c'est |
|---|---|---|
| jeu | `Game` | un jeu que Beacon sait héberger |
| catalogue des jeux | `GameCatalogEntry` | tout ce que Beacon sait d'un jeu pour faire tourner un de ses serveurs |
| dépôt d'un jeu | `game-depot` | ce qui a été mis à disposition pour qu'un jeu puisse tourner, et que chaque machine reprend |
| rafraîchir | `update` | remplacer le dépôt d'un jeu par sa version courante |

### Ce que ce contexte emprunte, et ce qu'il en connaît

| Terme | Ce que ce contexte en connaît, et rien de plus |
|---|---|
| `Session` | ce qui fait naître une machine et la détruit. Ce module lance le jeu sur la machine qu'on lui donne ; il ignore quand elle naît, combien de temps elle vit et pourquoi elle meurt |
| `World` | un monde dont une machine fait tourner le jeu. Ce module ignore comment un monde naît, qui y joue et ce qu'il devient |
| `Save` | l'état d'un monde, que le serveur d'un jeu lit au démarrage et réécrit de lui-même. Ce module sait où chaque jeu l'attend sur la machine ; il ignore où elle est rangée entre deux sessions, laquelle est reprise et ce qu'on peut en perdre |
| `JoinInfo` | ce que le joueur copie pour rejoindre. Chaque jeu en fournit la forme ; ce module ignore qui la transporte, qui l'affiche et ce qu'on exige d'elle |
| `Member` | une personne autorisée. Ce module ne distingue que l'administrateur, qui entretient les jeux, de tous les autres |

## Running a game

**Beacon ne modifie aucun jeu.** Il le lance tel qu'il est publié, et n'y
ajoute que ce qu'il faut pour le démarrer et le relier au reste du produit. Le
jeu n'est pas la valeur du produit, et le refaire priverait chaque jeu des
corrections de ceux qui le publient.

**Aucune machine de jeu ne détient le compte qui possède un jeu.** Ce qu'une
machine reçoit pour lancer un jeu ne lui permet jamais d'agir au nom de ce
compte.

## Making a game available

**Un jeu que chacun peut obtenir, la machine le prend elle-même.** Rien n'est
mis à disposition pour lui, et rien de lui n'est gardé entre deux sessions.

**Un jeu que seul son propriétaire peut obtenir est mis à disposition une fois,
et chaque machine le reprend de là.** C'est ce dépôt qui fait tourner le jeu,
et c'est lui qu'on rafraîchit quand le jeu change.

## Who may do what

| Qui | Ce qu'il peut faire sur un jeu |
|---|---|
| un administrateur | mettre un jeu à disposition et le rafraîchir |
| un joueur | rien |
| un visiteur | rien du tout |

**Aucun geste sur un jeu ne passe par l'interface que les joueurs consultent.**

## Changelog

| batch | date | change |
|---|---|---|
