# La mise en place du compte est un outil sans état

La mise en place du compte est un outil du dépôt, sans état : il lit ce que le
compte porte, calcule l'écart avec ce qui est déclaré et le comble, sans tenir
de registre de ce qu'il a créé. Il détruit une ressource quand converger le
demande, jamais une ressource qui porte du contenu. Relancé, il arrive ainsi
toujours au même compte, et aucun changement de nom n'emporte un seau et les
mondes qu'il contient.

## Considered options

Terraform et OpenTofu ont été écartés. Ils tiennent un état, remplacent toute
ressource renommée, seau compris, et la seule protection du seau des sauvegardes
aurait été une garde à ne jamais oublier.

Un outil qui ne détruit rien a été écarté. Il ne converge pas quand une
ressource ne se corrige qu'en la recréant.

Faire déclarer l'application par le même outil a été écarté. La CLI Firebase la
publie déjà à la fusion, et deux mécanismes sur le même objet se le disputent.

## Consequences

L'outil déclare le compte, et la CLI Firebase publie l'application : règles
d'accès, index, Functions, hébergement et tâche planifiée. Aucun des deux ne
touche à ce que l'autre porte.
