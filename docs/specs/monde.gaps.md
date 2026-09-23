# monde — Gaps register

## Coverage

**Audité, ligne à ligne** : `libs/session/src/lib/world.ts` en entier — l'agrégat
`World`, ses bornes et ses quatre décisions ; le bloc `worlds/{worldId}` de
`firestore.rules`, sa sous-collection `players`, son `server/current` et la
lecture par groupe de collection qui sert « mes mondes » ; le port `SaveStore`
de `libs/session/src/lib/ports.ts`, pour vérifier qu'aucun verbe n'y supprime ;
`tools/world-depot/src/adopt.ts`, `lib/choose.ts` et `lib/world-birth.ts`.

**Non audité, et c'est « on ne sait pas » et non « rien trouvé »** :
`libs/session-record` en entier — `client-session.ts`, `world-state.ts`,
`save-records.ts` —, qui est toute la traduction entre le modèle et Firestore et
le plus gros angle mort de cet audit ; `libs/scaleway-storage` — `keys.ts` et
`scaleway-save-store.ts` —, donc le rangement réel des sauvegardes et le
cloisonnement d'un monde à l'autre ; les écrans de `apps/web` pour les mondes,
la liste et l'entrée par un lien ; ce que `apps/functions` lit d'un monde au
provisionnement et au rapport de l'agent ; `deploy/cloud-init`, où se désignent
les admins en jeu ; et dans `tools/world-depot`, `world-archive.ts`,
`world-identity.ts`, `admin-firestore.ts`, `admin-store.ts`, `bucket.ts` et
`args.ts`.

**Aucun test n'a été exécuté** : cette pull request ne porte aucun code, donc une
suite verte ou rouge ne changerait ni la spec ni ce registre.

## Violations

- **Belonging to a world** — les identifiants que les membres d'un monde
  déclarent sont transmis au serveur de jeu sous une forme qu'il refuse, et il
  démarre alors sans aucun admin en jeu. Mesuré le 2026-09-17 dans
  `deploy/cloud-init/src/lib/sunkenland.ts` par l'audit de la PR #46 : dès que
  deux membres d'un monde déclarent le leur, plus personne ne commande dans la
  partie, donc plus personne ne peut y demander une sauvegarde. L'état de
  production porte encore un contournement manuel — un identifiant retiré à la
  main des membres d'un monde — qu'un correctif devra défaire.
- **A world's saves** — quand la dernière session d'un monde s'est arrêtée sans
  laisser de sauvegarde de fin, sa dernière sauvegarde est une poussée
  régulière, que la règle de durée du stockage
  (`deploy/scaleway/beacon-saves-lifecycle.json`) retire au bout de sept jours.
  Tant qu'aucune session ne suit, c'est la dernière sauvegarde du monde, que la
  spec interdit de supprimer.
- **Ubiquitous language** — l'outil d'administration ne porte qu'un seul geste,
  nommé `adopt`, là où la spec en nomme deux : `create`, qui fait entrer un
  monde dans le système, et `deposit`, qui y ajoute une sauvegarde.
- **Ubiquitous language** — le code nomme `Player` ce que la spec appelle membre
  d'un monde, `Member` : `players` et `hasPlayer` dans
  `libs/session/src/lib/world.ts`, par où une session vérifie aussi le droit
  d'ouvrir, et la sous-collection `players` d'un monde. Le renommage vient après
  que le code a renommé l'utilisateur de `Member` en `User` : avant, `Member`
  désignerait deux concepts à la fois.
- **Depositing a save** — déposer une sauvegarde dans un monde qui existe déjà
  se fait en relançant le geste de création, et n'a pas de commande à soi : le
  seul geste du système qui recouvre n'est nommé nulle part dans ce qu'un
  administrateur tape.

## Gaps

- **Ubiquitous language** — le lien d'invitation porte un code de douze
  caractères tirés au hasard, et ce code est la seule borne de l'entrée dans un
  monde. Le nombre est lu dans le code, et rien ne dit qu'il ait jamais été
  décidé.
- **A world's identity and lifetime** — l'identifiant d'un monde est borné à
  trente-deux caractères, en minuscules, chiffres et tirets ; le nom affiché à
  soixante-quatre. Trois bornes lues dans le code, dont aucune ne se rattache à
  une décision écrite.
- **Belonging to a world** — un identifiant mal formé déclaré par un utilisateur
  est écarté en silence à la lecture et refusé bruyamment au démarrage du
  serveur, sans que rien n'en avertisse cet utilisateur. Rien n'est décidé
  là-dessus.
- **A world's saves** — un jeu qui laisse choisir sa cadence de sauvegarde la
  voit réglée à cinq minutes (`deploy/cloud-init/src/lib/sunkenland.ts`,
  `AUTOSAVE_SECONDS`). C'est un réglage de ce jeu, décidé le 2026-09-05, et non
  une promesse du produit : rien ne dit ce qu'une session peut perdre au plus.
- **A world's saves** — ce qu'une session perd au plus sur un jeu dont la
  cadence ne se choisit pas n'a jamais été décidé ni mesuré. Le code y pousse
  une sauvegarde toutes les dix minutes
  (`deploy/cloud-init/src/lib/enshrouded.ts`, `BEACON_PUSH_INTERVAL_MS`), et
  personne n'a arrêté ce nombre.
- **Belonging to a world** — le registre des membres d'un monde porte aussi le
  code d'invitation dans chaque document, et les règles ouvrent ces documents à
  tous les membres du monde.
- **Depositing a save** — le plancher de taille sous lequel une archive est
  refusée est un nombre du code, et rien ne dit qu'il ait été décidé.
