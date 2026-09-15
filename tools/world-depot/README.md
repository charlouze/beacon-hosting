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
npx nx run world-depot:retrieve -- --world=les-copains --to=./monde.tar.gz
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

## `world-depot:adopt` — faire naître un monde

```bash
npx nx run world-depot:adopt -- --world=les-copains --game=enshrouded --name="Les copains"
npx nx run world-depot:adopt -- --world=les-autres --game=sunkenland --name="Les autres" --from=<dossier contenant le monde>
```

C'est `adopt`, et lui seul, qui fait naître un monde (§2) : il crée son
document Firestore et son `server/current` en `IDLE`, imprime le lien
d'invitation et, pour un jeu qui se rejoint par une adresse, l'enregistrement
DNS à créer avant la première session.

**`--from` est facultatif pour Enshrouded, obligatoire pour Sunkenland** — le
catalogue le dit par `generatesWorlds` (§4), jamais un `if` sur le nom du jeu.
Sans archive, l'outil crée le monde et n'appelle pas le dépôt : la première
session laisse le jeu générer un monde vierge, ce que le compagnon sait déjà
faire pour Enshrouded. `--from` désigne, comme avant, le dossier qui contient
**directement** le dossier `<nom>~<GUID>`.

**Le monde se crée avant le dépôt, et une seule fois.** Si `--world` désigne
un monde qui existe déjà, l'outil vérifie que `--game` concorde avec le sien,
refuse sinon, et ne touche ni son nom ni son invitation : lancer `adopt` sur un
monde existant est le geste de recouvrement du §8, jamais une seconde
naissance.

**L'identité Firebase n'est pas un nouveau secret** (§8) : `adopt` s'authentifie
par `applicationDefault()`, donc ce que `gcloud auth application-default
login` a posé sur ce poste. `BEACON_FIREBASE_PROJECT` nomme le projet et n'a
pas de défaut, pour la même raison que `BEACON_SAVES_BUCKET` : la production
n'a pas de jumeau. Contre l'émulateur : `FIRESTORE_EMULATOR_HOST` et
`BEACON_FIREBASE_PROJECT=demo-beacon`.

Trois gardes couvrent le dépôt, quand `--from` est donné, dans cet ordre, et
l'ordre n'est pas interchangeable :

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
   monde qu'elle porte — **et ce qu'elle est en train d'écrire** : le monde, le
   seau et le projet Firebase. Elle est toujours posée : un outil qui dépose
   sans le dire est un outil qu'on lance deux fois par accident.

Le dépôt est une sauvegarde d'origine `manual`, sous
`manual/{worldId}/{instant}.tar.gz`. La clé est construite par `objectKeyFor`
dans l'adapter et n'est jamais épelée ici. Il écrit aussi `saves/{id}` par
`saveRecords` (§8) : une adoption laisse désormais une ligne dans l'audit,
exactement comme un dépôt du compagnon.

### Ce que le code ne peut pas dire

**Un monde ne se retélécharge pas.** Il naît dans le client d'un joueur ou chez
un autre hébergeur, et le serveur dédié **ne sait pas en créer un** : sans un
`-worldGuid` qui existe déjà, il s'arrête. C'est pourquoi `adopt` existe, et
c'est pourquoi il dépose une copie sous la clé du monde et jamais un dossier
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

**L'adoption est visible à la restauration et, depuis cette tranche, à
l'audit.** L'objet porte l'origine `manual`, donc `list()` le voit et la
session suivante le restaure comme n'importe quelle sauvegarde. `adopt` écrit
lui-même `saves/{id}` par `saveRecords`, ce qui ferme l'écart que ce fichier
signalait auparavant : les Functions ne sont plus la seule main qui y écrit.

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
couvert : `admin-store.ts`, `admin-firestore.ts`, `retrieve.ts` et `adopt.ts`
n'ont aucun test au niveau du magasin (seul le refus sans
`BEACON_FIREBASE_PROJECT` l'est, sans emulateur). Personne n'a encore branché
le `FakeObjectApi` de `@beacon/scaleway-storage` sous cet outil, donc
l'enchaînement complet des deux gestes n'est vérifié que par la main qui les
lance.

Vérifié à la main contre un vrai émulateur Firestore (poste de développement,
2026-09-15) : la naissance d'un monde (document, `server/current` en `IDLE`,
lien d'invitation, ligne DNS pour un jeu qui se rejoint par adresse), le geste
de recouvrement qui ne touche ni le nom ni le code, et le refus quand `--game`
ne concorde pas avec le monde déjà enregistré. Le chemin du dépôt d'archive
(`--from`, les trois gardes, `saveRecords`) n'a pu être rejoué contre MinIO sur
ce poste : `tar@6.2.1` y est installé alors que ce projet déclare `^7.4.3`, et
`t()` n'y lit plus aucune entrée d'une archive pourtant écrite avec des octets
réels — un désaccord de version préexistant à cette tâche, déjà visible dans
`world-archive.spec.ts` et `world-identity.spec.ts` avant toute modification.
Ce chemin reste donc couvert par relecture du code seul (il reprend
`chooseSave`, `worldIdentity` et les trois gardes tels qu'`adopt.ts` les
pratiquait déjà, avec `worldId` à la place de `game` et `saveRecords.record`
en plus) jusqu'à ce que ce désaccord de version soit résolu.
