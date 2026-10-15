# Tour de la vérification préalable — 2026-10-15

Trace durable du tour qui pose les mots et la forme de la vérification
préalable, livrée par la story 2 du lot 04. Ouvrir `index.html` pour voir la
planche ; ce fichier dit ce qui a été décidé et pourquoi.

Le monde visuel ne rejoue pas : **The Departure Board**, contrat dans
[`../../DIRECTION.md`](../../DIRECTION.md), et la forme C de l'attente,
décidée dans [`../progress/`](../progress/README.md).

| Fichier | Contenu |
|---|---|
| `phone.html` | En 390 px : la vérification en cours avec et sans filet, l'écran après un abandon sans cause, l'écran de fermeture d'aujourd'hui et sa variante |

## Décidé

| Question | Décision | Ce qui a été écarté |
|---|---|---|
| Pendant la vérification | **P1** : `Preflight check` à la place du rang, sous le libellé `Before the first step`, puis `since` et l'heure ; les quatre longueurs du filet restent, toutes à venir et immobiles | **P2**, sans filet, dont la mise en page saute quand la première étape arrive |
| La ligne sous `Close it now` | **Aucune** pendant la vérification : la première heure n'y est pas due | `No server yet: closing now costs nothing.`, vrai mais contredit par la tuile du coût de la session, que le lot ne touche pas |
| Après un abandon à la vérification, sans cause | `Where it stopped, at` et l'heure, puis **`Preflight check · before the first step`**, sans rang ; le texte du dessus dit `at the same place twice` | Le rang et le nom de la première étape, qui n'a jamais commencé |
| Une session fermée pendant la vérification | **F0** : l'écran de fermeture ne change pas | **F1**, `It was still being checked: no server was started, so there is nothing to destroy and nothing to save.` |

F0 garde deux phrases fausses, la machine détruite et la sauvegarde à sa
cadence, le temps que la vérification finisse : quelques millisecondes, une à
deux secondes quand elle lira la version chez l'éditeur, et jusqu'au
rattrapage de la surveillance si la Function tombe. Les corriger demande que
l'écran de fermeture sache qu'aucune étape n'a commencé, ce que rien ne lui
donne aujourd'hui.

`Preflight check` est le mot de tableau de la vérification, et il ne diffère
pas du nom que le code porte, `preflight` : le glossaire n'a pas à l'afficher.

Les causes d'un abandon à la vérification arrivent avec la story qui fait
échouer la vérification ; leurs mots passent par un autre tour.
