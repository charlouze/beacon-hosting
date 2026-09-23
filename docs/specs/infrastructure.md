# infrastructure

## Boundary

Ce module porte le compte sur lequel Beacon tourne, sa mise en place et sa
reconstruction, la mise en production, les identifiants que le système confie,
le rechargement d'un onglet périmé, et les alertes qui préviennent l'exploitant.

Il déclare le contenant, jamais le contenu.

Il ne porte ni ce qui naît et meurt avec une session, ni ce qu'un serveur de jeu
a le droit de toucher (`session`) ; ni les mondes, leurs sauvegardes et ce que
la règle de durée du stockage en retire (`monde`) ; ni qui est utilisateur ou
administrateur (`utilisateur`).

## Ubiquitous language

| Métier | Code | Ce que c'est |
|---|---|---|
| compte | — | tout ce qui survit à toutes les sessions et que le système suppose en place pour tourner |
| déclaration du compte | `WANTED` | ce que le compte doit porter, écrit dans le dépôt |
| écart | `gap` | ce qui sépare ce que le compte porte de ce qui est déclaré |
| mise en place | `deploy-setup` | le geste qui comble l'écart |
| mise en production | — | la fusion d'une pull request dans `main` |
| version en production | `rulesVersion` | la version du code que la dernière mise en production a publiée |
| exploitant | — | la personne qui détient le compte d'hébergement |

### Borrowed terms

| Terme | Ce que ce contexte en connaît, et rien de plus |
|---|---|
| `Session` (`docs/specs/session.md`) | ce qui naît et meurt dans le compte sans être déclaré. Une session tient des garanties sans attendre personne, et ce qui les tient peut cesser de tourner |
| `Save` (`docs/specs/monde.md`) | du contenu écrit dans un seau du compte. Ce contexte ne l'écrit, ne le lit ni ne le retire |

## What the account holds

Une ressource appartient au compte selon qui la crée, jamais selon qui y écrit.

La politique d'accès d'une ressource et la règle de durée qui en retire du
contenu sont des attributs de cette ressource, donc du compte.

Le compte ne comprend rien de ce qui naît et meurt avec une session.

Un enregistrement de domaine se déclare en existence, jamais en valeur.

## Setting up the account

La mise en place ne détruit aucune ressource.

La mise en place ne crée, ne modifie ni ne retire aucun contenu.

L'écart se lit sans rien modifier.

L'écart signale tout attribut déclaré qui diverge. Exception : une ressource
présente et non déclarée n'est pas signalée.

Sur un compte conforme à sa déclaration, la mise en place ne propose rien.

Rien ne se pose sur le compte sans le consentement de l'exploitant, donné geste
par geste après lecture de ce qui manque et de ce que le geste fait.

Une mise en place interrompue ou refusée en partie se signale comme partielle.

Trois gestes restent humains : la mise en production, la saisie de la valeur des
secrets, et la création de l'identifiant qui met à jour le domaine.

## Rebuilding the account

Beacon se réinstalle sur un compte vide par une suite de gestes écrits, en un
temps connu.

Tout ce que le compte porte est déclaré dans le dépôt. Exception : la valeur des
secrets et l'identifiant qui met à jour le domaine.

## Putting into production

Mettre en production, c'est fusionner une pull request dans `main`. Exceptions :
un déploiement lancé depuis un poste, qui échappe à la revue, et la publication
de l'image que Beacon construit pour ses serveurs de jeu, qui se fait par un
geste explicite.

`main` est égal à ce qui tourne, pour tout ce qui se déploie.

Il n'existe qu'un environnement.

`main` n'accepte ni poussée directe, ni fusion dont les vérifications ont échoué.

Toute pull request est vérifiée, qu'elle ait quelque chose à publier ou non.

Le résultat de la fusion est vérifié avant de partir en production.

La mise en production s'arrête au premier échec.

Les règles d'accès ne partent en production qu'une fois leurs refus vérifiés.

Une fusion qui n'a rien à publier ne met rien en production.

La vérification d'une pull request ne touche aucun compte réel.

Le système n'a aucun paramètre d'installation.

La première mise en production donne un système sans aucun utilisateur.

Une mise en production pose les réglages d'un système qui n'en a aucun, et ne
modifie jamais un réglage existant. Exception : la version en production et
l'adresse à laquelle un serveur de jeu rapporte, qu'elle réécrit à chaque fois.

## What runs is what was verified

Toute image de conteneur que le système fait tourner, construite par Beacon ou
empruntée, est désignée par une référence immuable.

Changer de version d'image est un commit.

L'image que Beacon construit pour ses serveurs de jeu ne se publie qu'après avoir
démarré.

## Credentials

Aucun identifiant d'hébergeur n'est confié à l'hébergement du code : ni au dépôt,
ni à la vérification des pull requests, ni à la mise en production.

La mise en production ne détient aucune clé de longue durée.

La valeur d'un secret du compte est saisie par un humain, et ne passe ni par un
fichier, ni par une ligne de commande, ni par l'état d'un outil.

## Open tabs follow production

Quand une mise en production change le code, tout onglet ouvert se recharge de
lui-même, au plus tard quand la mise en production s'achève.

## Warning the operator

Quand ce qui tient les garanties d'une session sans attendre personne cesse de
tourner, l'exploitant est prévenu au plus tard une heure après.

Une dépense du mois chez l'hébergeur qui dépasse 5 € prévient l'exploitant.

Ces alertes parviennent à l'exploitant, hors de l'application, et à personne
d'autre.

## Who may do what

Seul l'exploitant agit sur le compte. Aucun rôle dans Beacon n'y donne accès.

Seule la mise en production écrit la version en production et l'adresse à
laquelle un serveur de jeu rapporte.

## Changelog

| batch | date | change |
|---|---|---|
