# Tranche 3 bis — les deux sessions du second jeu

Relevé de la tâche 12, conduite le 2026-09-08 au soir. **Le gate se lève pour
Sunkenland** : deux sessions consécutives, la seconde restaurant ce que la
première a déposé, vérifié par empreinte.

**Coût réel : 0,10 €** — deux heures entamées à 0,0495 €/h, disque compris.
Le plan budgétait moins de 0,30 €.

## Ce que la tranche voulait prouver, et qui l'est

| | |
|---|---|
| La restauration tire **deux** sources | ✅ les 2,3 Go puis le monde, `restore` sorti en 0 avant que le conteneur de jeu existe |
| Le point de jonction n'est **pas une adresse** | ✅ `SunkenlandJoinInfo` publié : identifiant, région, nom du monde. Un joueur est entré **par la liste** |
| Le préfixe du ServerID est vérifié | ✅ le GUID annoncé est celui du catalogue, aux deux sessions |
| L'autosave écrit vraiment | ✅ propriétaire `7000:7000`, cadence 300 s |
| Le canal à un seul verbe | ✅ mesuré à la seconde, voir plus bas |
| Un monde revient à l'octet près | ✅ 11 empreintes identiques |

## Les mesures, à verser au §12

### Durées

| Étape | Session 1 | Session 2 |
|---|---|---|
| Ouverture → machine démarrée | 18 s | — |
| `cloud-init` avant le premier transfert | 2 min 41 s | — |
| **Les 2,3 Go, téléchargés et déballés** | **32,3 s** | ~ idem |
| Le monde, en plus | 0,6 s | — |
| `restore` complet | 32,9 s | — |
| Démarrage du jeu → `Server Start Complete` | 2 min 25 s | 2 min 55 s |
| **Ouverture → `RUNNING`** | **6 min 43 s** | **8 min 08 s** |

**L'archive unique n'a pas accéléré le transfert.** La sonde mesurait 16 s en
247 objets ; on est à 32 s en une archive, soit **deux fois plus lent**. La
décision du 2026-09-08 justifiait l'archive unique par la simplicité du chemin
de code et non par la vitesse, donc elle tient — mais l'hypothèse implicite
« ça ira au moins aussi vite » est fausse.

**Le démarrage dépend de l'histoire du monde.** 2 min 25 s sur le monde
d'amorçage, 2 min 55 s sur le même monde après une soirée de jeu — dont 4,7 s
de ramasse-miettes Unity sur le seul chargement. Personne ne l'avait mesuré, et
c'est ce que deux sessions apportent qu'une seule ne peut pas.

### L'arrêt propre, enfin observé

La tranche 3 avait écrit ce comportement sans jamais le voir, la machine étant
détruite avant. Relevé à la seconde, session 2 :

```
22:10:30   -         path=active  svc=inactive     jeu=running
22:10:31   DRAPEAU   path=active  svc=activating   jeu=running
22:10:32   DRAPEAU   path=active  svc=activating   jeu=exited
22:10:33   -         path=active  svc=inactive     jeu=exited
```

- **Le drapeau vit exactement 2 secondes.** Un relevé toutes les 3 s ne le voit
  pas — c'est ce qui est arrivé à la session 1, où il n'apparaît sur aucun
  échantillon alors que l'unité avait manifestement tiré.
- `beacon-stop.path` tire en **moins d'une seconde**, et n'est **jamais**
  `failed` : l'`ExecStartPost=` efface bien, donc pas de redéclenchement sur son
  propre succès, donc pas d'épuisement de la limite de démarrage de systemd.
- **Le jeu s'arrête en 1 seconde.** C'est la mesure qui valide le `trap` amont :
  sans lui, `docker stop -t 90` aurait attendu 90 s puis tué de force,
  éventuellement au milieu d'une sauvegarde.

### Les trois minutes de grâce, confirmées

Pour ce jeu la sonde ne redevient jamais fausse — le fichier `serverid` survit à
l'arrêt du conteneur —, donc `stopAndPush` épuise toute sa fenêtre :

| | Arrêt du jeu | `pre-shutdown` déposée | Écart |
|---|---|---|---|
| Session 1 | 18:54:19 | 18:57:16 | **177 s** |
| Session 2 | 22:10:32 | 22:13:31 | **179 s** |

**La fermeture d'une soirée de ce jeu coûte donc trois minutes de machine
facturée de plus que celle du premier.** C'est délibéré et commenté dans le
code, mais c'est la première fois que c'est mesuré, et le budget du plan ne le
comptait pas. Loin sous le filet de `stoppingTimeoutMs` (10 min).

### La contradiction J/V, tranchée

`probe/RESULTS.md` donnait la ligne d'annonce sous **deux formes
contradictoires** — trois lignes en section J, une seule en section V. Le filtre
avait été corrigé pour n'apparier que `ServerID is '`, qui marche dans les deux.

**C'est la forme de la section V qui sort :**

```
Server Start Complete, Ready for Clients to Join. ServerID is '4db51c84-…~639244891626914283'.
9/8/2026 6:34:22 PM WorldName:Beacon's World, ServerID:…, Region:eu, IsPublic:True, Current/MaxPlayer 0/4
```

La troisième ligne porte `ServerID:` sans apostrophe : le filtre ne s'apparie pas
dessus et n'écrase donc pas la valeur déjà écrite. La garde écrite pour la forme
J était de la prudence utile, pas une nécessité — mais elle reste, puisque rien
ne dit que la forme ne changera pas.

### Le retour du monde, par empreinte

La session 2 est allée chercher
`saves/sunkenland/pre-shutdown/9e0bfb65-…/2026-09-08T18-57-16Z.tar.gz`
(156 590 octets) — la plus récente, déposée par la session **précédente**, dont
la clé porte l'identifiant de session de celle qui l'a écrite.

Les **onze fichiers qui font foi** — `Cache.json` et les dix `.meta`, la sonde
ayant établi que le numéro le plus élevé du tampon circulaire n'est pas le plus
récent — sont **identiques à l'octet près** entre l'archive déposée et le monde
restauré.

Le joueur a retrouvé sa partie, sauvegarde console comprise.

### Autres valeurs relevées

- **`-adminSteamIDs` fonctionne** : un admin déclenche une sauvegarde depuis la
  console du jeu, ce qui est le seul moyen d'en provoquer une. La constante du
  catalogue est bien l'un des comptes de l'administrateur.
- **Cadence de poussée** : 5 min 02 s d'écart mesuré entre deux autos.
- **Le ServerID change à chaque démarrage**, le GUID restant : `~639244891626914283`
  puis `~639245016693175334`.
- **L'IP est réattribuée** d'une session à l'autre — même adresse, machine
  neuve, donc la clé d'hôte SSH change à chaque fois. Papercut connu désormais.

## Ce qui a raté, et c'est la partie utile

**Une bascule de branche invisible a coûté deux sessions mortes.** L'arbre de
travail était passé sur `main` entre les deux soirées. L'émulateur servait donc
un code sans la tranche 3 bis, `catalogFor('sunkenland')` levait encore, et la
session tombait en `IDLE` aussitôt après `PROVISIONING`. **Rien dans le pilote ne
dit quel code est servi** — le seul signal était la phrase exacte au journal
d'audit, *« no catalogue entry for sunkenland: it arrives with the companion, in
tranche 3 »*, qui est justement celle que cette tranche a supprimée.

La seule bonne nouvelle de ces deux tentatives : **`ProvisioningFailed` a fait
son travail**. La session est morte immédiatement et proprement, sans qu'aucune
machine ne soit allumée.

**Le tunnel expire avec sa fenêtre, et `dist/.env` est une copie.** Entre les
deux soirées, l'URL `trycloudflare` avait changé. Le report dans
`apps/functions/.env` ne suffit pas : l'émulateur lit `apps/functions/dist/.env`,
reposé par le build, et il le charge **au démarrage**. L'ordre est donc
contraignant — tunnel, puis build, puis émulateur — et rien ne le rappelle.

**Une fausse alerte, la mienne.** J'ai lu `server/current` une minute avant la
publication et annoncé une panne qui n'existait pas, puis passé plusieurs
vérifications à chercher une cause. Ce qui l'a rendue crédible mérite d'être
écrit : **l'agent ne journalise rien quand tout va bien**. Entre l'identifiant
écrit et la publication, `docker logs beacon-agent` est vide, et une machine
saine est indistinguable d'une machine muette.

**Deux défauts trouvés en conduisant le geste**, tous deux corrigés :

1. **L'endpoint que rclone stocke sans schéma.** Le remote porte
   `s3.fr-par.scw.cloud`, le SDK AWS exige une URL absolue → `TypeError: Invalid
   URL` au moment du dépôt.
2. **Un flux de lecture que personne ne fermait**, dans `libs/scaleway-storage`
   et donc **sur `main`**. Un envoi qui échoue avant d'avoir lu le flux laissait
   l'appelant effacer son fichier temporaire, puis le flux s'ouvrait dans le vide
   et émettait une erreur sans écouteur : le processus mourait au lieu de
   remonter la cause. `deploy/companion` partage cet adaptateur — **sur une
   machine de jeu, une poussée ratée aurait tué l'agent** au lieu de rapporter
   `failed`, dont le §8 fait une défense de la sauvegarde.

**Et un tag brûlé.** `companion-v0.2` a échoué sur une course que la barrière de
fumée a attrapée sur un runner Linux : `docker compose up -d bucket` rendait la
main au démarrage du conteneur et non quand MinIO répondait — `Started`, puis
connexion refusée **154 ms plus tard**. La course vivait sur `main` depuis
l'origine du harnais ; un poste la perd assez rarement pour paraître vert.
Corrigée par `--wait`, qui lit enfin le `healthcheck` que le service déclarait
déjà. Publié en `companion-v0.3`.

## Ce que la tranche laisse

- **Les deux formes de `JoinInfo` ne s'affichent nulle part.** L'écran est la
  tranche 5.
- **`-adminSteamIDs` est nourri par une constante du catalogue.** La tranche 4
  apporte `members` et son `steamId`, et reprendra cette valeur.
- **La charge à plusieurs joueurs n'est toujours pas mesurée.**
- **Le décalage de version Photon reste une déduction**, et il se combine mal
  avec la mise à jour manuelle : une archive non rafraîchie après une mise à jour
  du jeu produit une panne que **rien ne diagnostique**. `game-depot update` est
  la seule chose qui l'empêche, et c'est un geste à refaire à chaque version.
- **Le nom du binaire du serveur vit dans deux projets** qui ne peuvent pas
  s'importer. Deux tests l'épinglent des deux côtés, mais aucun ne l'exécute :
  si le nom change **dans l'image amont**, les deux restent verts et faux
  ensemble.
- **L'import/export de monde n'a pas de domicile.** Le geste d'amorçage vit dans
  `deploy/scaleway/bootstrap-world.ps1` ; il ne peut pas rejoindre `game-depot`,
  que le §4 tient délibérément aveugle au préfixe des sauvegardes. Décision du
  2026-09-08 : rien n'est ouvert tant que le geste n'a pas servi plusieurs fois.
- **La copie en vrac du monde de la sonde** reste sous `saves/sunkenland/` sans
  préfixe d'origine. `parseObjectKey` l'ignore, aucune restauration ne l'atteint,
  et aucune règle de cycle de vie ne l'élague.
