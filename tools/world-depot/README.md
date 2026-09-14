# world-depot

L'outil d'administration qui va et vient entre le seau `beacon-saves` et la
machine de l'administrateur. Deux gestes symétriques : `retrieve` rend le
monde qui vit dans le seau, `adopt` y dépose celui qu'on lui donne.

**Il n'a aucun verbe qui supprime**, et c'est sa principale caractéristique.
Il passe par `SaveStore`, qui n'a ni suppression ni élagage (§8) : ce qui
prune est une règle de cycle de vie du seau, posée une fois par un humain.

## Le seau se nomme, il ne se devine pas

Les deux gestes exigent `BEACON_SAVES_BUCKET` et **n'ont aucun défaut** : le seul
défaut possible serait la production, et ce dépôt n'a pas de préproduction. Un
administrateur qui a oublié la variable en voulant éprouver une adoption contre
un MinIO local déposerait dans le vrai seau, et la confirmation dirait oui —
elle nomme le jeu et la sauvegarde recouverte. C'est pourquoi elle nomme aussi
le seau, et pourquoi l'absence de la variable est un refus.

```bash
BEACON_SAVES_BUCKET=beacon-saves npx nx run world-depot:retrieve -- ...
```

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

## `world-depot:adopt` — adopter un monde

```bash
npx nx run world-depot:adopt -- --game=sunkenland --from=<dossier contenant le monde>
```

`--from` désigne le dossier qui contient **directement** le dossier
`<nom>~<GUID>`, et il est obligatoire. Le script PowerShell qu'il remplace
cherchait le monde tout seul sous `LocalLow` : cette découverte ne valait que
pour un jeu et produisait déjà une ambiguïté qu'elle traitait par un refus.

Trois gardes, dans cet ordre, et l'ordre n'est pas interchangeable :

1. **La disposition, jugée avant que quoi que ce soit quitte la machine.** Une
   archive refusée plus loin est déjà partie. Ce qui juge est le catalogue, pas
   l'outil : ce que chaque jeu déclare est la marque qui prouve que l'archive
   commence au bon niveau. Une archive construite depuis le dossier parent donne
   `Worlds/Worlds/<monde>`, **et le serveur ne s'en plaint pas** — il génère un
   monde vierge, quelqu'un y joue, et la poussée du soir devient la sauvegarde
   la plus récente. La règle d'or tombe sur un `-C` mal placé, sans qu'aucune
   ligne n'ait effacé quoi que ce soit.
2. **Le plancher**, celui de `Save.of()` : adopter un dossier vide est
   impossible. Il est demandé ici pour que le refus arrive avant la question,
   plutôt qu'après la réponse.
3. **La confirmation, qui nomme ce qu'elle recouvre** — la sauvegarde
   actuellement la plus récente, sa date, sa taille, et le nom et le GUID du
   monde qu'elle porte. Elle est toujours posée : un outil qui dépose sans le
   dire est un outil qu'on lance deux fois par accident.

Le dépôt est une sauvegarde d'origine `manual`, sous
`saves/{jeu}/manual/bootstrap/{instant}.tar.gz`. La clé est construite par
`objectKeyFor` dans l'adapter et n'est jamais épelée ici : le script PowerShell
l'épelait et signalait lui-même que rien ne casserait quand les deux
définitions divergeraient.

### Ce que le code ne peut pas dire

**Un monde ne se retélécharge pas.** Il naît dans le client d'un joueur ou chez
un autre hébergeur, et le serveur dédié **ne sait pas en créer un** : sans un
`-worldGuid` qui existe déjà, il s'arrête. C'est pourquoi `adopt` existe, et
c'est pourquoi il est une copie vers `saves/<jeu>/` et jamais un dossier
réarrangé.

**Deux choix se figent à la création et ne se rattrapent pas** : le GUID,
auquel les personnages des joueurs restent attachés, et le nom du dossier, qui
est ce que les joueurs lisent dans la liste des serveurs — donc leur seul
recours si l'identifiant se perd. Adopter un monde, c'est adopter ces deux
valeurs-là telles quelles.

**Le dossier des personnages porte la même forme `<nom>~<GUID>`** que celui du
monde. C'est pour ça que la vérification de disposition ne se contente pas de
la forme : adopter un personnage à la place d'un monde donne une archive qui
restaure quelque chose que personne ne peut jouer.

**L'adoption est visible à la restauration et invisible à l'audit.** L'objet
porte l'origine `manual`, donc `list()` le voit et la session suivante le
restaure comme n'importe quelle sauvegarde. Mais `saves/{id}` n'est écrit que
par les Functions, sur rapport de l'agent : une adoption ne produit aucun
document, donc aucune trace dans l'audit et rien dans les cumuls. **Le monde
peut changer sans que l'historique en porte la moindre ligne.**

**Rien n'est effacé, et c'est ce qui rend le recouvrement réparable** : la clé
précédente reste dans le seau, et `retrieve --key=` va la chercher. Mais la
réversibilité a une durée — celle de la règle d'élagage du préfixe, qui ne fait
pas d'exception pour un monde qu'on aurait voulu reprendre six mois plus tard.

## Tests

```bash
npx nx test world-depot
```

Ce qui s'éprouve est dans `src/lib/` — les arguments, le seau, le choix de la
sauvegarde, l'archive et l'identité du monde — sans réseau et sans seau réel.

**Ce qui ne s'éprouve pas**, et il vaut mieux le lire ici que le croire
couvert : `admin-store.ts`, `retrieve.ts` et `adopt.ts` n'ont aucun test au
niveau du magasin. Personne n'a encore branché le `FakeObjectApi` de
`@beacon/scaleway-storage` sous cet outil, donc l'enchaînement complet des
deux gestes n'est vérifié que par la main qui les lance.
