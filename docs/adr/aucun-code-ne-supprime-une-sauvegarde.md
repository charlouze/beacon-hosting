# Aucun code ne supprime une sauvegarde

Aucun code du projet ne supprime une sauvegarde, et le port par lequel le code
atteint les sauvegardes n'a pas de verbe pour le faire. Seule une règle de durée
du stockage en retire. Une erreur de code ne peut ainsi pas détruire un monde.

## Considered options

Un élagage écrit dans le code a été écarté. Il donnerait à tout ce qui passe par
le port le moyen de supprimer.

## Consequences

La règle de durée filtre par préfixe et ne sait pas quelle sauvegarde est la
dernière d'un monde. Garder la dernière sauvegarde d'un monde quand elle est
automatique demande de la mettre hors de portée de cette règle, sans rien
supprimer.
