# Les identifiants d'hébergeur vivent dans Secret Manager

Les identifiants d'hébergeur vivent dans Secret Manager, où les Functions les
lisent, et n'entrent jamais dans GitHub. La mise en production s'authentifie par
identité fédérée vers un compte de service dédié, sans clé de longue durée. Il
n'y a ainsi qu'un coffre à protéger.

## Considered options

Les secrets GitHub ont été écartés. Ils feraient un second coffre, avec un
modèle de menace différent et une surface plus large.

Une clé de compte de service entreposée dans GitHub a été écartée. C'est une clé
de longue durée.
