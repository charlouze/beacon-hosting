# Chaque geste sur une session laisse un événement dans un journal

Chaque changement d'état d'une session écrit un événement au passé, avec son
auteur, dans la même écriture que l'état. Aucun code ne modifie ni ne supprime
un événement. Le journal permet de savoir après coup qui a ouvert, prolongé ou
fermé une session, et ce que le système a détruit de lui-même.

## Considered options

Un état déduit du journal a été écarté. L'état d'une session se lit dans son
enregistrement, et aucun code ne se déclenche sur un événement : le journal sert
à l'audit, et à rien d'autre.

## Consequences

Un changement d'état qui n'écrit pas son événement est un défaut.

Le détail d'un événement est lu par des utilisateurs, donc il est borné et
expurgé comme tout ce qu'ils lisent.

Le nom de qui agit voyage dans l'événement, parce que le profil d'un utilisateur
n'est pas lisible par les autres.
