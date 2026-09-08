# game-depot

L'outil d'administration qui dépose les fichiers d'un jeu dans `beacon-games`.
Il tourne sur **la machine qui possède le jeu**, jamais sur un runner ni sur une
VM : le §7 du spec garde tout identifiant Steam hors du système, et la clé de la
machine ne sait que lire ce seau.

**Il n'a aucun verbe qui supprime**, et c'est sa principale caractéristique. Il
ne connaît pas non plus le préfixe des sauvegardes.

## `game-depot:update` — le geste de chaque mise à jour

```bash
npx nx run game-depot:update
```

Guidé de bout en bout : il lit la clé d'administration dans le remote rclone
`scw-admin` (aucune valeur n'est jamais affichée), cherche l'installation du
serveur dédié dans **toutes** les bibliothèques Steam, annonce ce qu'il a
trouvé, dépose et relit.

Quand le serveur dédié n'est pas installé — c'est une application Steam
distincte du client du jeu — il imprime la commande `steamcmd` exacte à lancer
et attend, plutôt que d'échouer. Il ne peut pas la lancer lui-même : ces
fichiers sont sous licence, et seul un compte qui possède le jeu les télécharge.

Options, toutes facultatives : `--from=<dossier>` pour désigner l'installation à
la main, `--steam-account=<nom>` quand la machine porte plusieurs comptes Steam,
`--steam-root=<dossier>` si Steam n'est pas à son emplacement habituel.

## `game-depot:push` — le même dépôt, sans question

```bash
npx nx run game-depot:push -- --game=sunkenland --from="<installation locale>"
```

Pour un script qui a déjà résolu son dossier et exporté les cinq variables
`BEACON_S3_*`. C'est ce que fait `deploy/scaleway/bootstrap-sunkenland.ps1`.

## `game-depot:archive-key`

Écrit `<jeu>/game.tar` sur la sortie standard, pour qu'un script shell demande
cette clé au dépôt au lieu de la réécrire une troisième fois.

## Tests

```bash
npx nx test game-depot
```

Toute la logique est dans `src/lib/` et s'éprouve sans réseau, sans Steam et
sans disque réel ; `src/*.ts` ne fait que câbler.
