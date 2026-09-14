# world-depot

L'outil d'administration qui va et vient entre le seau `beacon-saves` et la
machine de l'administrateur. Deux gestes symétriques : `retrieve` rend le
monde qui vit dans le seau, `adopt` y dépose celui qu'on lui donne.

**Il n'a aucun verbe qui supprime**, et c'est sa principale caractéristique.
Il passe par `SaveStore`, qui n'a ni suppression ni élagage (§8) : ce qui
prune est une règle de cycle de vie du seau, posée une fois par un humain.

## `world-depot:retrieve` — rendre un monde

```bash
npx nx run world-depot:retrieve -- --game=sunkenland --to=./monde.tar.gz
```

Lit la clé d'administration dans le remote rclone `scw-admin` (aucune valeur
n'est jamais affichée), rend par défaut la sauvegarde la plus récente — ce que
la prochaine session restaurerait, calculé par `newestSave` et jamais
recalculé ici — et l'écrit dans le fichier désigné par `--to`.

Options :

- `--key=<objectKey>` désigne une sauvegarde précise plutôt que la dernière.
  C'est ce que réparer un recouvrement demande : la clé *précédente*, pas la
  dernière.
- `--list` affiche l'historique complet du jeu (clé, taille, date) et
  s'arrête là, sans rien écrire.

Ce qu'il a pris s'imprime toujours : clé, taille, date, et pour un monde qui
porte un nom et un GUID dans son archive, les deux.

## Tests

```bash
npx nx test world-depot
```

Toute la logique est dans `src/lib/` et s'éprouve contre le `FakeObjectApi` de
`@beacon/scaleway-storage`, sans réseau et sans seau réel ; `src/*.ts` ne fait
que câbler.
