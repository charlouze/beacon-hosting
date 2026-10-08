# Le semis ne crée aucun administrateur

Le semis de la mise en production ne crée jamais d'administrateur. L'identifiant
d'une personne n'existe qu'après sa première connexion à l'application en
production, donc rien ne peut le fournir au semis avant le premier déploiement.

## Considered options

Un semis nourri par une variable du dépôt a été écarté, parce que la séquence
est circulaire. La variable demande un identifiant de production, cet
identifiant suppose une connexion, la connexion suppose l'application déployée,
et la mise en production refuse de partir tant que la variable est vide.

Une valeur provisoire dans cette variable a été écartée aussi. Elle crée un
administrateur qui n'est personne, et le semis ne crée que ce qui manque : la
mise en production suivante ajoute le bon administrateur à côté du mauvais.

## Consequences

Le semis ne touche à aucun utilisateur.

Nommer le premier administrateur reste un geste fait à la main, après sa
première connexion.
