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

## T · Le tag sur l'instance et sur l'IP flottante

Question du §12 : l'API OVH accepte-t-elle des métadonnées libres sur
l'instance **et** sur l'IP flottante, et sait-elle les lister ? Toute la
réconciliation du watchdog en dépend.

**Répondue à moitié, et sans un centime.** Le plan mettait la lecture du schéma
en premier en pariant qu'elle pouvait trancher sans allumer de machine. Elle
tranche : le mécanisme 1 est mort, et l'instance facturée que la tâche 3 prévoyait
pour le vérifier n'a plus lieu d'être.

Commandes, le 2026-09-03, sur le schéma public `https://eu.api.ovh.com/1.0/cloud.json`,
sans authentification et sans projet :

```bash
npm --prefix probe run ovh:schema -- floatingip
npm --prefix probe run ovh:schema -- metadata
npm --prefix probe run ovh:schema -- monthlybilling   # isole la creation d'instance
npm --prefix probe run ovh:schema -- openstack
npm --prefix probe run ovh:schema -- instancegroup
```

| Ressource | Métadonnée à la création | Rendue par la liste | Filtrable |
|---|---|---|---|
| instance, API v1 | **non** | — | — |
| IP flottante, API v1 | **non** | — | — |
| instance, OpenStack | non mesuré — demande un projet | | |
| IP flottante, OpenStack | non mesuré — demande un projet | | |

Ce que disent les modèles, mot pour mot :

- `cloud.ProjectInstanceCreation` : `autobackup`, `availabilityZone`, `flavorId`,
  `groupId`, `imageId`, `monthlyBilling`, `name`, `networks`, `region`,
  `sshKeyId`, `userData`, `volumeId`. **Pas de `metadata`.**
- `cloud.instance.Instance`, en lecture : mêmes champs plus `created`,
  `ipAddresses`, `status`, `planCode`… **Pas de `metadata`.** Le seul champ
  libre est `name`.
- `cloud.project.FloatingIp` : `associatedEntity`, `id`, `ip`, `networkId`,
  `region`, `status`. **Six champs, aucun libre** — pas même un `name`.
- `cloud.instance.AssociateFloatingIp` : `floatingIpId`, `gateway`, `ip`. Rien
  d'autre ne peut être posé à l'attachement.
- Aucun chemin de l'API ne contient « metadata ». Les seuls modèles qui en
  portent sont ceux de Kubernetes et `iam.ResourceMetadata`, qui décrit des
  ressources IAM, pas des instances.

Un `POST` peut toujours accepter en silence un champ que le schéma ignore, et
c'est l'un des trois résultats que le plan envisageait. Mais cela ne changerait
rien : **aucun modèle de lecture ne rend de métadonnée**, donc rien de ce qu'on
poserait ne pourrait être relu, listé ni filtré. Le mécanisme du §5 a besoin de
retrouver le tag, pas de l'écrire. C'est pour cela que la réponse est « non »
sans avoir à créer l'instance.

**Deux pistes explorées et écartées :**

- **Les groupes d'instances.** `cloud.instancegroup.InstanceGroup` n'a que
  `id`, `instance_ids`, `name`, `region`, `type` — et `type` vaut `affinity` ou
  `anti-affinity`. C'est un mécanisme de placement, il ne contient que des
  instances, jamais une IP flottante.
- **Le tag IAM.** `iam.ResourceMetadata` porte bien `tags: map[string]string`,
  mais il décrit le projet (`cloud.ProjectWithIAM`), pas les ressources qu'il
  contient.

**Erreur du plan, corrigée ici :** la route d'attachement n'est pas
`.../instance/{instanceId}/attachFloatingIp` mais
`.../instance/{instanceId}/associateFloatingIp`. Les routes réelles sont :

```text
GET    /cloud/project/{sn}/region/{r}/floatingip
GET    /cloud/project/{sn}/region/{r}/floatingip/{id}
DELETE /cloud/project/{sn}/region/{r}/floatingip/{id}
POST   /cloud/project/{sn}/region/{r}/floatingip/{id}/detach
POST   /cloud/project/{sn}/region/{r}/instance/{id}/associateFloatingIp
POST   /cloud/project/{sn}/region/{r}/instance/{id}/floatingIp
```

L'inventaire et le faucheur de la tâche 2 emploient déjà les bonnes.

**Ce qui reste à mesurer, et qui demande un projet Public Cloud :**

- **Le mécanisme 2, OpenStack.** La route existe :
  `POST /cloud/project/{sn}/user/{userId}/token`, corps
  `cloud.ProjectUserTokenCreation { password }`, réponse
  `cloud.authentication.Token { X-Auth-Token, token }`. C'est par là qu'on
  atteint Nova et Neutron, où les métadonnées sont natives. Non essayé.
- **Le repli, mécanisme 3.** Sa forme est confirmée par le schéma :
  `cloud.project.FloatingIp.associatedEntity` porte `{ gatewayId, id, ip, type }`
  et `type` vaut `dhcp | instance | loadbalancer | routerInterface | unknown`.
  Une IP attachée se rapproche donc de son instance, et l'instance porte le
  `name` libre. Reste à observer **ce que devient `associatedEntity` sur une IP
  détachée** — c'est ce qui décide si une IP orpheline reste rattachable à une
  session.

**Conséquence pour le spec, écrite le 2026-09-03 avant la décision :** le §5 et
le §6 ne peuvent pas tenir tels quels. Ils font reposer la réconciliation sur
une métadonnée `beacon:{sessionId}` posée sur l'instance **et** sur l'IP
flottante ; l'API v1 ne sait poser ni l'une ni l'autre. Soit l'adapter parle à
OpenStack — et ce n'est plus un détail d'implémentation mais une dépendance du
spec —, soit la réconciliation passe par le `name` de l'instance et
l'attachement de l'IP.

### Ce qui a été décidé, le 2026-09-03

**Ni l'un ni l'autre : le projet a changé d'hébergeur.** OpenStack n'a pas été
essayé, et ne le sera pas. Le §2 du spec porte la décision et son motif ;
Scaleway a `tags` en natif sur le serveur **et** sur l'IP flottante, ce que le
§5 demandait depuis le début.

Les deux mécanismes de repli ci-dessus sont donc caducs. Ils restent écrits
parce qu'ils disent ce qui a été mesuré, et que la mesure ne se retouche pas —
mais **ce n'est plus la piste à suivre**. Ce qui reste à faire est la
vérification en vivo du tag Scaleway, décrite à la tâche 3 du plan de la
tranche 0, et son résultat s'écrira ci-dessous.

**Mécanisme retenu pour la tranche 1 :** deux tags Scaleway — `beacon` constant
pour énumérer, `session:{sessionId}` pour apparier. Le tag constant n'est pas
une redondance : le filtre `tags=` de Scaleway est exact, et la réconciliation
interroge sur des sessions dont elle ignore l'identifiant. Voir §5 du spec.

### Vérification en vivo chez Scaleway

Ligne de base de l'inventaire, `npm --prefix probe run scw:inventory`, le
2026-09-03 : **projet vide** — zéro serveur, zéro IP flottante, zéro volume en
`fr-par-1`. C'est l'état auquel la tranche doit revenir. Le faucheur à vide
répond `dry run` et ne liste rien.

Alerte de consommation posée à **5 €/mois** dans la console, avant toute
création facturée. Le plan visait 2 € ; 5 € reste très au-dessus des ~0,20 €
attendus pour la tranche entière, donc le garde-fou joue son rôle.

| Ressource | Tag à la création | Rendu à la relecture | Filtrable par `tags=` |
|---|---|---|---|
| IP flottante | **oui** | **oui** | **oui** |
| serveur | **oui** | **oui** | **oui** |

Mesuré le 2026-09-03 par `npm --prefix probe run scw:tag`, sur une IP créée puis
détruite. Les deux tags posés — `beacon-probe` et `session:probe0001` — sont
rendus tels quels par l'appel de création **et** par la relecture unitaire, et
chacun retrouve l'IP par `listIps({ tags: [...] })`.

**Le filtre est exact, pas préfixe.** `tags=['session:']` rend une liste vide
alors que `tags=['session:probe0001']` rend l'IP. C'est la mesure qui justifie
le schéma à deux tags du §5 : sans un tag constant, le watchdog n'aurait rien à
demander à l'API pour énumérer des ressources dont il ignore le `sessionId`. La
correction faite après la relecture était la bonne, et elle n'était pas
optionnelle.

**Une IP non attachée rend `server: null`.** Le SDK type le champ
`server?: ServerSummary`, donc *absent* ; l'API rend *nul*. Les deux formes
existent selon le chemin, et c'est pourquoi la règle du faucheur teste
`server?.id != null` plutôt que l'une des deux — le test de régression qui garde
cette forme n'est pas décoratif.

**Le faucheur a été éprouvé en vrai, sur les IP.** Deux IP taguées créées par
deux passages de la sonde, listées puis détruites par
`scw:reap -- --yes`, inventaire revenu à zéro. Le filtre par tag ramène bien un
ensemble et non le dernier créé : les deux apparaissaient dans la même réponse.

**Le quota bloque la création de serveur.** `createServer` rend
`403 quotas_exceeded` sur un compte créé le jour même, alors que les IP passent.
La cause probable — un compte non encore validé, sans moyen de paiement
enregistré — reste à confirmer ; le détail renvoyé par Scaleway est désormais
affiché par la sonde, qui l'avalait.

#### `terminate` refuse un serveur qui n'a jamais démarré

C'est le trou le plus discret de la journée, et il visait le watchdog.

```text
PreconditionFailedError: precondition failed: resource_not_usable,
invalid state 'stopped' for the action 'terminate'
```

`terminate` prend le serveur **et ses volumes** en un appel, mais l'API le refuse
sur tout ce qui ne tourne pas. Une machine jamais allumée meurt par
`deleteServer` — **qui laisse ses disques derrière**, facturés, détachés, et
absents de la liste des serveurs.

Or c'est exactement le cas que le §6 prévoit déjà : *« `PROVISIONING` depuis plus
de 15 min → destruction »*. Une instance dont le boot a échoué est `stopped`.
**Le watchdog de la tranche 1 aurait abandonné un volume de 80 Go à chaque
provisionnement raté**, sans que rien ne le signale — ni le §5, ni l'inventaire,
ni l'alerte de budget avant longtemps.

Le faucheur applique désormais les deux chemins, et la politique porte la
décision plutôt que le script : `DoomedServer.terminable` dit lequel, et
`volumeIds` liste ce qu'il faudra effacer soi-même. Deux cas de test la
couvrent. **La tranche 1 doit reprendre cette distinction telle quelle.**

Vérifié de bout en bout le 2026-09-03 : serveur `stopped` supprimé, son volume
de 80 Go supprimé dans la foulée, inventaire revenu à zéro sur les trois listes.

#### Le disque de `DEV1-L` est une ressource, pas une abstraction

Créé avec le serveur, listé à part sous le nom `Ubuntu 24.04 Noble Numbat`,
80 Go, attaché. **Il ne porte aucun tag** — ceux posés sur le serveur ne
descendent pas sur son volume. C'est ce qui justifie la règle du faucheur : un
volume détaché est signalé, jamais détruit d'autorité, parce que rien ne permet
de prouver qu'il est à nous.

#### Le catalogue des gabarits, `fr-par-1`

`npm --prefix probe run scw:products` — lecture seule, aucune ressource créée.
Cinquante types commercialisés dans la zone. Ceux à 8 Gio de RAM :

| Gabarit | vCPU | Stockage local | €/h |
|---|---|---|---|
| `BASIC1-X2C-8G` | 2 | 40 Go | **0,0286** |
| `BASIC2-A2C-8G` | 2 | aucun, volume bloc | 0,0345 |
| `BASIC1-X4C-8G` | 4 | **100 Go** | **0,0428** |
| `DEV1-L` | 4 | 80 Go | 0,04284 |
| `BASIC2-A4C-8G` | 4 | aucun, volume bloc | 0,0517 |
| `BASIC3-X2C-8G` | 2 | aucun, volume bloc | 0,059225 |
| `BASIC3-X4C-8G` | 4 | aucun, volume bloc | 0,079001 |
| `COMPUTE3-X4C-8G` | 4 | aucun, volume bloc | 0,117 |

**`DEV1-L` est confirmé** : commandable, 4 vCPU, 8 Gio, jusqu'à 80 Go de volume
local inclus, 0,04284 €/h — exactement ce que le §2 supposait, et le tarif
relevé sur la grille publique est le tarif appliqué au projet.

**`PRO2` n'existe pas en `fr-par-1`.** Le repli nommé au §2 n'est pas
commandable dans la zone où l'on déploie. Le catalogue ne le rend pour aucune
recherche.

**`BASIC1-X4C-8G` a semblé meilleur, et ne l'est pas.** Mêmes 4 vCPU et 8 Gio
que `DEV1-L`, 100 Go de local au lieu de 80, à quatre cent-millièmes d'euro de
l'heure près. Il est devenu le défaut du §2 pendant une heure — puis la
création a rendu `403`, et la raison est plus bas.

> **Ce relevé a été fait avec l'appel REST `/products/servers`, et il est
> incomplet.** Le `listServersTypes` du SDK rend 100 types là où celui-ci en
> rendait 50, dont `POP2`, `PLAY2`, `MEMORY3` et `GP1`. L'affirmation « `PLAY2`
> et `STANDARD2` ne sont commandables dans aucune zone parisienne » était donc
> fausse : elle mesurait le silence d'un endpoint, pas l'absence d'une gamme.
> Seul `PRO2` reste absent, confirmé par les deux appels. Le tableau ci-dessous
> le remplace.

`DEV1-S` **n'existe pas** : de la gamme `DEV1`, seul le `L` subsiste ici. Le
plan de la tâche 3 le prenait comme gabarit jetable pour la sonde de tag ;
l'appel aurait rendu un 400 après la création de l'IP facturée. Corrigé en
`BASIC1-X1C-2G`, **0,0068 €/h**, le moins cher de la zone.

#### Le catalogue dépend de la zone, et contredit la grille publique

| | `fr-par-1` | `fr-par-2` | `fr-par-3` |
|---|---|---|---|
| `DEV1-L` | 0,04284 | absent | absent |
| `BASIC1-X4C-8G` | 0,0428 | 0,0428 | 0,0642 |
| gammes propres | `BASIC1/2/3`, `COMPUTE3`, `DEV1` | idem sans `DEV1` | `BASIC1`, `POP2`, `GP1` |

Deux constats qui valent au-delà du choix de gabarit :

- **`PRO2`, `PLAY2` et `STANDARD2` sont vendus sur la grille publique et
  commandables dans aucune zone parisienne.** Le §2 nommait `PRO2-XXS` en repli ;
  il n'aurait pas pu être commandé.
- **`BASIC1` est commandable et facturé sans figurer à la grille publique.** La
  page tarifaire et le catalogue du projet se contredisent dans les deux sens ;
  c'est le catalogue qui facture, donc c'est lui qui fait foi. Ni `BASIC1` ni
  `DEV1` ne figure parmi les
  [offres historiques](https://raw.githubusercontent.com/scaleway/docs-content/main/pages/instances/reference-content/historical-offers.mdx)
  de Scaleway, qui ne liste que `COPARM1`, `ENT1`, `VC1`, `X64` et `START1`.

**La zone est donc une décision, et elle ne l'était pas.** `fr-par-1` était une
valeur par défaut posée dans `.env.example` sans vérification. Le §2 l'acte
désormais.

#### Un catalogue ne dit pas ce qu'on peut créer

C'est la leçon de la séance, et elle a coûté une décision fausse. Un type peut
être **listé, tarifé, non obsolète — et refuser d'être créé faute de capacité
dans la zone**. `createServer` rend alors `403 quotas_exceeded`, dont le libellé
oriente vers un quota de compte qui n'a rien à voir.

`getServerTypesAvailability` est ce qui le dit, et rend `available`, `scarce`
ou `shortage`. Relevé le 2026-09-03, à 8 Gio :

| Gabarit | vCPU | Disque | €/h | Disponibilité |
|---|---|---|---|---|
| `BASIC1-X2C-8G` | 2 | 40 Go locaux | 0,0286 | **shortage** |
| `BASIC2-A2C-8G` | 2 | bloc | 0,0345 | available |
| `BASIC1-X4C-8G` | 4 | 100 Go locaux | 0,0428 | **shortage** |
| **`DEV1-L`** | **4** | **80 Go locaux** | **0,04284** | **available** |
| `BASIC2-A4C-8G` | 4 | bloc | 0,0517 | available |
| `PLAY2-MICRO` | 4 | bloc | 0,05508 | scarce |
| `BASIC3-X4C-8G` | 4 | bloc | 0,079001 | available |
| `POP2-HC-4C-8G` | 4 | bloc | 0,1064 | available |

**Toute la famille `BASIC1` est en pénurie**, et c'est la seule autre à porter du
stockage local. `DEV1-L` est donc le seul gabarit à 8 Gio qui soit à la fois
disponible et livré avec son disque — il est le défaut du §2 non par préférence
mais faute d'alternative.

**`BASIC1` ne doit pas être traité comme une option en attente.** Une gamme
entière en pénurie sur tous ses calibres, et absente de la grille tarifaire
publique, est une gamme retirée dont les drapeaux n'ont pas suivi : aucun de ses
types n'est marqué `endOfService`, et elle n'apparaît pas non plus dans les
offres historiques de Scaleway. Les deux champs disent « vivante », la capacité
dit le contraire, et c'est la capacité qui décide. Ne pas la reconsidérer.

**Ce qui laisse le défaut du §2 sans équivalent, et c'est le vrai risque.**
`DEV1-L` appartient lui aussi à une gamme ancienne, dont il est le seul calibre
survivant en `fr-par-1` — `DEV1-S`, `DEV1-M` et `DEV1-XL` ont déjà disparu du
catalogue. S'il suit `BASIC1`, il n'y a pas de repli à disque local : **tout
substitut à 8 Gio est en stockage bloc.**

Le travail que cela déclencherait est connu et chiffré :

- le §5 gagne un `volumeId` à écrire, réconcilier et détruire ;
- le §6 gagne une ligne de watchdog ;
- `scaleway-compute` doit parler une **seconde API**, le Block Storage étant un
  produit distinct — les types de volumes de l'API Instance en `fr-par-1` sont
  `l_ssd` et `scratch`, pas de bloc.

Ce n'est donc pas « non, jamais » mais « pas maintenant, et voici le
déclencheur ». La tranche 1 gagnerait à surveiller la disponibilité de `DEV1-L`,
puisque sa disparition est le seul événement qui rende ce travail obligatoire.

**La disponibilité est une donnée d'exécution, pas de conception.** Le §6 traite
« création refusée » comme un incident banal ; il l'est, mais la tranche 2
gagnerait à lire `getServerTypesAvailability` avant de créer, et à dire à
l'utilisateur « pas de capacité ce soir » plutôt que « échec ».

`BASIC1-X2C-8G`, à 0,0286 €/h avec 2 vCPU et 40 Go de local, aurait été le tiers
moins cher. Il ne l'est pas : toute sa famille est en pénurie, voir plus bas.

Le prix de l'IPv4 n'est pas dans ce catalogue : il se lit sur la grille réseau,
0,005 €/h, et reste à recouper sur une facture.

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

## D · Les trois questions documentaires

| Question du §12 | Réponse | Source |
|---|---|---|
| tarif `b3-8` après le 2026-10-01, stockage et IPv4 compris ou non | **45 €/mois HT tout compris, soit ~0,0616 €/h**, contre 37 € avant (+19,5 %). Le prix horaire de l'instance seule ne bouge pas ; ce qui change est que l'IPv4 (0,0027 €/h, ~1,97 €/mois) et le stockage local « Low Latency » (0,0001458 €/Go/h, ~0,11 €/Go/mois, soit ~5,50 €/mois pour les 50 Go du `b3-8`) sortent du prix de base. | [blog OVHcloud, tarifs au 1er octobre 2026](https://blog.ovhcloud.com/en/posts/public-cloud-pricing-update-october-2026/) — grille publique. **Recoupement par l'API `npm --prefix probe run ovh:price` en attente du jeton OVH.** |
| Cloud Monitoring alerte-t-il sur l'**absence** d'exécution d'un job Scheduler, et à quel coût | **Oui.** Une condition d'absence de métrique se pose sur une série temporelle, avec une fenêtre configurable jusqu'à **23,5 h**. Les politiques d'alerte et les canaux de notification par e-mail ne sont pas facturés ; seule l'ingestion de métriques le serait, et les métriques Google Cloud comme `cloudscheduler.googleapis.com/job/attempt_count` sont gratuites. | [Create metric-absence alerting policies](https://docs.cloud.google.com/monitoring/alerts/metric-absence) |
| le déploiement Firebase accepte-t-il l'identité fédérée OIDC sans clé entreposée | **Oui.** `google-github-actions/auth@v2` avec `workload_identity_provider` et `create_credentials_file` écrit un fichier d'identifiants externes et exporte `GOOGLE_APPLICATION_CREDENTIALS` ; la CLI Firebase le consomme par les Application Default Credentials. Le support côté SDK Admin, longtemps absent, existe depuis le 2024-11-12. | [google-github-actions/auth](https://github.com/google-github-actions/auth), [firebase-tools#3926](https://github.com/firebase/firebase-tools/issues/3926) |

**Le piège de l'alerte sur absence, et il est sérieux.** La documentation est
explicite : *« Metric-absence conditions require at least one successful
measurement — one that retrieves data — within the maximum period of time after
the policy was installed or modified »*, et *« The condition won't be met when
the subsystem that writes metric data has never written a data point »*.

Autrement dit : **un watchdog qui n'a jamais tourné une seule fois ne déclenche
aucune alerte.** L'alerte détecte l'arrêt, pas l'absence de départ. Le §6 du
spec en fait le seul garde-fou du watchdog ; il l'est pour la panne, pas pour le
job jamais créé ou supprimé. La tranche 1 doit donc vérifier la première
exécution autrement — à la main, une fois, à la pose du job.

**Conséquence pour le spec, écrite le 2026-09-03 avant la décision :** le §11 est
à refaire. Le tableau des coûts table sur ~0,047 €/h ; le tarif OVH applicable
est ~0,0616 €/h, soit **+31 %**. Un mois à 32 h passerait de ~1,50 € à ~1,97 €,
et le point d'équilibre contre la référence de 7,90 €/mois descendrait
d'environ **165 h à environ 127 h**. Le pari tient largement — on parle de 32 h
de jeu par mois — mais les chiffres écrits sont faux.

Le §6 doit dire ce que l'alerte sur absence ne couvre pas.

### Ce qui a été fait, le 2026-09-03

Cette hausse est **le second motif de la bascule vers Scaleway** (§2 du spec).
Le §11 a été refait sur les tarifs Scaleway et non sur ceux d'OVH : le point
d'équilibre est revenu à ~163 h, `DEV1-L` plus son IP revenant à ~0,0478 €/h —
soit très exactement le tarif sur lequel le pari initial était bâti. Les 127 h
ci-dessus décrivent le monde qu'on n'a pas choisi.

Le §6 porte désormais la limite de l'alerte sur absence.

Les deux réponses de monitoring et d'identité fédérée ne dépendent pas de
l'hébergeur : elles restent valides telles quelles. Le tarif, lui, est à
recouper avec le catalogue du projet Scaleway — c'est une question ouverte du
§12, pas une réponse.

