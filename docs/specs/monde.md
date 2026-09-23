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
| sauvegarde automatique | `auto` | une sauvegarde faite pendant une session, à la cadence du jeu |
| sauvegarde de fin de session | `pre-shutdown` | la sauvegarde faite quand une session se ferme |
| créer un monde | `create` | faire entrer un monde dans le système |
| déposer une sauvegarde | `deposit` | ajouter à un monde une sauvegarde venue d'ailleurs |
| récupérer une sauvegarde | `retrieve` | ressortir une sauvegarde d'un monde hors du système |
| admin en jeu | — | un compte auquel un jeu permet de commander la partie elle-même |

### Borrowed terms

| Term | What this module knows of it |
|---|---|
| `Game` (`docs/specs/session.md`) | le jeu d'un monde, dont ce module ne connaît que l'identité |
| `Session` (`docs/specs/session.md`) | ce qui s'ouvre sur un monde et y produit des sauvegardes jusqu'à sa fin |
| `User`, `admin` (`docs/specs/utilisateur.md`) | une personne qui s'est connectée à Beacon ; un administrateur est un utilisateur qui a ce rôle |

## A world's identity and lifetime

Seul un administrateur crée un monde.

L'identifiant d'un monde et son jeu sont fixés à sa création, et rien ne les
change ensuite.

Les membres d'un monde et les administrateurs peuvent le renommer.

Rien dans le système ne supprime un monde.

## Belonging to a world

On ne devient membre d'un monde qu'en présentant son code d'invitation.

Inviter quelqu'un ne demande pas de connaître son identité dans le système.

Un code refusé ne dit pas pourquoi : un code remplacé et un code faux produisent
le même refus.

Les membres d'un monde et les administrateurs peuvent régénérer son code, ce qui
met hors d'usage tous les liens qui portaient l'ancien.

Un membre peut quitter un monde. Seul un administrateur en retire un membre.

Seuls les membres d'un monde et les administrateurs le lisent.

Les admins en jeu d'un monde sont tous ses membres, et eux seuls.

## A world's saves

Une sauvegarde n'appartient qu'à un monde.

Une sauvegarde n'en remplace jamais une autre.

Une sauvegarde n'est jamais modifiée une fois faite.

Une sauvegarde automatique est gardée sept jours, puis supprimée. Exception : la
dernière sauvegarde d'un monde n'est jamais supprimée.

Une sauvegarde de fin de session ou déposée n'est jamais supprimée.

## Depositing a save

Seul un administrateur dépose une sauvegarde dans un monde.

Déposer une sauvegarde se fait sans recréer le monde.

La sauvegarde déposée devient la dernière du monde.

Un dépôt refuse une sauvegarde que le jeu du monde n'ouvrirait pas comme ce
monde.

## Retrieving a save

Seul un administrateur récupère une sauvegarde.

Récupérer une sauvegarde rend par défaut la dernière d'un monde, et à la demande
n'importe laquelle.

## Changelog

| batch | date | change |
|---|---|---|
