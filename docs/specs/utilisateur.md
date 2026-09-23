# utilisateur

## Boundary

Ce module porte l'utilisateur : ce qui fait d'une personne un utilisateur, le
rôle d'administrateur, et son profil.

Ce qui dépend d'un monde n'est pas à lui : de quels mondes un utilisateur est
membre, et comment il le devient (`monde`). Ce qu'un utilisateur peut faire sur
une session n'est pas à lui non plus (`session`).

La forme de l'interface appartient à `.impeccable/DIRECTION.md`.

## Ubiquitous language

| Métier | Code | Ce que c'est |
|---|---|---|
| utilisateur | `User` | une personne qui s'est connectée à Beacon |
| administrateur | `admin` | un utilisateur qui donne et retire le rôle d'administrateur |
| profil | — | ce que le système sait d'un utilisateur |
| compte Steam | `steamId` | l'identifiant du compte Steam d'un utilisateur |

### Ce que ce contexte emprunte, et ce qu'il en connaît

| Terme | Ce que ce contexte en connaît, et rien de plus |
|---|---|
| membre, `Member` (`docs/specs/monde.md`) | un utilisateur qui appartient à un monde |

## Becoming a user

Une personne devient utilisateur en se connectant.

Une personne qui ne s'est pas connectée ne peut que se connecter.

## Administrators

Un utilisateur est administrateur ou ne l'est pas, et il n'existe aucun autre
rôle.

Seul un administrateur donne ou retire ce rôle, depuis l'application, et le
retrait prend effet immédiatement.

Le dernier administrateur ne perd jamais son rôle.

Le premier administrateur est nommé par un geste humain, hors du système.

## User profile

Le profil d'un utilisateur porte son nom et son compte Steam.

Un profil n'est lu que par son utilisateur et par les administrateurs.

Le compte Steam est demandé à l'utilisateur dès son premier passage.

Rien ne vérifie le compte Steam déclaré.

## Changelog

| batch | date | change |
|---|---|---|
