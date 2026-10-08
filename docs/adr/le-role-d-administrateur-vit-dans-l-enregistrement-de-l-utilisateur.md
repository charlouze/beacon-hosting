# Le rôle d'administrateur vit dans l'enregistrement de l'utilisateur

Le rôle d'administrateur vit dans l'enregistrement de l'utilisateur, et les
règles d'accès le relisent à chaque décision. Un administrateur change ainsi un
rôle sans Function, et la liste des administrateurs se lit et se requête.

## Considered options

Un rôle porté par la connexion a été écarté. Seul le SDK d'administration le
pose, donc une Function, et savoir qui est administrateur oblige à parcourir
tous les comptes.

Une fonction qui ajoute le rôle au moment de la connexion a été écartée. Elle
demande une Function elle aussi, et elle ne s'exécute pas quand la connexion se
renouvelle.

## Consequences

Chaque décision réservée à un administrateur coûte une lecture.

Un retrait de rôle prend effet immédiatement.
