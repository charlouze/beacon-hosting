# Chaque sauvegarde a sa clé, et l'origine vient en tête

Chaque sauvegarde est rangée sous une clé qui n'est qu'à elle, formée de son
origine, de l'identifiant de son monde, puis de son instant. Aucune écriture ne
peut ainsi en recouvrir une autre, et une règle de durée du stockage, qui filtre
par préfixe, traite chaque origine à part.

## Considered options

Une clé par monde, réécrite à chaque sauvegarde, a été écartée. Une sauvegarde
fautive remplacerait la bonne, au lieu de s'ajouter à côté d'elle.

L'identifiant du monde en tête de clé a été écarté. La règle de durée filtrant
par préfixe, il aurait fallu en poser une par monde, à chaque création.

Une règle de durée qui filtre par étiquette aurait permis le monde en tête. Elle
a été écartée parce que rien n'établit que le stockage la propose.

## Consequences

Changer le format d'une clé rend illisibles les sauvegardes déjà rangées, tant
qu'elles ne sont pas déposées de nouveau.

Le format d'une clé est écrit à trois endroits qui ne se voient pas : ce qui
range une sauvegarde, ce qui refuse à une session d'en enregistrer une qui n'est
pas la sienne, et la règle de durée du stockage.
