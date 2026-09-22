# session — Gaps register

## Coverage

**Audité** : le cœur de décision du module et tout ce qui porte la vérification
périodique, l'expurgation des messages d'erreur et les gardes du rapport de la
machine, les droits de lecture, les libellés des écrans qui montrent une session,
et le chemin par lequel une demande de fermeture part de l'écran.

**Non audité**, et il faut le lire comme « on ne sait pas » et non comme « rien
n'a été trouvé » :

- **Les trois adapters vers les fournisseurs** — c'est le plus gros angle mort :
  tout ce que la spec promet sur la disparition des ressources n'est éprouvé que
  du côté qui le décide, jamais du côté qui l'exécute.
- **Ce qui tourne sur la machine de jeu** — la remise en place du monde avant
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
  soirée conforme, la fermeture n'est jamais à plus d'une heure et demie de
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

## Gaps

- **What the system guarantees when things go wrong** — **aucune garantie de
  rattrapage n'a de plafond décidé.** Les valeurs connues sont toutes des
  planchers — on n'abandonne pas une mise en place avant vingt-cinq minutes, on
  ne ferme pas une session avant deux minutes de dépassement — et un plancher ne
  dit rien de ce qu'un joueur ou une facture constatent. Le plafond réel dépend
  aujourd'hui de la période à laquelle le système repasse : une échéance qui
  tombe juste après un passage attend le suivant, et le repos porte cette période
  à trente minutes. **Ces chiffres sont ceux du balayage, jamais une exigence**,
  et tant qu'aucun plafond n'est décidé l'écart du code n'enfreint rien. La
  question la plus chère se pose en euros : au bout de combien de temps une
  ressource orpheline coûte-t-elle trop cher ?

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
