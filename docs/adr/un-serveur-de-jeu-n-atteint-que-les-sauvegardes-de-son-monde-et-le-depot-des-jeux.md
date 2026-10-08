# Un serveur de jeu n'atteint que les sauvegardes de son monde et le dépôt des jeux

Un serveur de jeu écrit les sauvegardes de son monde, lit le dépôt des jeux, et
n'atteint rien d'autre du compte. C'est une machine exposée sur Internet qui
exécute un binaire que Beacon ne maîtrise pas : compromise, elle ne doit rien
donner de plus.

## Consequences

Un serveur de jeu ne détient aucun identifiant de l'hébergeur, donc il ne peut
pas se détruire lui-même.

La lecture seule du dépôt est tenue par une politique posée sur son seau, parce
que les droits de l'hébergeur ne descendent pas sous le projet.

Borner l'écriture aux sauvegardes d'un seul monde demande une frontière du même
genre, que le seau des sauvegardes ne porte pas.
