# deploy

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
