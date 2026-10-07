# Les règles d'accès vérifient l'entrée dans un monde

Un utilisateur entre dans un monde en écrivant lui-même sa fiche de membre, qui
porte le code qu'il présente. Les règles d'accès comparent ce code à celui du
monde et refusent la fiche s'ils diffèrent. Aucune Function n'intervient,
puisque aucun secret n'est en jeu.

## Considered options

Une Function qui vérifie le code a été écartée. Elle ajouterait une couche à
maintenir sans rien protéger de plus.

Un navigateur qui lit le monde pour vérifier le code avant d'écrire a été
écarté. Un utilisateur qui n'est pas membre d'un monde n'en lit rien.

## Consequences

Chaque fiche de membre porte le code présenté à l'entrée, et les membres du
monde la lisent.

Régénérer le code d'un monde ne retire aucun membre : les fiches déjà écrites
restent.
