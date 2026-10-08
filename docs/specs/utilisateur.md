# utilisateur

## Boundary

Ce module porte l'utilisateur : ce qui fait d'une personne un utilisateur, le
rôle d'administrateur, et le profil d'un utilisateur.

Ce qui dépend d'un monde n'appartient pas à ce module : de quels mondes un
utilisateur est membre, et comment il le devient (`monde`). Ce qu'un utilisateur
peut faire sur une session n'appartient pas non plus à ce module (`session`).

La forme de l'interface appartient à `.impeccable/DIRECTION.md`.

## Ubiquitous language

| Métier | Code | Ce que c'est |
|---|---|---|
| utilisateur | `User` | une personne qui s'est connectée à Beacon |
| administrateur | `admin` | un utilisateur qui porte le rôle d'administrateur |
| profil | — | le nom et le compte Steam d'un utilisateur |
| compte Steam | `steamId` | l'identifiant Steam qu'un utilisateur déclare |

### Ce que ce contexte emprunte, et ce qu'il en connaît

| Terme | Ce que ce contexte en connaît, et rien de plus |
|---|---|
| membre, `Member` (`docs/specs/monde.md`) | un utilisateur qui appartient à un monde |
| exploitant (`docs/specs/infrastructure.md`) | la personne qui détient le compte d'hébergement |

## Becoming a user

Une personne devient utilisateur en se connectant.

Une personne qui n'est pas connectée ne peut que se connecter, qu'elle soit déjà
utilisateur ou non.

## Administrators

Administrateur est le seul rôle qu'un utilisateur peut porter.

Seul un administrateur donne ou retire le rôle d'administrateur.

Le rôle d'administrateur se donne et se retire depuis Beacon.

Le premier administrateur fait exception : l'exploitant lui donne le rôle, hors
de Beacon.

Le dernier administrateur ne perd jamais son rôle.

## User profile

Un profil n'est lu que par son utilisateur et par les administrateurs.

Le compte Steam est demandé à l'utilisateur dès sa première connexion.

Déclarer un compte Steam n'est pas obligatoire.

Rien ne vérifie le compte Steam déclaré.

## Changelog

| batch | date | change |
|---|---|---|
