# Chaque jeu apporte sa propre forme de point de jonction

Le point de jonction a une forme par jeu. Le domaine la transporte sans la lire,
et l'écran l'affiche. Deux jeux ne se rejoignent pas par les mêmes informations :
ce qu'ils ont en commun est ce qu'on copie pour rejoindre, pas une adresse.

## Considered options

Une liste commune d'étiquettes et de valeurs a été écartée. Elle aurait déplacé
dans l'écran la connaissance de chaque jeu, sans la faire disparaître.

## Consequences

Ajouter un jeu ajoute une forme, et ce qu'il faut à l'écran pour l'afficher.

Le domaine sait seulement si le point de jonction d'une session existe.
