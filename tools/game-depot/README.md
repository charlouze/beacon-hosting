# game-depot

L'outil d'administration qui dépose les fichiers d'un jeu dans `beacon-games`.
Il tourne sur **la machine qui possède le jeu**, jamais sur un runner ni sur une
VM : le §7 du spec garde tout identifiant Steam hors du système, et la clé de la
machine ne sait que lire ce seau.

**Il n'a aucun verbe qui supprime**, et c'est sa principale caractéristique. Il
ne connaît pas non plus le préfixe des sauvegardes.

## `game-depot:update` — le geste de chaque mise à jour

```bash
BEACON_FIREBASE_PROJECT=<projet> npx nx run game-depot:update
```

Guidé de bout en bout : il lit la clé d'administration dans le remote rclone
`scw-admin` (aucune valeur n'est jamais affichée), propose les jeux du catalogue
qui passent par une copie, trouve leur installation par son manifeste dans
**toutes** les bibliothèques Steam, puis lance `steamcmd` pour l'amener à la
version que l'éditeur publie. Il dépose ensuite l'installation, la relit, et
enregistre dans Firestore la version de ce qu'il a déposé.

`steamcmd` doit être dans le `PATH`, sous le nom `steamcmd.exe`, et l'outil doit
tourner dans un terminal : `steamcmd` y demande le mot de passe du compte Steam
et le code Steam Guard. Sans installation trouvée, il installe dans
`steamapps/common/beacon-<jeu>` de la première bibliothèque. Un code de sortie
de `steamcmd` autre que `0` arrête tout, sans rien déposer.

La version est le `buildid` du manifeste que `steamcmd` écrit dans
l'installation, `steamapps/appmanifest_<application>.acf`. L'outil refuse une
installation sans manifeste, que son manifeste dit incomplète, ou qui ne porte
pas l'exécutable que le catalogue donne au jeu, et refuse de déposer quand
l'enregistrement ne répond pas. Quand la version installée est déjà celle de la
copie enregistrée, il le dit et demande s'il dépose quand même.
`BEACON_FIREBASE_PROJECT` n'a aucune valeur par défaut, et l'identité est celle
que `gcloud auth application-default login` a laissée sur le poste.

Options, toutes facultatives : `--game=<jeu>` pour ne pas avoir à choisir,
`--from=<dossier>` pour désigner le dossier où `steamcmd` installe, et que l'outil dépose,
`--steam-account=<nom>` quand la machine porte plusieurs comptes Steam,
`--steam-root=<dossier>` si Steam n'est pas à son emplacement habituel.

## `game-depot:push` — le même dépôt, sans question

```bash
npx nx run game-depot:push -- --game=sunkenland --from="<installation locale>"
```

Pour un script qui a déjà résolu son dossier et exporté les cinq variables
`BEACON_S3_*` et `BEACON_FIREBASE_PROJECT`. Il ne lance pas `steamcmd` : le
dossier doit déjà porter une installation complète.

## `game-depot:archive-key`

Écrit `<jeu>/game.tar` sur la sortie standard, pour qu'un script shell demande
cette clé au dépôt au lieu de la réécrire une troisième fois.

## Tests

```bash
npx nx test game-depot
```

Toute la logique est dans `src/lib/` et s'éprouve sans réseau, sans Steam et
sans disque réel ; `src/*.ts` ne fait que câbler.
