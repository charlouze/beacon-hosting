# deploy

## Qui instancie quoi, et par quelle commande

Huit mécanismes créent des ressources dans ce projet. **Le §14 du spec dit
lequel possède quoi et pourquoi la frontière est là** ; cette table dit par quel
geste, et c'est tout ce qu'elle ajoute.

| Ce qui est instancié | Le geste |
|---|---|
| Règles, index, Functions, Hosting, le semis, le tampon | une fusion dans `main`. Rien à taper — et c'est la seule voie |
| Services GCP, IAM, fédération, secrets, variables du dépôt, protection de `main` | `npx nx run deploy-setup:audit`, `:secrets`, `:repo` — chacun avec `-- --check` pour lire l'écart sans rien écrire |
| Les seaux, la clé S3, les deux alertes et leur canal, l'enregistrement A | **la console, et rien d'autre.** C'est ce que la tranche 6 supprime |
| La politique de `beacon-games`, le cycle de vie de `beacon-saves` | `scw`, à la main — [les commandes exactes](scaleway/README.md) |
| L'image du compagnon | un tag `companion-v*` poussé à la main |
| Les fichiers de jeu, les mondes | `npx nx run game-depot:push` / `:update`, `world-depot:adopt` / `:retrieve` |
| L'instance, son disque, l'IP flottante, l'IP du sous-domaine | personne. **Le système les crée en tournant**, et les réconcilie par tag |
| Les conteneurs, les unités, les montages de la machine | personne. `cloud-init/` les décrit, la Function qui provisionne les pose |

Les deux lignes qui n'ont pas de commande rejouable — la console et les JSON de
`scaleway/` — sont les deux que la tranche 6 reprend. Les autres se relancent
sans risque : elles ne font rien quand il n'y a rien à faire.

## `cloud-init/`

Le projet `@beacon/cloud-init` : le catalogue par jeu, et le `cloud-init` que la
Function pose sur l'instance au provisionnement. C'est **le seul endroit du
dépôt** qui sait qu'un serveur Enshrouded écoute en `15637/udp`, quelle image le
lance et par quelle variable passe son mot de passe (§4 du spec).

Le gabarit et le `docker-compose` y sont du TypeScript et non des fichiers du
disque : la Function qui provisionne est un bundle, et un fichier lu au chemin
relatif du module y serait introuvable — correct en test, absent en production.

Les lire au terminal :

```bash
npx nx run cloud-init:render          # le cloud-init entier
npx nx run cloud-init:render-compose  # le compose seul
```

Le runner de tâches préfixe son propre bandeau à la sortie qu'il capture,
donc ces deux cibles sont pour l'écran, jamais pour une redirection. Pour
obtenir le document nu — un fichier, un test de fumée — appeler le rendeur
directement :

```bash
SERVER_PASSWORD=… npx tsx deploy/cloud-init/src/render.ts   # le cloud-init entier
WHAT=compose npx tsx deploy/cloud-init/src/render.ts        # le compose seul
```

Le rendu contient le mot de passe en clair : il s'écrit dans `tmp/`, jamais
ailleurs, et ne se colle ni dans un rapport ni dans un message de commit.

Vérifier un rendu sans allumer de machine :

```bash
mkdir -p tmp
SERVER_PASSWORD=probe npx tsx deploy/cloud-init/src/render.ts > tmp/rendered.yaml
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd)/tmp:/w" -w /w ubuntu:24.04 \
  sh -c 'apt-get update -qq && apt-get install -y -qq cloud-init >/dev/null && cloud-init schema --config-file rendered.yaml'
rm tmp/rendered.yaml
```

`MSYS_NO_PATHCONV=1` empêche Git Bash de réécrire `/w` en chemin Windows.

Changer de version d'image est un commit sur ce projet, jamais un effet de bord
— c'est ce que garantit le digest.

## Ce que la sonde a corrigé ici

Le détail et les mesures sont dans [`../probe/RESULTS.md`](../probe/RESULTS.md),
section I. Ce qui compte pour relire ces fichiers :

- **Un seul port UDP**, `15637`. `15636` n'est jamais lié par l'image.
- **`SERVER_PASSWORD` ne doit jamais être passée au conteneur.** L'amont
  l'ignore, et son chemin de repli tronque la configuration : le serveur
  démarre alors avec un mot de passe aléatoire, sans rien signaler. Le mot de
  passe passe par `SERVER_ROLE_0_PASSWORD`. La variable `SERVER_PASSWORD` du
  `.env` est le nom côté produit ; le `docker-compose` fait la traduction, à un
  seul endroit.
- **Les droits du rôle se posent explicitement.** Le gabarit de groupe de
  l'image n'accorde que l'édition du monde ; sans les trois `CAN_*`, les joueurs
  ne peuvent ni construire ni ouvrir les coffres.

## `companion/`

L'image compagnon naît en tranche 3, avec la restauration des sauvegardes et
l'agent qui rapporte.

## `scaleway/`

La politique du seau des fichiers de jeu et la règle de cycle de vie du seau des
sauvegardes. Ce ne sont pas des fichiers que le dépôt exécute : ce sont l'énoncé
de la frontière du §7 et la seule chose du système qui supprime quelque chose.
Ils se posent à la main, et [leur README](scaleway/README.md) porte les
commandes.

**Avec la console, c'est l'un des deux seuls mécanismes que rien ne rejoue**
(§14). Ces fichiers se relisent en revue, mais personne ne vérifie que le seau
dit encore la même chose qu'eux — ce qui est précisément la panne qu'ils
documentent plus bas.
