# Rapport de sonde — tranche 0

Chaque section répond à une question du §12 du spec. Une réponse sans la
commande ou l'observation qui la fonde n'est pas une réponse.

> **L'hébergeur a changé le 2026-09-03, en cours de tranche.** Les sections T et
> D portent des mesures faites sur OVH, et des « conséquences pour le spec »
> écrites avant la décision. Elles ne sont pas retouchées — une mesure ne se
> réécrit pas — mais chacune est suivie d'un encart *Ce qui a été décidé* qui dit
> où le projet est allé. **Ne pas suivre les pistes des sections T et D sans lire
> leur encart de clôture** : elles mènent chez un fournisseur qu'on a quitté.

## R · Restriction champ par champ dans les règles Firestore

Question du §12 : `diff(resource.data).affectedKeys().hasOnly([...])`
restreint-il réellement champ par champ ? Sinon, `server/current` se scinde en
deux documents.

Commande : `npm --prefix probe run probe:rules`

Mesuré le 2026-09-03, émulateur Firestore de `firebase-tools` 13.35.1, projet
`demo-beacon`, `rules_version = '2'`.

| Cas | Attendu | Observé |
|---|---|---|
| écriture d'un champ demandé | accepté | accepté |
| écriture d'un champ réservé seul | refusé | refusé |
| écriture mixte demandé + réservé | refusé | **refusé** |
| suppression d'un champ réservé | refusé | refusé |
| `state: RUNNING` depuis le navigateur | refusé | refusé |
| écriture par un non-membre | refusé | refusé |
| création du document par un client | refusé | refusé |
| réécriture d'un champ réservé à l'identique | inconnu — c'est l'observation | accepté, et sans effet |

Les huit cas ont d'abord été lancés contre des règles `allow read, write: if
false` : les six refus passaient et les deux écritures légitimes échouaient. Le
harnais parle donc bien à l'émulateur, et les résultats ci-dessus ne sont pas
ceux d'un test qui ne teste rien.

Le tableau ne suffisant pas à distinguer « refusé par `hasOnly` » de « refusé
parce que la règle a planté », `hasOnly` et son argument ont été instrumentés
par `debug()` le temps d'un passage. Ce que le journal de l'émulateur a rendu,
requête par requête :

| Écriture | `affectedKeys()` | `hasOnly(...)` |
|---|---|---|
| `deadline` | `{deadline}` | `true` |
| `ip` | `{ip}` | `false` |
| `deadline` + `ip` | `{deadline, ip}` | `false` |
| suppression de `ip` | `{ip}` | `false` |
| `state` | `{state}` | `true` |
| `ip` réécrit à sa valeur courante | `{}` | `true` |

**Verdict :** oui. `hasOnly` restreint champ par champ, et un seul champ
illégitime coule l'écriture entière : `{deadline, ip}` est refusé alors que
`{deadline}` seul est accepté. **`server/current` reste un seul document.**

Trois observations qui appartiennent à la tranche 4 :

- **Une réécriture à l'identique n'est pas une écriture.** `diff()` compare les
  valeurs, pas les clés soumises : réécrire `ip` avec sa valeur courante donne
  un `affectedKeys()` **vide**, donc `hasOnly` vrai, donc acceptation. Ce n'est
  pas un trou — rien n'a changé — mais une règle qui compterait sur `hasOnly`
  pour *détecter une tentative* se tromperait. Il restreint l'effet, pas
  l'intention.
- **`hasOnly` ne distingue pas l'écriture de la suppression.** Supprimer un
  champ réservé apparaît dans `affectedKeys()` exactement comme le modifier, et
  se refuse par le même prédicat. Aucune clause supplémentaire n'est nécessaire.
- **`'x' in affectedKeys()` n'est pas la bonne forme.** Le plan l'écrivait ainsi
  dans `assertsNoServerOnlyState()` ; `affectedKeys()` rend un `Set`, dont
  l'appartenance se teste par `hasAny(['x'])`. Corrigé avant exécution, la
  question mesurée étant `hasOnly` et non `in`.

**Piège de lecture de l'émulateur :** tout refus d'`update` est journalisé
`evaluation error at L24:24 for 'update' @ L24, false for 'update' @ L24` — une
erreur d'évaluation *en plus* du refus légitime. Elle apparaît aussi quand la
règle est réduite au seul `hasOnly`, et `debug()` prouve que ce même prédicat a
rendu un `false` propre sur la même requête. C'est du bruit de la voie
verbeuse de l'émulateur, pas un défaut des règles. Ne pas partir en chasse en
tranche 4.

**Conséquence pour le spec :** aucune. Le §5 tient tel qu'il est écrit —
`server/current` reste un document unique, dont la propriété des champs est
portée par `affectedKeys().hasOnly([...])`.

## I · Le conteneur amont `mornedhels/enshrouded-server`

Questions du §12 : ports UDP, emplacement et format des backups, variables
d'environnement disponibles, désactivation de l'auto-update.

Mesuré le 2026-09-03 sur la machine de développement, Docker 29.6.2, sans OVH.

- **Digest immuable retenu :**
  `mornedhels/enshrouded-server@sha256:85978a10f88a85ab0a0aa92e9821d30424895d38bf81fe543532451219c42d0d`
  — image de 0,68 Go, `org.opencontainers.image.version: 24.04`.

- **Ports UDP réellement en écoute : un seul, `15637/udp`.** Relevé dans
  `/proc/net/udp` du conteneur, serveur démarré : seul le port de requête Steam
  est lié, plus un port éphémère sortant. **`15636` n'est jamais lié.** L'image
  garde un `SERVER_PORT` dans ses valeurs par défaut, mais aucun code ne le
  consomme, et le README amont ne documente que `15637/udp`. Le plan et le §12
  du spec en attendaient deux.

- **Volume et point de montage des données :** `/opt/enshrouded`, avec
  l'installation du jeu sous `/opt/enshrouded/server`. Tout appartient à
  `PUID:PGID`, `4711:4711` par défaut. **8,9 Go** après installation complète
  par SteamCMD.

- **Chemin, format et rotation des backups :**
  `/opt/enshrouded/server/backups/AAAA-MM-JJ_HH-MM-SS-3ad85aea.zip`. L'archive
  contient la dernière sauvegarde, renommée en `3ad85aea` par `zipnote`, plus un
  fichier d'index reconstruit. La save vit dans
  `/opt/enshrouded/server/savegame`, sous les noms `3ad85aea` et
  `3ad85aea-index` — ce dernier est un JSON dont `.latest` désigne le fichier
  courant. Rotation par `BACKUP_MAX_COUNT`, **`0` par défaut, c'est-à-dire
  aucune rotation**. Le répertoire `backups/` n'est créé que si `BACKUP_CRON`
  est renseigné.

  **Le backup se déclenche à la demande :**
  `supervisorctl start enshrouded-backup`. C'est ce dont la tranche 3 a besoin —
  sauvegarder à l'arrêt de la session, pas selon un cron. Sans save, le script
  s'interrompt proprement sur `Save file not found - aborting backup`.

  **Mais il ne produit rien si `BACKUP_CRON` n'est pas renseigné**, et il sort
  quand même avec le code 0. Mesuré en session réelle, voir la section S.
  Le format a été **vérifié sur une vraie sauvegarde** en session réelle, et il
  est bien celui-ci — voir la section S.

- **Variable qui désactive l'auto-update, et vérification :** `UPDATE_CRON`, et
  **elle est déjà vide par défaut**. L'image ne pose de tâche planifiée que si
  la variable est renseignée ; avec les valeurs par défaut, la crontab de
  l'utilisateur `enshrouded` est vide et `/etc/cron.d` ne contient rien du jeu.
  Vérifié conteneur allumé. Le `UPDATE_CRON: ""` du `docker-compose` ne change
  donc rien techniquement — il est conservé pour dire l'intention, puisque
  hériter d'un défaut n'est pas la même chose que le décider.

  L'`enshrouded-updater` tourne bien une fois au démarrage : c'est l'installation
  du jeu, pas une mise à jour en cours de partie. C'est cette exécution-là qui
  fait les 8,9 Go.

- **`.Config.Env` de l'image ne fait pas autorité.** L'image ne déclare ni
  variable, ni port exposé, ni volume : `docker image inspect` ne rend que le
  `PATH`. La liste faisant autorité est
  `/usr/local/etc/enshrouded/defaults`, dans l'image.

### Le piège : `SERVER_PASSWORD` est dépréciée **et** destructrice

Lancé exactement comme le plan le prescrit — `SERVER_NAME`, `SERVER_PASSWORD`,
`SERVER_SLOT_COUNT` — le serveur démarre avec **le nom par défaut, 16 places, et
un mot de passe aléatoire que personne ne connaît**. Aucune des trois variables
n'est appliquée.

Le journal d'amorçage donne l'enchaînement :

```text
WARN - SERVER_PASSWORD is deprecated, pls consider using SERVER_ROLE_<index>_PASSWORD instead
WARN - falling back to "Default" server role password
jq: invalid JSON text passed to --argjson
WARN - default group (index: 0) has not the name "Default". Skipping password update!
```

Sans aucune variable `SERVER_ROLE_<i>_*`, l'indice de groupe reste vide et
`jq --argjson` échoue. Or l'image écrit sa configuration par
`echo "$(jq …)" > fichier` : quand `jq` échoue, la substitution est vide et **le
fichier est tronqué**. Le jeu, trouvant une configuration illisible, la
régénère entière — nom par défaut, 16 places, mot de passe tiré au sort.

C'est une panne silencieuse : le conteneur est `RUNNING`, le serveur répond, et
personne ne peut s'y connecter. Sur ce produit, où chaque session part d'une
instance neuve, elle se serait produite à **chaque** session.

**Forme correcte, vérifiée :** ne pas passer `SERVER_PASSWORD` du tout, et
utiliser `SERVER_ROLE_0_NAME` et `SERVER_ROLE_0_PASSWORD`. Relance sur le même
volume, configuration supprimée : nom `Beacon probe`, `slotCount` 4, mot de
passe `probe`, aucun avertissement.

Suffixes reconnus, pour `SERVER_ROLE_<index>_` : `NAME`, `PASSWORD`,
`CAN_KICK_BAN`, `CAN_ACCESS_INVENTORIES`, `CAN_EDIT_WORLD`, `CAN_EDIT_BASE`,
`CAN_EXTEND_BASE`, `RESERVED_SLOTS`. **Le gabarit de groupe de l'image met tous
les droits à `false` sauf `canEditWorld`** : un rôle créé par ces variables sans
les préciser donne des joueurs qui ne peuvent ni construire ni ouvrir les
coffres. Le §12 n'en parlait pas ; la tranche 2 doit les poser explicitement.

**Conséquence pour le spec :** deux corrections au §12 et à ce qui en dépend.
Un seul port UDP à ouvrir, `15637`, pas deux. Et le nom, le nombre de places et
le mot de passe de session se passent par `SERVER_ROLE_0_*`, jamais par
`SERVER_PASSWORD` — ce que le `cloud-init` de la tranche 2 devra rendre.

