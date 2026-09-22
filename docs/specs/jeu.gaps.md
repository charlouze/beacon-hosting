# jeu — Gaps register

## Coverage

Le code a été lu contre chaque section de la spec : le catalogue des jeux et les
deux entrées qui le peuplent (`deploy/cloud-init`), l'outil de dépôt
(`tools/game-depot`), ce que la Function de provisionnement passe à un jeu
(`apps/functions/src/provisioning.ts`), la restauration des fichiers de jeu par
le compagnon (`deploy/companion/src/lib/restore.ts`), et les composants qui
affichent une forme de point de jonction (`apps/web/src/app/join/`).

**Aucune violation n'a été trouvée sur ce périmètre** : le code s'y conforme,
et c'est un constat, pas une absence d'examen.

Les pouvoirs qu'un jeu donne à un joueur dans la partie ont été audités et ne
relèvent pas de ce module : ils meurent avec le monde, et ce qui les concerne —
y compris un défaut mesuré et son contournement en production — appartient au
registre de `monde`.

N'ont pas été audités, et rien n'est affirmé d'eux : la barrière de fumée
`docker-compose`, l'image du compagnon et son workflow de publication, et les
règles Firestore — aucun écrit de ce module ne les traverse.

## Violations

## Gaps

- **Ce qu'un jeu est** — un catalogue par jeu porte image, ports, variables et
  options de démarrage, et c'est le seul endroit du dépôt qui sait qu'un serveur
  de jeu se lance `docs/archive/specs/2026-09-02-game-hosting-design.md`.
- **Ce qu'un jeu est** — le conteneur de chaque jeu est épinglé à son empreinte
  et jamais à une étiquette mobile ; l'un d'eux tourne avec un point d'entrée
  monté et impose deux contraintes qui ne se devinent pas — l'identité système
  sous laquelle il écrit, et la reprise de son gestionnaire d'arrêt `STACK.md`.
- **La forme du point de jonction** — l'identité du monde portée par le catalogue
  du dépôt sert à vérifier le préfixe d'un identifiant de serveur avant de le
  publier, et un identifiant au mauvais préfixe ne publie rien
  `docs/archive/plans/2026-09-08-tranche-3-bis-le-second-jeu.md`.
- **Les fichiers d'un jeu** — le dépôt vit dans un seau distinct de celui des
  sauvegardes, et ce qui tient réellement la frontière est une politique de seau
  en liste blanche posée chez le fournisseur
  `docs/archive/specs/2026-09-02-game-hosting-design.md`.
- **Les fichiers d'un jeu** — les fichiers déposés voyagent en une archive unique
  par jeu, reconstruite entière à chaque dépôt, et le seau cesse d'être
  inspectable fichier par fichier
  `docs/archive/plans/2026-09-08-tranche-3-bis-le-second-jeu.md`.
- **Les fichiers d'un jeu** — le jeu dont les fichiers s'obtiennent librement les
  reprend par l'outil de sa plateforme à chaque démarrage, ce qui évite plusieurs
  gigaoctets de stockage permanent
  `docs/archive/specs/2026-09-02-game-hosting-design.md`.
- **La mise à jour d'un jeu** — rien ne compare ce qui est déposé à ce que
  l'éditeur publie, ni à l'installation locale depuis laquelle le dépôt se fait.
  Le 2026-09-21, une heure a été payée pour un serveur périmé que personne ne
  pouvait voir venir. L'ancre existe déjà et ne coûte rien à lire : le manifeste
  de la plateforme voyage dans l'archive déposée et porte un numéro de version.
- **La mise à jour d'un jeu** — le geste de rafraîchissement résout la clé
  d'administration, cherche l'installation locale du serveur dédié dans les
  bibliothèques de la plateforme, et imprime la commande exacte à lancer quand il
  ne la trouve pas `docs/archive/specs/2026-09-02-game-hosting-design.md`.
- **Ce qu'un jeu sauvegarde, et à quelle cadence** — la cadence, quand elle se
  règle, l'est par une option de ligne de commande que le manuel de l'éditeur ne
  documente pas `docs/archive/specs/2026-09-02-game-hosting-design.md`.
- **Ce qu'un jeu sauvegarde, et à quelle cadence** — le jeu qui laisse régler sa
  cadence borne lui-même son historique sur la machine à dix instantanés
  glissants, et l'index le plus élevé n'y est pas le plus récent
  `probe/RESULTS.md`.
- **Ce qu'un jeu sauvegarde, et à quelle cadence** — ce qu'on perd au plus sur un
  jeu dont la cadence ne se règle pas n'a jamais été décidé ni mesuré. Le dépôt
  applique une cadence de poussée de dix minutes, que personne n'a arrêtée.
