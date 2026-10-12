# Un serveur de jeu met fin à sa propre mise en place

Le système croit un serveur de jeu qui déclare ne pas pouvoir finir sa mise en
place, sans rien vérifier d'autre. Le serveur est le seul à savoir pourquoi il
échoue, et attendre le délai laisse les joueurs devant un écran d'attente pour
un échec déjà connu.

Sa déclaration n'agit que sur sa propre session : le système tire le monde de
ce qu'il a lui-même enregistré à l'ouverture, jamais de ce que le serveur
déclare.

Sa déclaration décide le système à fermer le serveur.

## Considered options

Le délai d'abandon seul a été écarté. Il attend, pour un échec que le serveur
connaît dès la première minute, le temps de la mise en place la plus lente.

Une seconde vérification par le système avant d'abandonner a été écartée : rien
de ce que le système peut observer de l'extérieur ne dément un serveur qui se
dit incapable de finir.

## Consequences

Un serveur de jeu qui se déclare en échec à tort perd sa session : rien ne le
vérifie.
