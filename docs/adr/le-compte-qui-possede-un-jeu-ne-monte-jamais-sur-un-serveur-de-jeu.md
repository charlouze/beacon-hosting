# Le compte qui possède un jeu ne monte jamais sur un serveur de jeu

Un serveur de jeu ne reçoit jamais les identifiants du compte qui possède un
jeu. C'est un compte personnel, avec sa bibliothèque et ses moyens de paiement,
et un serveur de jeu est une machine exposée sur Internet qui exécute un binaire
que Beacon ne maîtrise pas. Un jeu que seul son propriétaire peut télécharger
est donc déposé à l'avance dans le stockage, et chaque serveur le reprend de là.

## Considered options

Télécharger le jeu depuis le serveur, avec ce compte, a été écarté. Les quelques
gigaoctets de stockage économisés ne valent pas d'exposer le compte.

Une image privée qui embarque le jeu a été écartée sur son coût : le transfert
sortant du registre aurait coûté plus cher que le serveur dédié que Beacon
remplace.

## Consequences

Le dépôt d'un jeu ne se rafraîchit que là où le compte est disponible, et jamais
depuis un serveur de jeu.

Le dépôt prend du retard sur le jeu tant que personne ne le rafraîchit.
