# jeu

## Boundary

Ce module porte **le jeu comme actif que l'administrateur entretient**, et qui
survit à tous les mondes qu'on y joue. Un jeu n'a ni ouverture ni fermeture : il
est mis à disposition une fois, rafraîchi quand l'éditeur le fait bouger, et
chaque monde s'y adosse sans rien lui ajouter.

Il couvre ce que tout jeu doit tenir pour qu'on y joue un soir : comment on
rejoint une partie de ce jeu, ce que l'administrateur fait pour le rendre
jouable et le garder à jour, et ce qu'une soirée peut perdre quand elle
s'arrête.

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
| jeu | `Game` | un jeu que Beacon sait héberger |
| dépôt d'un jeu | `game-depot` | ce que l'administrateur a mis à disposition pour qu'un jeu soit jouable, et que chaque soirée retrouve |
| rafraîchir | `update` | remplacer le dépôt d'un jeu par la version que les joueurs ont déjà |
| moyen principal | — | ce par quoi un joueur rejoint une partie quand tout va bien |
| recours | — | ce par quoi il la rejoint quand le moyen principal lui fait défaut |
| cadence de sauvegarde | — | l'écart entre deux sauvegardes que le jeu fait de lui-même, donc ce qu'une soirée qui s'arrête peut perdre au plus |

### Ce que ce contexte emprunte, et ce qu'il en connaît

| Terme | Ce que ce contexte en connaît, et rien de plus |
|---|---|
| `World` | un monde adossé à ce jeu. Ce module ignore comment un monde naît, ce qu'il devient, qui y joue, et combien il en existe par jeu |
| `Save` | ce que le jeu écrit de lui-même pour qu'un monde survive à la soirée. Ce module sait ce qu'une sauvegarde contient et quand elle est écrite ; il ignore où elle est rangée et laquelle est reprise |
| `JoinInfo` | ce que le joueur copie pour rejoindre. Ce module en exige un moyen principal et un recours ; il ignore qui le transporte, qui l'affiche, et à partir de quand une session est joignable |
| `Member` | une personne autorisée. Ce module ne distingue que l'administrateur, qui entretient les jeux, de tous les autres |

## How a game is joined

**Tout jeu offre au joueur un moyen principal de rejoindre et un recours.** Quand
le premier fait défaut, le second suffit, et la soirée ne dépend d'aucun des
deux seul. C'est une exigence faite à chaque jeu, pas une précaution d'écran.

## Making a game available

**Un jeu que seul son propriétaire peut obtenir est mis à disposition par
l'administrateur**, depuis sa propre machine, et c'est ce dépôt que chaque
soirée retrouve. Un jeu que chacun peut obtenir ne demande rien : la soirée le
prend elle-même.

**Le compte qui possède un jeu reste chez son administrateur.** Rien dans le
système ne le détient, et rien de ce qui tourne pendant une soirée ne le voit
passer.

**Ce que l'administrateur a mis à disposition, rien dans le système ne l'efface
ni ne l'altère.** Cela ne se redépose que depuis une machine qui possède le jeu,
et le perdre coûterait au mieux une soirée.

**Entretenir un jeu ne peut jamais atteindre un monde.** Mettre un jeu à
disposition ou le rafraîchir ne touche aucune sauvegarde, quelle que soit
l'erreur commise en le faisant : le monde est la seule donnée irremplaçable du
produit.

## Keeping a game up to date

**Un jeu mis à disposition ne suit pas l'éditeur de lui-même.** Les joueurs ont
une nouvelle version dès sa sortie ; le serveur, seulement quand l'administrateur
rafraîchit le dépôt.

**Le système ne garantit pas qu'un jeu hébergé soit à jour.** Un serveur en
retard sur les joueurs ne peut pas les accueillir, et cela se découvre la soirée
ouverte, en tentant de rejoindre. C'est un risque accepté, pas un oubli.

**Rafraîchir est un geste de l'administrateur, et de lui seul.** Il demande le
compte qui possède le jeu, et aucun joueur ne peut y suppléer.

> [!NOTE]
> Cette dépendance est la contrepartie de « personne n'est jamais bloqué » :
> elle ne coûte pas une soirée à qui sait la faire, mais elle ne se délègue pas.

## What an evening can lose

**Beacon ne provoque jamais une sauvegarde.** Fermer la soirée, ou la laisser
arriver à son heure, n'écrit rien de plus que ce que le jeu a déjà écrit de
lui-même.

**Quand un jeu laisse choisir sa cadence, une soirée qui s'arrête perd au plus
cinq minutes de jeu.** C'est ce qu'un joueur accepte de rejouer, et c'est dans
cette unité que la valeur se décide.

**Une sauvegarde ne garde que ce que le serveur du jeu détient.** Un jeu peut
conserver chez chaque joueur une part de ce qu'il a bâti — sa progression, son
inventaire, sa position — et cette part échappe au produit. Ce que Beacon
protège s'arrête là où s'arrête ce que le serveur écrit, et rien ne doit
laisser entendre le contraire.

## Who may do what

| Qui | Ce qu'il peut faire sur un jeu |
|---|---|
| un administrateur | mettre un jeu à disposition et le rafraîchir |
| un joueur | rien |
| un visiteur | rien du tout |

**Aucun geste sur un jeu ne passe par l'interface.** Ce qui touche un actif
partagé par tous les mondes se fait depuis la machine d'un administrateur, là où
réside le compte qui possède le jeu, et jamais depuis l'écran que les joueurs
consultent.

## Changelog

| batch | date | change |
|---|---|---|
