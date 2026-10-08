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
- **Si la console Firebase permet à quiconque y a accès** d'écrire la version
  en production ou l'adresse de rapport hors des règles d'accès.
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
  dans le dépôt. Les seaux, la clé d'accès au stockage, et les deux alertes et leur
  canal naissent d'un geste de console (`deploy/README.md`). Le projet Firebase, sa base, son fournisseur
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
- **Rebuilding the account** — aucune suite de gestes écrite pour un compte vide
  n'existe, et la répétition sur un compte neuf n'a jamais eu lieu.
- **Putting into production** — une fusion qui n'a rien à publier peut quand
  même mettre en production. Seul le markdown est écarté du déclenchement
  (`.github/workflows/deploy.yml`) : une fusion qui ne toucherait que des
  maquettes HTML ou des fichiers de sonde republierait l'identique, retamponnerait
  la version en production et rechargerait tous les onglets.
- **Putting into production** — une fusion ne suffit pas à retirer de la
  production une Function retirée du code. La mise en production refuse de la
  supprimer et échoue ; il faut la supprimer à la main depuis un poste, puis
  fusionner à nouveau (`.github/workflows/deploy.yml`).
- **Publishing the server image** — l'image publiée du compagnon n'est pas
  celle qui a démarré. Le test de démarrage lance une image construite
  localement, pour une seule pile de jeu ; l'image publiée est une seconde
  construction depuis le même contexte (`.github/workflows/companion.yml`,
  `deploy/companion/smoke/run.sh`).
- **Open tabs across a release** — l'application ne fonctionne pas avec une
  version antérieure à celle qui est en production. Elle compare la version
  compilée dans son code à celle que la mise en production a écrite, et recharge
  l'onglet quand elles diffèrent (`apps/web/src/app/records.ts`). Un onglet
  déconnecté, ou connecté sans être autorisé, n'est pas rechargé et reste sur
  l'ancien code.
- **Putting into production** — après un échec de mise en production, le
  workflow prescrit à un humain de l'achever depuis son poste, en écrivant la
  version publiée et l'adresse de rapport des serveurs de jeu
  (`.github/workflows/deploy.yml`, le résumé d'échec). La spec réserve la mise
  en production à la fusion.

## Gaps

- **Putting into production** — un réglage ajouté au système après sa première
  mise en production n'est jamais posé par une mise en production : le semis ne
  crée le document des réglages que s'il n'existe pas
  (`apps/functions/src/seed.ts`).
- **Publishing the server image** — l'image du compagnon se publie sur un tag
  `companion-v*`, et un test de démarrage `docker-compose` en est la barrière.
  `docs/archive/specs/2026-09-02-game-hosting-design.md` §10 le prescrit.
- **Publishing the server image** — le tag qui publie l'image du compagnon
  peut être posé sur n'importe quel commit, qu'il soit sur `main` ou non, vérifié
  ou non (`.github/workflows/companion.yml`).
- **Publishing the server image** — ce qui s'installe sur un serveur de jeu
  hors des images est publié par une fusion, sans test de démarrage : la
  configuration de mise en place de la machine est rendue par la Function qui
  provisionne (`deploy/README.md`, `apps/functions/src/provisioning.ts`).
- **Setting up the account** — la clé qui monte sur un serveur de jeu doit avoir pour
  projet par défaut celui où elle écrit, sans quoi la première sauvegarde échoue
  sans nommer le projet. `docs/archive/specs/2026-09-02-game-hosting-design.md`
  §7 le prescrit.
- **Setting up the account** — pour le développement, les valeurs réelles des secrets du
  compte vivent dans un fichier local et sont recopiées dans un second
  (`tools/dev-secrets.mjs`), et le rendu de la configuration d'une machine passe
  son mot de passe par la ligne de commande (`deploy/README.md`).
- **Warning the operator** — l'alerte sur l'arrêt du rattrapage surveille
  l'échec ou l'absence d'exécution de la tâche planifiée. Elle détecte un arrêt,
  jamais une absence de départ, d'où une première exécution constatée à la main,
  une fois, à la pose. `docs/archive/specs/2026-09-02-game-hosting-design.md` §6
  (« Qui surveille le watchdog ») et `probe/RESULTS.md` §F la prescrivent.
- **Putting into production** — seule la mise en production écrit la version
  qu'elle publie et l'adresse à laquelle un serveur de jeu rapporte ; elle les
  réécrit à chaque fois, et aucun rôle ne peut les écrire.
  `docs/archive/specs/2026-09-02-game-hosting-design.md` §4 et §10 le
  prescrivent.
