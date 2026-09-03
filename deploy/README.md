# deploy

Les deux artefacts que la tranche 0 laisse derrière elle.

- `docker-compose.yml` — le conteneur de jeu, référencé par digest immuable
  (§10 du spec). Le compagnon s'y ajoute en tranche 3.
- `cloud-init/enshrouded.yaml.tmpl` — ce que l'instance exécute au boot : il installe
  Docker, écrit le `docker-compose.yml` et le démarre.
- `render-cloud-init.mjs` — injecte le `docker-compose.yml` dans le gabarit. Le
  compose n'existe donc qu'une fois, et ce qui tourne sur l'instance est ce qui
  a été testé en local.

```bash
SERVER_PASSWORD=… node deploy/render-cloud-init.mjs
```

Vérifier le rendu sans allumer de machine :

```bash
SERVER_PASSWORD=probe node deploy/render-cloud-init.mjs > deploy/rendered.yaml
MSYS_NO_PATHCONV=1 docker run --rm -v "$(pwd)/deploy:/w" -w /w ubuntu:24.04 \
  sh -c 'apt-get update -qq && apt-get install -y -qq cloud-init >/dev/null && cloud-init schema --config-file rendered.yaml'
rm deploy/rendered.yaml
```

`MSYS_NO_PATHCONV=1` empêche Git Bash de réécrire `/w` en chemin Windows.

En tranche 2, c'est une Function qui rend ce gabarit, avec en plus le jeton
d'agent et l'échéance de la session. Le gabarit ne bouge pas, seul l'appelant
change.

Changer de version d'image est un commit sur ce dossier, jamais un effet de
bord — c'est ce que garantit le digest.

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
