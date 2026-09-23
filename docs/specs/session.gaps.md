# session — Gaps register

## Coverage

**Audité** : le cœur de décision du module et tout ce qui porte la vérification
périodique, l'expurgation des messages d'erreur et les gardes du rapport du
serveur, les droits de lecture, les libellés des écrans qui montrent une session,
et le chemin par lequel une demande de fermeture part de l'écran.

**Audité aussi, sans violation trouvée** : le catalogue des jeux et les deux
entrées qui le peuplent, l'outil de dépôt, ce que la Function de
provisionnement passe à un jeu, et la restauration des fichiers de jeu par le
compagnon. Ce périmètre a été lu le 2026-09-22 pour l'adoption d'un module
`jeu` qui a été dissous depuis, et dont les règles sont revenues ici.

**Non audité**, et il faut le lire comme « on ne sait pas » et non comme « rien
n'a été trouvé » :

- **Les trois adapters vers les fournisseurs** — c'est le plus gros angle mort :
  tout ce que la spec promet sur la disparition des ressources n'est éprouvé que
  du côté qui le décide, jamais du côté qui l'exécute.
- **Ce qui tourne sur le serveur de jeu** — la remise en place du monde avant
  toute connexion, l'arrêt du jeu, la dernière sauvegarde. Trois garanties de la
  spec en dépendent et ne sont connues ici que par ce que les documents en
  disent.
- **Qui a le droit d'écrire quoi** — seuls les droits de lecture ont été
  vérifiés.
- **L'enchaînement d'un passage de vérification** — les décisions qu'il prend
  sont auditées, l'ordre dans lequel il les enchaîne ne l'est pas.

**Aucun test n'a été exécuté.** Cette pull request ne porte aucun code : une
suite verte ou rouge ne changerait ni la spec ni ce registre. Les écarts
ci-dessous sont établis par lecture.

## Violations

- **What the system guarantees when things go wrong** — ce dont le système ne
  sait plus dire à quelle session il appartenait est **signalé et jamais
  détruit**, alors que la spec exige que rien de ce qu'une session a fait naître
  ne lui survive, « y compris ce dont il ne sait plus dire à quelle session il
  appartenait ». Un test épingle explicitement le comportement actuel — *destroys
  nothing*. C'est une facture qui court tant qu'un humain ne regarde pas.

- **Extending a session** — le système fait respecter une autre règle que celle
  qu'énonce la spec. Il ne conserve que l'heure d'ouverture et l'heure de
  fermeture, **sans jamais compter les prolongations** : `ouverture + 4 h +
  une heure par prolongation` n'est donc pas calculable à partir de ce qu'il
  garde, et rien ne peut le vérifier. Ce qu'il applique à la place est une borne
  glissante — l'heure de fermeture est ramenée à *maintenant + 4 h* quand elle la
  dépasse —, qui accepte des heures que la formule ne produit jamais : dans une
  session conforme, la fermeture n'est jamais à plus d'une heure et demie de
  l'instant présent. **Deux sorties, et c'est un choix à faire** — soit l'heure
  de fermeture se déduit de l'ouverture et du nombre de prolongations, et la
  borne disparaît avec le problème qu'elle rattrapait ; soit la spec adopte la
  borne, et le lot correctif se requalifie.

- **`CLAUDE.md`, « Rien de ce qu'un membre peut lire ne révèle un secret du
  système »** — ce qui vient d'un échec d'hébergeur est expurgé avant d'atteindre
  l'écran d'une session, mais recopié tel quel dans la trace que tout membre peut
  lire. Ce qui a échoué portait ce que le système confie au serveur au moment de
  sa mise en place. **Cette entrée désigne une décision de projet et non une
  section de spec**, parce que la règle vaut pour tous les modules et ne peut donc
  vivre dans aucun ; la fuite, elle, est dans le code de celui-ci.

- **The life of a session** — une session peut passer de *en préparation* à *en
  fermeture*, transition que le diagramme ne porte pas. L'écran ne l'offre pas,
  mais le cœur de décision l'accepte et un chemin y mène. **Si c'est le code qui
  a raison** — fermer une session pendant sa mise en place est un geste que le
  produit veut — alors c'est la spec qu'il faut corriger, et le lot correctif se
  requalifie.

- **Running a game** — rien ne borne un serveur de jeu aux sauvegardes de son
  monde. La clé qu'il reçoit opère sur tout le projet, puisque l'IAM de
  l'hébergeur ne descend pas plus bas, et seul le seau des jeux porte une
  politique, celle qui le met en lecture seule. Le seau des sauvegardes n'en
  déclare aucune : un serveur compromis y atteint les sauvegardes de tous les
  mondes. Établi par lecture de `deploy/scaleway/`, sans relevé du compte réel.

## Gaps

- **What the system guarantees when things go wrong** — **aucune garantie de
  rattrapage n'a de plafond décidé.** Les valeurs connues sont toutes des
  planchers — on n'abandonne pas une mise en place avant vingt-cinq minutes, on
  ne ferme pas une session avant deux minutes de dépassement — et un plancher ne
  dit rien de ce qu'un membre ou une facture constatent. Le plafond réel dépend
  aujourd'hui de la période à laquelle le système repasse : une heure de
  fermeture qui tombe juste après un passage attend le suivant, et le repos
  porte cette période à trente minutes. **Ces chiffres sont ceux du balayage,
  jamais une exigence**, et tant qu'aucun plafond n'est décidé l'écart du code
  n'enfreint rien. La question la plus chère se pose en euros : au bout de
  combien de temps une ressource orpheline coûte-t-elle trop cher ?

- **Aucune section** — l'écran d'un monde au repos annonce la durée d'une
  session sous le libellé `Next session`, qui se lit « la session suivante » et
  ne dit rien d'une durée. Aucune section ne dit ce que cet écran doit annoncer,
  et un libellé n'est pas du ressort du glossaire : il n'existe donc aujourd'hui
  aucun document contre lequel le corriger.

- **Aucune section** — les écrans affichent un coût de session et un cumul du
  mois dont la spec ne dit plus rien, par décision. Tant qu'aucune règle ne les
  décrit, rien ne dit ce qu'ils valent, quand ils sont faux, ni ce qu'ils
  deviennent quand un gabarit n'a pas de tarif — cas qu'un administrateur crée en
  ajoutant un gabarit.

- **Joining** — chaque jeu construit sa propre forme de point de jonction
  plutôt qu'une liste commune d'étiquettes et de valeurs, et un jeu de plus
  ajoute une forme sans toucher au code qui manipule les autres
  `docs/archive/specs/2026-09-02-game-hosting-design.md`.

- **Joining** — l'identité du monde que le catalogue des jeux porte sert à
  vérifier le préfixe d'un identifiant de serveur avant de le publier, et un
  identifiant au mauvais préfixe ne publie rien
  `docs/archive/plans/2026-09-08-tranche-3-bis-le-second-jeu.md`.

- **Running a game** — un catalogue par jeu porte image, ports, variables et
  options de démarrage, et c'est le seul endroit du dépôt qui sait qu'un serveur
  de jeu se lance ; le jeu lui-même n'est qu'un identifiant
  `docs/archive/specs/2026-09-02-game-hosting-design.md`.

- **Running a game** — le conteneur de chaque jeu est épinglé à son empreinte et
  jamais à une étiquette mobile ; l'un d'eux tourne avec un point d'entrée monté
  et impose deux contraintes qui ne se devinent pas — l'identité système sous
  laquelle il écrit, et la reprise de son gestionnaire d'arrêt `STACK.md`.

- **Making a game available** — le jeu que chacun peut obtenir est repris par
  l'outil de sa plateforme à chaque démarrage du serveur, ce qui évite
  plusieurs gigaoctets de stockage permanent
  `docs/archive/specs/2026-09-02-game-hosting-design.md`.

- **Making a game available** — le dépôt vit dans un seau distinct de celui des
  sauvegardes, le serveur de jeu n'en a que la lecture, et ce qui tient
  réellement cette frontière est une politique de seau en liste blanche posée
  chez le fournisseur `docs/archive/specs/2026-09-02-game-hosting-design.md`.

- **Making a game available** — l'outil qui dépose les fichiers d'un jeu n'a
  aucun verbe qui détruit et ne connaît pas l'adresse des sauvegardes ; c'est
  pour cette raison exacte que l'outil qui manipule les mondes en est séparé
  `docs/archive/specs/2026-09-02-game-hosting-design.md`.

- **Making a game available** — les fichiers déposés voyagent en une archive
  unique par jeu, reconstruite entière à chaque dépôt, et le seau cesse d'être
  inspectable fichier par fichier
  `docs/archive/plans/2026-09-08-tranche-3-bis-le-second-jeu.md`.

- **Making a game available** — le geste de rafraîchissement résout la clé
  d'administration, cherche l'installation locale du serveur dédié dans les
  bibliothèques de la plateforme, et imprime la commande exacte à lancer quand il
  ne la trouve pas `docs/archive/specs/2026-09-02-game-hosting-design.md`.

- **Making a game available** — rien ne compare ce qui est déposé à ce que
  l'éditeur publie, ni à l'installation locale depuis laquelle le dépôt se fait.
  Le 2026-09-21, une heure a été payée pour un serveur périmé que personne ne
  pouvait voir venir. L'ancre existe déjà et ne coûte rien à lire : le manifeste
  de la plateforme voyage dans l'archive déposée et porte un numéro de version.
