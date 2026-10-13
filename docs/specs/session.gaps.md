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

- **The life of a session** — une session peut passer de *en préparation* à *en
  fermeture*, transition que le diagramme ne porte pas. L'écran ne l'offre pas,
  mais le cœur de décision l'accepte et un chemin y mène. **Si c'est le code qui
  a raison** — fermer une session pendant sa mise en place est un geste que le
  produit veut — alors c'est la spec qu'il faut corriger, et le lot correctif se
  requalifie.

- **Running a game** — le catalogue d'un des jeux (`deploy/cloud-init`,
  `enshrouded.ts`) ne transmet à son serveur aucun des comptes Steam que les
  membres d'un monde déclarent : ce serveur démarre sans aucun admin en jeu,
  alors que l'écran propose la déclaration sur tout monde. Établi par lecture
  le 2026-10-10 ; rien ne mesure si ce jeu sait désigner un admin par un compte
  Steam.

## Gaps

- **Closing a session** — **aucune garantie de
  rattrapage n'a de plafond décidé.** Les valeurs connues sont toutes des
  planchers — on n'abandonne pas une mise en place avant vingt-cinq minutes, on
  ne ferme pas une session avant deux minutes de dépassement, on ne force pas
  une fermeture avant dix minutes — et un plancher ne
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

- **Running a game** — le jeu que chacun peut obtenir est repris par
  l'outil de sa plateforme à chaque démarrage du serveur, ce qui évite
  plusieurs gigaoctets de stockage permanent
  `docs/archive/specs/2026-09-02-game-hosting-design.md`.

- **Running a game** — le dépôt vit dans un seau distinct de celui des
  sauvegardes, le serveur de jeu n'en a que la lecture, et ce qui tient
  réellement cette frontière est une politique de seau en liste blanche posée
  chez le fournisseur `docs/archive/specs/2026-09-02-game-hosting-design.md`.

- **Running a game** — l'outil qui dépose les fichiers d'un jeu n'a
  aucun verbe qui détruit et ne connaît pas l'adresse des sauvegardes ; c'est
  pour cette raison exacte que l'outil qui manipule les mondes en est séparé
  `docs/archive/specs/2026-09-02-game-hosting-design.md`.

- **Running a game** — les fichiers déposés voyagent en une archive
  unique par jeu, reconstruite entière à chaque dépôt, et le seau cesse d'être
  inspectable fichier par fichier
  `docs/archive/plans/2026-09-08-tranche-3-bis-le-second-jeu.md`.

- **Running a game** — le geste de rafraîchissement résout la clé
  d'administration, cherche l'installation locale du serveur dédié dans les
  bibliothèques de la plateforme, et imprime la commande exacte à lancer quand il
  ne la trouve pas `docs/archive/specs/2026-09-02-game-hosting-design.md`.

- **Running a game** — rien ne compare ce qui est déposé à ce que
  l'éditeur publie, ni à l'installation locale depuis laquelle le dépôt se fait.
  Le 2026-09-21, une heure a été payée pour un serveur périmé que personne ne
  pouvait voir venir. L'ancre existe déjà et ne coûte rien à lire : le manifeste
  de la plateforme voyage dans l'archive déposée et porte un numéro de version.

- **Running a game** — un jeu que seul son propriétaire peut obtenir est déposé
  par un administrateur, depuis son poste et jamais depuis l'interface. Aucune
  règle ne dit qui doit pouvoir le faire, ni ce que le produit attend d'un jeu
  qu'on ne peut pas obtenir librement.

- **Joining** — quand une partie du point de jonction ne peut pas être publiée,
  la session continue et l'écran montre ce qui reste. Aucune règle ne dit si
  c'est voulu.

- **Joining** — chaque jeu hébergé offre aujourd'hui un moyen principal de
  rejoindre et un recours. La spec n'en fixe plus le nombre, pour ne pas exclure
  un jeu qui n'en aurait qu'un ou qui en aurait quatre.

- **Opening a session** — l'abandon au délai s'écrit sans relire la session.
  Quand un serveur de jeu déclare son échec entre la lecture et l'écriture, sur
  une session passée le délai, la mise en place est abandonnée deux fois : le
  journal des événements porte deux `ProvisioningFailed`, et l'écran l'heure du
  second abandon et la phrase du délai. Aucune règle ne dit ce qu'un abandon
  arrivé trop tard garde de ses événements. Relevé par lecture pendant le lot
  03.

- **Opening a session** — quand un serveur de jeu déclare une étape antérieure
  à celle qu'il avait déclarée, l'écran revient à cette étape, avec l'heure de
  la déclaration. Aucune règle ne dit si l'écran doit reculer, et rien ne
  mesure si le cas arrive.

- **Opening a session** — un serveur de jeu cesse d'attendre la réponse à une
  déclaration d'étape après 5 s et envoie la suivante. La première peut encore
  être traitée après la seconde : l'écran affiche alors l'étape ou l'activité
  quittée, jusqu'à la déclaration suivante. Aucune règle ne dit ce que l'écran
  fait d'une déclaration arrivée après une plus récente.

- **Aucune section** — à 390 px de large, la valeur de la plaque de l'écran
  hors service paraît rognée après un abandon. Vu le 2026-10-13 sur un rendu
  statique, sans l'enveloppe de l'application : à vérifier dans l'application.
