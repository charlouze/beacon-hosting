# infrastructure — Gaps register

## Coverage

**Audité**, par lecture : l'outil de mise en place du compte en entier, les
trois workflows, ce que le dépôt déclare du compte Scaleway, la désignation des
images et le rendu de ce qui s'installe sur un serveur de jeu, le semis et le
tampon de version, ce qui recharge un onglet dans l'application, les droits
d'écriture sur les réglages du système, et le flux local des secrets.

**Non audité**, et il faut le lire comme « on ne sait pas » et non comme « rien
n'a été trouvé » :

- **Le compte réel.** Aucun relevé n'a été fait : la protection de `main`
  effectivement en place, les alertes et leur destinataire, les politiques et
  règles de durée réellement posées sur les seaux, les rôles effectivement
  tenus, les secrets présents. Tout ce que ce registre dit du compte vient de ce
  que le dépôt en déclare ou en raconte.
- **Ce que fait `firebase deploy` entre ses cibles** quand l'une échoue.
- **Si la console Firebase permet à un administrateur** d'écrire la version en
  production ou l'adresse de rapport hors des règles d'accès.
- **Si deux constructions de l'image du compagnon** depuis le même contexte
  donnent le même contenu.

**Aucun test n'a été exécuté.** Cette pull request ne porte aucun code : une
suite verte ou rouge ne changerait ni la spec ni ce registre.

## Violations

- **Setting up the account** — l'écart ne signale pas tout ce qui diverge d'un
  attribut déclaré. Une variable du dépôt posée avec une autre valeur que celle
  que l'outil connaît passe pour conforme : seule son absence est détectée
  (`tools/deploy-setup/src/lib/repo-gap.ts`). L'émetteur et la correspondance
  d'attributs du fournisseur d'identité fédérée ne sont pas comparés
  (`tools/deploy-setup/src/lib/federation.ts`). Les acteurs autorisés à
  contourner la protection de `main` ne sont pas relus
  (`tools/deploy-setup/src/lib/protection.ts`).
- **Setting up the account** — une mise en place partielle peut ressembler à une
  mise en place complète. Sous `repo`, `--check` compris, une variable à
  demander laissée vide n'est pas comptée, et l'outil conclut « Rien à faire »
  avec un code de sortie nul (`tools/deploy-setup/src/repo.ts`). Sous `secrets`,
  une saisie vide saute le secret et l'outil finit sur « Terminé. », sans
  décompte (`tools/deploy-setup/src/secrets.ts`).
- **Setting up the account** — on ne lit pas toujours l'écart sans rien
  modifier. `secrets` n'a pas de mode qui lise sans demander. La politique du
  seau des jeux et la règle de durée du seau des sauvegardes sont déclarées en
  fichiers mais posées à la main, et rien ne les compare à ce que les seaux
  portent (`deploy/scaleway/README.md`).
- **Rebuilding the account** — tout ce que le compte porte n'est pas déclaré
  dans le dépôt. Les seaux, la clé d'accès au stockage, les deux alertes et leur
  canal, et l'enregistrement de domaine naissent d'un geste de console
  (`deploy/README.md`). Le projet Firebase, sa base, son fournisseur
  d'authentification, le domaine de l'application, le projet et les droits
  Scaleway ne sont déclarés nulle part.
- **Rebuilding the account** — la déclaration désigne le compte existant et ne
  se rejoue pas sur un compte vide sans être réécrite d'abord. `WANTED` fixe
  l'identifiant du projet, son numéro et le dépôt, et l'audit refuse de tourner
  si le numéro diffère (`tools/deploy-setup/src/lib/wanted.ts`,
  `tools/deploy-setup/src/audit.ts`). La politique du seau des jeux fixe un
  utilisateur et une application Scaleway
  (`deploy/scaleway/beacon-games-policy.json`). Le document archivé
  `docs/archive/specs/2026-09-02-game-hosting-design.md` §14 le relevait déjà.
- **Rebuilding the account** — le temps de réinstallation n'est pas connu :
  aucune suite de gestes écrite pour un compte vide n'existe, et la répétition
  sur un compte neuf n'a jamais eu lieu.
- **Putting into production** — une fusion qui n'a rien à publier peut quand
  même mettre en production. Seul le markdown est écarté du déclenchement
  (`.github/workflows/deploy.yml`) : une fusion qui ne toucherait que des
  maquettes HTML ou des fichiers de sonde republierait l'identique, retamponnerait
  la version en production et rechargerait tous les onglets.
- **Putting into production** — le bundle publié n'est pas exactement celui qui
  a été vérifié. Après la vérification du commit de fusion, le workflow réécrit
  le tampon de version dans les sources de l'application et la reconstruit
  (`.github/workflows/deploy.yml`). L'écart se limite au tampon.
- **Putting into production** — la protection de `main` ne contient aucune
  règle qui exige une pull request, et la vérification requise n'est liée à
  aucune intégration (`tools/deploy-setup/src/lib/protection.ts`). Une poussée
  directe d'un commit qui porte déjà une vérification verte, la tête d'une pull
  request vérifiée par exemple, serait acceptée. Établi par lecture de la
  documentation GitHub, sans relevé du compte réel.
- **Putting into production** — une fusion ne suffit pas à retirer de la
  production une Function retirée du code. La mise en production refuse de la
  supprimer et échoue ; il faut la supprimer à la main depuis un poste, puis
  fusionner à nouveau (`.github/workflows/deploy.yml`).
- **What runs is what was verified** — l'image publiée du compagnon n'est pas
  celle qui a démarré. Le test de démarrage lance une image construite
  localement, pour une seule pile de jeu ; l'image publiée est une seconde
  construction depuis le même contexte (`.github/workflows/companion.yml`,
  `deploy/companion/smoke/run.sh`).
- **Credentials** — des identifiants d'hébergeur sont confiés à l'hébergement du
  code. La moitié publique de la clé d'API Scaleway et l'identifiant du projet
  Scaleway sont des variables du dépôt (`.github/workflows/deploy.yml`,
  `tools/deploy-setup/src/lib/repo-gap.ts`) ; `STACK.md` exclut « les clés S3 du
  bucket » sans distinguer leurs deux moitiés. L'identité que la mise en
  production emprunte porte un rôle d'administration des secrets, qui lui permet
  de lire tous les secrets d'hébergeur (`tools/deploy-setup/src/lib/wanted.ts`).
- **Open tabs follow production** — seul l'onglet d'un membre suit la version en
  production. Un onglet déconnecté ou de visiteur reste sur l'ancien code
  jusqu'à ce qu'un membre s'y connecte (`apps/web/src/app/records.ts`).
- **Open tabs follow production** — après un échec de mise en production, le
  workflow prescrit à un humain d'écrire la version en production et l'adresse
  de rapport depuis son poste (`.github/workflows/deploy.yml`, le résumé
  d'échec). La spec réserve ces deux valeurs à la mise en production.

## Gaps

- **Setting up the account** — la mise en place est sans état : elle lit ce qui
  existe, comble l'écart, et ne tient aucun registre de ce qu'elle croit avoir
  créé, donc n'a aucune notion de « remplacer ». C'est ce qui rend impossible
  qu'un changement de nom emporte un seau.
  `CLAUDE.md` (« Le système possède la session ; tout le reste est le compte »),
  `docs/archive/specs/2026-09-02-game-hosting-design.md` §14 et
  `docs/archive/plans/2026-09-02-lotissement.md` §6 prescrivent ce mécanisme.
- **Setting up the account** — le partage entre ce que la mise en production
  publie (règles d'accès, index, Functions, application, tâche planifiée) et ce
  que la mise en place déclare : « la CLI livre l'app, l'outil déclare le
  compte ». `docs/archive/specs/2026-09-02-game-hosting-design.md` §14,
  `docs/archive/plans/2026-09-02-lotissement.md` §6 et `probe/RESULTS.md` §F le
  prescrivent.
- **Putting into production** — les étapes de la mise en production et leur
  ordre : vérifications, tests des règles d'accès contre l'émulateur,
  publication, semis, écriture des valeurs réservées.
  `docs/archive/specs/2026-09-02-game-hosting-design.md` §10 les prescrit.
- **Putting into production** — un réglage ajouté au système après sa première
  mise en production n'est jamais posé par une mise en production : le semis ne
  crée le document des réglages que s'il n'existe pas
  (`apps/functions/src/seed.ts`).
- **What runs is what was verified** — l'image du compagnon se publie sur un tag
  `companion-v*`, et un test de démarrage `docker-compose` en est la barrière.
  `docs/archive/specs/2026-09-02-game-hosting-design.md` §10 le prescrit.
- **What runs is what was verified** — le tag qui publie l'image du compagnon
  peut être posé sur n'importe quel commit, qu'il soit sur `main` ou non, vérifié
  ou non (`.github/workflows/companion.yml`).
- **What runs is what was verified** — ce qui s'installe sur un serveur de jeu
  hors des images est publié par une fusion, sans test de démarrage : la
  configuration de mise en place de la machine est rendue par la Function qui
  provisionne (`deploy/README.md`, `apps/functions/src/provisioning.ts`).
- **What runs is what was verified** — ce qui n'est pas une image de conteneur
  est désigné par une référence mobile : l'image système des serveurs de jeu,
  résolue par un libellé (`libs/scaleway-compute/src/lib/images.ts`), les
  paquets installés au démarrage de la machine (`deploy/cloud-init/src/lib/`),
  les actions et l'environnement d'exécution de la vérification des pull
  requests (`.github/workflows/pull-request.yml`).
- **Credentials** — les identifiants d'hébergeur vivent dans Secret Manager, et
  la mise en production s'authentifie par identité fédérée GitHub vers un compte
  de service dédié. `docs/archive/specs/2026-09-02-game-hosting-design.md` §7 et
  §10, et `STACK.md` (« Identifiants ») le prescrivent.
- **Credentials** — la clé qui monte sur un serveur de jeu doit avoir pour
  projet par défaut celui où elle écrit, sans quoi la première sauvegarde échoue
  sans nommer le projet. `docs/archive/specs/2026-09-02-game-hosting-design.md`
  §7 le prescrit.
- **Credentials** — pour le développement, les valeurs réelles des secrets du
  compte vivent dans un fichier local et sont recopiées dans un second
  (`tools/dev-secrets.mjs`), et le rendu de la configuration d'une machine passe
  son mot de passe par la ligne de commande (`deploy/README.md`).
- **Open tabs follow production** — au bout de combien de temps un onglet se
  recharge n'a jamais été décidé. Le mécanisme compare en temps réel la version
  compilée dans l'application à celle que la mise en production a écrite.
  `docs/archive/specs/2026-09-02-game-hosting-design.md` §4 le prescrit.
- **Warning the administrator** — l'alerte sur l'arrêt du rattrapage surveille
  l'échec ou l'absence d'exécution de la tâche planifiée. Elle détecte un arrêt,
  jamais une absence de départ, d'où une première exécution constatée à la main,
  une fois, à la pose. `docs/archive/specs/2026-09-02-game-hosting-design.md` §6
  (« Qui surveille le watchdog ») et `probe/RESULTS.md` §F la prescrivent.
- **Warning the administrator** — au bout de combien de temps l'administrateur
  est prévenu que le rattrapage s'est arrêté n'a jamais été décidé ; le
  mécanisme accepte une fenêtre allant jusqu'à 23,5 h.
  `docs/archive/specs/2026-09-02-game-hosting-design.md` §6.
- **Warning the administrator** — le seuil de dépense qui prévient
  l'administrateur n'a jamais été décidé.
  `docs/archive/specs/2026-09-02-game-hosting-design.md` §7.
