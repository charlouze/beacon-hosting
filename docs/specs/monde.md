# monde

## Boundary

Ce module couvre le monde : ce qu'un groupe partage et qui survit aux sessions.
Il couvre sa création, son identité, ses membres et la façon d'y entrer, ses
sauvegardes, ce qu'il laisse voir et qui peut agir dessus.

Il ne couvre ni ce qui naît et meurt avec une session, ni les jeux et ce qu'il
faut pour les faire tourner (`session`), ni les utilisateurs et ce qu'on lit
d'eux (`utilisateur`), ni la déclaration du compte et le déploiement
(`infrastructure`), ni la forme de l'interface (`.impeccable/DIRECTION.md`).

## Ubiquitous language

| Term | Code | Definition |
|---|---|---|
| monde | `World` | ce qu'un groupe partage et qui survit à ses sessions |
| identifiant du monde | `worldId` | ce qui fait qu'un monde est celui-là et pas un autre |
| nom du monde | `name` | ce sous quoi ses membres reconnaissent un monde |
| membre d'un monde | `Member` | un utilisateur qui appartient à ce monde |
| code d'invitation | `inviteCode`, affiché `Invite link` | le secret qui fait entrer dans un monde, porté par le lien qu'on s'envoie |
| entrer dans un monde | `join` | présenter le code d'un monde pour en devenir membre |
| quitter un monde | `leave` | cesser d'être membre d'un monde |
| sauvegarde | `Save` | l'état d'un monde à un instant |
| sauvegarde automatique | `auto` | une sauvegarde produite pendant une session, à la cadence du jeu |
| sauvegarde de fin de session | `pre-shutdown` | la sauvegarde produite quand une session se ferme |
| sauvegarde déposée | `deposited` | une sauvegarde ajoutée à un monde par un dépôt |
| dernière sauvegarde | — | la sauvegarde arrivée le plus récemment dans son monde, produite par une session ou déposée |
| créer un monde | `create` | faire entrer un monde dans le système |
| déposer une sauvegarde | `deposit` | ajouter à un monde une sauvegarde venue d'ailleurs |
| récupérer une sauvegarde | `retrieve` | ressortir une sauvegarde d'un monde hors du système |
| admin en jeu | — | un utilisateur à qui le jeu d'un monde permet de commander la partie |

### Borrowed terms

| Term | What this module knows of it |
|---|---|
| `Game` (`docs/specs/session.md`) | le jeu d'un monde, qui ouvre les sauvegardes de ce monde et fixe la cadence de ses sauvegardes automatiques |
| `Session` (`docs/specs/session.md`) | ce qui s'ouvre sur un monde et y produit des sauvegardes jusqu'à sa fin |
| `User`, `admin` (`docs/specs/utilisateur.md`) | une personne qui s'est connectée à Beacon ; un administrateur est un utilisateur qui a ce rôle |
| compte Steam, `steamId` (`docs/specs/utilisateur.md`) | l'identifiant du compte Steam qu'un utilisateur déclare |

## A world's identity and lifetime

Seul un administrateur crée un monde.

L'identifiant d'un monde et son jeu sont fixés à sa création, et rien ne les
change ensuite.

Les membres d'un monde et les administrateurs peuvent le renommer.

Rien dans le système ne supprime un monde.

## Belonging to a world

On ne devient membre d'un monde qu'en présentant son code d'invitation.

Inviter quelqu'un ne demande pas de connaître son identité dans le système.

Un code mis hors d'usage et un code faux produisent le même refus.

Les membres d'un monde et les administrateurs peuvent régénérer son code, ce qui
met hors d'usage tous les liens qui portaient l'ancien.

Un membre peut quitter un monde.

Seul un administrateur retire un membre d'un monde.

Seuls les membres d'un monde et les administrateurs voient son nom, son jeu,
ses membres et son code d'invitation.

Les admins en jeu d'un monde sont ses membres qui ont déclaré leur compte Steam,
et eux seuls.

## A world's saves

Une sauvegarde appartient à un seul monde.

Une sauvegarde n'en remplace jamais une autre.

Une sauvegarde n'est jamais modifiée.

Une sauvegarde automatique est supprimée sept jours après avoir été produite.
Exception : elle n'est pas supprimée tant qu'elle est la dernière sauvegarde de
son monde.

Une sauvegarde de fin de session ou déposée n'est jamais supprimée.

## Depositing a save

Seul un administrateur dépose une sauvegarde dans un monde.

Un dépôt refuse une sauvegarde que le jeu du monde n'ouvrirait pas comme ce
monde.

## Retrieving a save

Seul un administrateur récupère une sauvegarde.

Récupérer une sauvegarde rend par défaut la dernière d'un monde, et à la demande
n'importe laquelle.
