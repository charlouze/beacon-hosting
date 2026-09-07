# deploy/scaleway

Deux documents qui ne sont pas du code et que **rien n'applique
automatiquement** : ce sont les seules ressources du compte dont l'énoncé
compte assez pour se relire, et ils vivaient jusqu'ici dans un répertoire
temporaire de session.

- **`beacon-games-policy.json`** énonce la frontière du §7 du spec : la clé qui
  monte sur la VM lit le seau des fichiers de jeu et **n'y écrit pas**. C'est ce
  qui la tient réellement — l'IAM Scaleway ne descend pas sous le projet, et une
  clé n'opère que dans son projet par défaut, donc ni deux seaux ni deux projets
  ne suffisent (§5).
- **`beacon-saves-lifecycle.json`** est la **seule chose du système qui
  supprime**. Aucun code du dépôt n'efface une sauvegarde : le port `SaveStore`
  n'expose ni suppression ni élagage (§8). Ce fichier est donc le seul endroit à
  relire quand on se demande ce qui peut disparaître.

Les poser, et les relire depuis le seau — la relecture n'est pas une politesse,
c'est la seule preuve que le fournisseur a compris ce qu'on lui a dit :

```bash
mise exec -- scw object bucket-policy create beacon-games \
  policy=deploy/scaleway/beacon-games-policy.json
mise exec -- scw object bucket-policy get beacon-games

mise exec -- scw object bucket-lifecycle create beacon-saves \
  lifecycle-configuration=deploy/scaleway/beacon-saves-lifecycle.json
mise exec -- scw object bucket-lifecycle get beacon-saves
```

`create` remplace la configuration entière du seau : ces deux fichiers sont donc
l'état complet, pas un ajout. Le seau se résout dans le **projet par défaut de
la clé** ; c'est cette contrainte, et pas l'IAM, qui décide si la commande
trouve le seau.

## Trois choses qu'il faut savoir avant de toucher à ces fichiers

**Une règle IAM Scaleway met plus de cinq minutes à prendre effet.** Une mesure
prise juste après un changement ne prouve rien, et trois conclusions fausses
sont nées de cette impatience le 2026-09-07. Ce qui tranche est une
**opposition** — le même test, deux états, tout le reste égal — pas une mesure
de plus.

**Le versionnement rend une règle d'expiration mensongère.** Sur un seau
versionné, `Expiration` pose un marqueur de suppression : l'objet quitte les
listings, la version précédente reste stockée et facturée sans fin, et la règle
paraît correcte à la relecture. Le versionnement est **suspendu** sur
`beacon-saves`, et le `NoncurrentVersionExpiration` de ce fichier n'a plus rien
à faire — il reste comme filet si quelqu'un le réactivait.

**Il n'y a qu'une règle, et elle ne touche que les poussées régulières.** Les
sauvegardes de fin de session n'expirent jamais : une règle qui effacerait la
dernière sauvegarde d'un monde faute d'y avoir joué pendant un an économiserait
quelques centimes contre la seule chose que ce système existe pour protéger
(§8). Le préfixe est littéral, donc chaque jeu ajoute sa propre règle —
`saves/sunkenland/auto/` naît avec la tranche 3 bis, et personne ne le fera
tomber d'un test.
