# Les deux sessions qui prouvent qu'un monde revient — 2026-09-07

Ce que la tranche 3 a éprouvé deux fois de suite, à la main, et qu'aucun double
en mémoire ne pouvait prouver. Deux sessions Enshrouded sur une `DEV1-L` en
`fr-par-1`, la seconde ouverte quatre minutes après la fin de la première :

| | Session 1 | Session 2 |
|---|---|---|
| `sessionId` | `df39cecf-0a5b-4f5c-b1e7-aac1f6c4d44d` | `b7c68a42-d9c7-4c56-9a0f-085cc2074e40` |
| Clic d'ouverture | 22:04:50Z | 22:35:48Z |
| `RUNNING` | 22:12:59Z — **8 min 09** | 22:42:48Z — **7 min 00** |
| Serveur réellement joignable | **oui**, A2S en 61 ms | **oui**, A2S en 79 ms |
| Arrêt propre | **52 s**, `pre-shutdown` de 72 767 o | **36 s**, `pre-shutdown` de 36 860 o |
| Coût annoncé par le domaine | 0,05 € | non relevé — même heure entamée |

Les deux ont porté l'IP `51.15.139.149` — réattribuée, l'instance étant
différente. Le plan de contrôle tournait dans l'émulateur, exposé à la machine
par un tunnel `cloudflared` : **le sens du trafic s'inverse à cette tranche**,
la VM appelant le plan de contrôle au lieu de seulement en être la cible.

## Ce que la tranche promettait, et ce qui est tenu

**L'écart entre `RUNNING` et un serveur joignable est nul.** `RUNNING` s'écrit
parce que l'agent a sondé le serveur et obtenu une réponse ; une sonde A2S
indépendante, lancée depuis un autre poste dans la foulée, le confirme. La
session du 2026-09-06 mesurait jusqu'à **11 min 48** d'écart, et le spec en
annonçait cinq à huit.

**Le prix de cette vérité est visible et il est payé au bon endroit.**
`PROVISIONING` passe de vingt-six secondes à sept ou huit minutes : le délai
n'est pas apparu, il était déjà là et il était menti. Le plafond porté à
25 minutes par la tâche 5 garde une marge de trois.

**Le monde est revenu.** `docker logs beacon-restore`, session 2 :

```
beacon: restored saves/enshrouded/pre-shutdown/df39cecf-.../2026-09-07T22-31-16Z.tar.gz (72767 bytes)
```

Même clé, même taille au bit près que ce que la session 1 avait déposé à
22:31:16Z. Et c'est bien la `pre-shutdown` qui a été choisie, pas l'`auto` de
22:28:05 : le tri du plus récent au plus ancien fonctionne sur des données
réelles, pas seulement sur les clés forgées d'un test.

**En jeu : l'autel de flamme, le coffre, les fondations, et le contenu du
coffre.** Le dernier point est le plus fort — ce n'est pas de la géométrie posée
sur un terrain, c'est de l'état d'inventaire, et un monde généré à neuf n'en
contient aucun.

## Ce que la séquence a confirmé

**L'arrêt propre du §6, observé de bout en bout pour la première fois.**

```
22:30:24Z  STOPPING ecrit, la machine reste allumee
22:31:16Z  pre-shutdown deposee (72 767 o)
22:31:17Z  IDLE · SessionStopped « stopped after the final save » · 0,05 EUR
```

Cinquante-deux secondes, et **les inconnues tombent ensemble parce qu'elles ne
pouvaient tomber qu'ensemble** : sans l'unité systemd le jeu ne s'arrête pas ;
sans arrêt pas de silence ; sans silence pas de poussée ; sans poussée pas de
rapport `saved` ; sans ce rapport pas de destruction. La moitié hôte du canal à
un seul verbe existe donc et fonctionne, ce qu'aucun test du dépôt ne pouvait
dire. Le détail de l'événement — « stopped after the final save » — est
littéralement vrai, ce qui n'était pas le cas avant la correction de l'ordre.

**L'unité s'arme seule.** `beacon-stop.path` est `active (waiting)`, `enabled`,
`Triggers: beacon-stop.service`, quatre-vingts secondes après le démarrage de la
machine.

**La restauration sur disque vierge ne laisse rien en root.**
`ls -ld /opt/beacon/data{,/server,/server/savegame}` rend `4711:4711` sur les
trois : l'image amont reprend la propriété récursivement au démarrage. La sonde
n'avait mesuré qu'une restauration dans un arbre **déjà installé** ; dans cet
ordre-là, personne ne savait.

**Le refus, provoqué en vrai.** Dossier de sauvegarde vidé à la main sur la
machine, puis attente d'une poussée :

```
beacon: not pushing 97 bytes: it is under the floor of a save
22:48:50Z  AgentReportedFailure | not pushing 97 bytes: it is under the floor of a save
```

Rien déposé sous `auto/` pour cette session. **Deux corrections de revue se
prouvent dans cette seule ligne de journal.** Le rapport best-effort sur le
chemin du refus — sans lui, le refus n'aurait été connu que d'une console, sur
une machine détruite trois minutes plus tard. Et la garde d'état sur le journal
— sans elle, cette ligne dirait `ProvisioningFailed` à propos d'une session qui
tournait parfaitement.

**La clé neuve tient, et le sabotage le démontre.** Après les deux soirées, le
seau porte quatre sauvegardes rangées par origine, session et instant, et la
`pre-shutdown` de la session 1 — 72 767 octets — est intacte. Rien de ce qu'on a
fait ne pouvait l'écraser : il n'y avait pas de clé à réécrire.

**Inventaire après chaque arrêt : zéro serveur, zéro IP, zéro volume.**
`server/current` revient à `IDLE` avec tous ses champs réservés vidés. Ni
`ProvisioningFailed` ni `AgentContradicted` sur les deux soirées.

## Ce que les soirées ont contredit

**Le plancher était bon pour une raison qu'on ne pouvait pas connaître.** La
première poussée automatique fait **4 307 octets** — un monde de trois minutes.
Le plancher est à 1 024 octets, donc elle passe, de peu. Calibré près des
31 374 octets que la tranche 0 donnait comme « plus petit monde réel », il
**aurait refusé une sauvegarde parfaitement légitime**, et le §8 aurait produit
exactement la panne qu'il existe pour empêcher. Rien dans la sonde ne disait
qu'un monde jeune pèse un septième d'un monde joué.

**Et le plancher ne protège pas de ce qu'on croirait.** La `pre-shutdown` de la
session 2 fait 36 860 octets contre 72 767 pour la précédente, environ la moitié
— le jeu n'a réécrit que ce qu'il avait en mémoire après qu'on a vidé son
dossier. Elle passe le plancher et rien ne sait dire si c'est un monde entier.
**Le plancher protège contre « vide », pas contre « incomplet »** : 97 octets
sont refusés, 36 Ko passent. C'est une limite à écrire, pas un défaut à corriger
— mesurer la complétude d'un monde demanderait de le comprendre, ce que le §4
refuse explicitement au système.

**Enshrouded écrit son monde sur disque en s'arrêtant.** C'était une question
ouverte, et le sabotage de l'étape 6 y répond par accident : le dossier vidé à
la main s'est repeuplé au `docker stop`, et la poussée finale est passée.
L'arrêt propre tient même quand on a retiré le sol sous ses pieds.

**Le filet des dix minutes n'existait pas de toute la soirée, et personne ne
l'avait remarqué.** Le job Scheduler de production était en pause — c'est le
protocole, il ne doit pas réclamer une machine qu'il ne connaît pas. Mais
l'émulateur **écarte aussi le watchdog**, faute d'émulateur Pub/Sub :
`function ignored because the pubsub emulator does not exist or is not running`.
Les deux moitiés étaient donc absentes en même temps. Ça n'a rien coûté parce
que le chemin normal a marché, mais si l'agent s'était tu, **rien** n'aurait
détruit la machine. À retenir plutôt que la chance : une session réelle contre
l'émulateur n'éprouve pas le watchdog, et le budget n'y est protégé que par la
vigilance humaine.

**SSH rejette la connexion à chaque session, et c'est le §3 qui fonctionne.**
L'instance étant détruite et non éteinte, et l'IP réattribuée, la machine
présente une clé d'hôte neuve sous la même adresse. Ce n'est pas une anomalie,
c'est ce que la destruction garantit — mais ça ressemble à une attaque et ça
surprendra quiconque se connecte. Voir plus bas ce qui a été tranché.

**L'egress objet intra-région n'est toujours pas mesuré.** La restauration
d'Enshrouded fait 72 Ko et passe en une fraction de seconde ; ce que le §12
attend depuis la tranche 0 est la mesure des 2,3 Go de fichiers de jeu, et elle
arrive avec la tranche 3 bis.

## Ce qui a failli coûter la soirée

Deux défauts trouvés en montant les sessions, corrigés avant le clic, et
qu'aucun test ne pouvait voir.

1. **`tools/dev-secrets.mjs` ignorait `S3_SECRET_KEY`.** Cet outil recopie vers
   l'émulateur la liste des secrets des Functions ; le secret du stockage y a été
   déclaré en `defineSecret`, mis dans les `secrets:` du déclencheur et dans
   `.env.example`, sans que personne touche à cet outil. L'émulateur serait donc
   allé le chercher dans Secret Manager et aurait échoué à s'authentifier — en
   pleine session, sur la première poussée. **Aucune revue ne pouvait l'attraper**
   : ce fichier n'est dans la liste de fichiers d'aucune tâche, et il a été écrit
   à la tranche 2. C'est la limite d'une revue guidée par un brief, et elle vaut
   d'être notée telle quelle : *ce qui n'est listé nulle part n'est relu par
   personne.*
2. **Le `cloud-init` acceptait d'écrire un endpoint en clair.** Le jeton d'agent
   voyage dans les en-têtes des appels que la machine fait au plan de contrôle ;
   rien n'obligeait l'URL du tunnel à être en `https://`. La garde est posée dans
   `renderCloudInit`, le seul point où cette valeur entre dans le système — une
   première tentative dans la lecture de configuration du compagnon cassait le
   harnais de fumée, qui parle légitimement à `http://host.docker.internal`.

Un troisième piège, d'exploitation : lancer `pnpm install` dans ce dépôt produit
un `pnpm-lock.yaml`, un `pnpm-workspace.yaml` et un `node_modules` hybride que
`npm ci` doit ensuite réparer. Le dépôt est en npm, et rien ne le dit à un
gestionnaire de paquets qui passe par là.

## Les deux décisions que ces soirées ont laissées

**La clé d'hôte SSH ne sera pas stabilisée.** Poser une clé d'hôte fixe dans le
`cloud-init` reviendrait à écrire une clé privée de longue durée dans un
artefact rendu à chaque provisionnement et lisible par qui lit les métadonnées
de l'instance — le §7 dit qu'aucun identifiant durable ne réside sur la VM de
jeu, et une clé d'hôte partagée par toutes les machines en est un. Le churn
reste, et c'est de la documentation d'exploitation : se connecter à une machine
Beacon demande de retirer l'ancienne entrée (`ssh-keygen -R <ip>`), ou de ne pas
en tenir. L'empreinte attendue se lit dans la sortie console de l'instance pour
qui veut la vérifier.

**Les fichiers de politique Scaleway entrent dans le dépôt**, sous
`deploy/scaleway/`. Ils vivaient dans un répertoire temporaire de session, donc
ils étaient perdus à la fin — alors qu'ils *sont* l'énoncé de la frontière du §7
et la seule règle du système qui supprime quelque chose. Ce ne sont ni des
secrets ni de l'infrastructure exécutée : ce sont deux documents qui se relisent
et se rejouent au lieu de se redécouvrir. Le lotissement note depuis longtemps
que ces ressources devront un jour se décrire en code, et il désignait « une
règle de cycle de vie sur les sauvegardes » comme le candidat le plus probable
au geste fait de travers. Il avait raison à une tranche près.

## Le gate

Le lotissement pose que **aucun monde auquel on tient ne migre avant que cette
tranche soit finie et ses tests verts**, et qu'il se lève jeu par jeu.

**Il est levé pour Enshrouded.** Ce qu'il gardait — qu'un monde déposé par une
session revienne dans la suivante — est prouvé deux fois : par la clé, par la
taille au bit près, et par le contenu d'un coffre. Formellement il se lève à la
fusion, la production étant `main`. Il reste fermé pour Sunkenland, dont le monde
attend dans son seau jusqu'à la tranche 3 bis.

## Ce qui reste à relever

- **Le coût réel des deux sessions**, sur la facture, deux jours plus tard. Le
  domaine a annoncé 0,05 € pour la première ; la seconde n'a pas été relevée,
  mais elle doit la même heure entamée sur les trois ressources. Deux sessions à
  ce prix tiennent dans le tiers du budget de 0,30 € que la tâche 13 s'était
  donné — c'est la facture qui le dira, pas cette estimation.
- **`beacon-stop.path` après avoir tiré.** On voulait voir si l'unité finit
  `failed`, pour confirmer en vrai une correction de revue ; la machine a été
  détruite avant qu'on regarde. Faible enjeu — une unité qui casse sur une
  machine qui disparaît dans la seconde ne coûte rien — mais à refaire, et la
  fenêtre est de quelques dizaines de secondes **entre** l'arrêt du jeu et la
  destruction.
