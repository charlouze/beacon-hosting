# Toute image de conteneur est désignée par une référence immuable

Toute image de conteneur que le système fait tourner, construite par Beacon ou
empruntée, est désignée par une référence immuable. Le serveur d'une session
tire ainsi exactement l'image qui a été vérifiée, et on sait après coup laquelle
a tourné.

## Considered options

Une étiquette mobile a été écartée. La session de ce soir pourrait tirer une
autre image que celle qui a été vérifiée.

## Consequences

Changer de version d'image est un commit.
