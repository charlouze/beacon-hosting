# La première vraie session — 2026-09-06

Ce que la tranche 2 a éprouvé une fois, à la main, et qu'aucun double en
mémoire ne pouvait prouver. Session `b19af9ed-c4de-49d0-bd7c-1eacd1624c55`,
instance `beacon-b19af9ed…` en `DEV1-L`, IP `51.15.139.149`, zone `fr-par-1`.

- Watchdog de production : en pause **avant 14:04**, relancé et vérifié
  `ENABLED` **vers 14:47**. Durée exacte non relevée — ce qui compte est qu'il
  soit resté en pause toute la session et qu'il soit revenu
- Du clic à `RUNNING` : **moins de 26 s** — clic et `SessionStarted` à 14:04:26,
  `RUNNING` déjà publié au relevé de 14:04:52
- De `RUNNING` au serveur réellement joignable : **au plus 11 min 48**, à
  affiner ← ce que la tranche 3 supprime. Le spec annonçait 5 à 8 min
- `enshrouded.beacon.charlouze.com` résout vers : **51.15.139.149**, une fois
  l'enregistrement créé à la main pendant la soirée. Connexion réussie **par le
  nom**, après une première connexion par l'IP brute
- Droits de rôle : construire **oui** — `CAN_EDIT_BASE` et `CAN_EXTEND_BASE`
  honorés par le jeu. Ouvrir un coffre : **non testé**, oublié pendant la
  partie, donc `CAN_ACCESS_INVENTORIES` reste non vérifié. Nos tests prouvent
  qu'on *pose* les trois droits ; la soirée devait prouver que le jeu les
  *honore*, et elle en a prouvé deux sur trois. À faire à la session suivante :
  le symptôme serait net — construire mais ne pas pouvoir ouvrir un coffre
- Prolongation refusée hors fenêtre, sans entrée d'audit : **oui**. Bouton
  correctement grisé à 213 min de l'échéance ; forcé depuis la console, le
  domaine a refusé et le journal est resté inchangé — aucune trace d'un geste
  qui n'a pas eu lieu
- Prolongation acceptée dans la fenêtre : **oui**. Échéance 14:58:13 → 15:58:13,
  soit une heure de plus que **l'échéance** et non que l'instant du clic (14:33,
  qui aurait donné 15:33). `SessionExtended` écrit dans la foulée
- Arrêt : **oui**. L'instance était `running`, donc morte par `terminate`, et le
  volume est parti avec elle. C'est la lacune que la tranche 1 nommait
  elle-même la plus grave — `terminate` n'était exercé par rien, le serveur du
  test de contrat ne démarrant jamais
- Ressources survivantes après l'arrêt : **aucune**. Inventaire en lecture
  seule sur le vrai compte : zéro serveur, zéro IP, **zéro volume détaché**
- Durée de la session : 31 min 35 (14:04:26 → 14:36:01), donc **une seule heure
  entamée** sur chacune des trois ressources facturées séparément
- Coût relevé sur la facture, deux jours plus tard :

## Ce que la séquence a confirmé

Relevé dans l'émulateur pendant la soirée, dans cet ordre :

- **La réclamation transactionnelle tient.** `provisionClaimedAt` posé dès le
  passage à `PROVISIONING` : une seconde livraison du trigger n'aurait créé
  aucune machine.
- **L'intention est écrite avant l'appel au fournisseur** (§6 étape 4), et elle
  est restée ouverte toute la session — donc le watchdog ne pouvait pas
  réclamer la machine qu'il venait de protéger.
- **Les deux tags dès la création** (§5), sur l'instance *et* sur l'IP :
  `beacon|session:b19af9ed…`. Vérifié par un inventaire en lecture seule sur le
  vrai compte, pas déduit du code.
- **L'échéance vaut exactement la durée de session** : `startedAt` 14:04:26Z,
  `deadline` 18:04:26Z.

## Ce que la soirée a contredit

**L'enregistrement DynHost n'existait pas, et rien ne disait qu'il fallait le
créer.** La mise à jour a rendu `http 404`, et `nslookup` confirmait
*Non-existent domain* — alors que `beacon.charlouze.com` résout. DynHost ne
crée pas un enregistrement, il en met un à jour : il faut d'abord poser l'A
dans la zone OVH, puis lui attacher un identifiant DynHost. Ni le §4, ni le §6,
ni le §10 ne mentionnent ce prérequis. **À verser au §12.**

Deux choses ont bien marché *à cause* de ça, et méritent d'être dites :

- **Le §8 a fait exactement ce qu'il promet.** La panne DNS n'a pas interrompu
  la session : `announce()` a consigné un `ProvisioningFailed`, `provision()` a
  publié `RUNNING` quand même, et le point de jonction portait l'IP brute.
- **Le recours de `JoinInfo` a servi pour de vrai**, dès la première session.
  Ce n'était pas une lubie du commanditaire : la connexion s'est faite par
  `51.15.139.149:15637`, le moyen principal étant mort.

**Deux défauts que seule une vraie machine pouvait montrer, corrigés le soir
même.**

`costEuros` n'atteignait jamais Firestore. Le domaine le calcule, `tearDown()`
le pose sur l'événement, et `eventDocument()` le laissait tomber : il
énumérait six champs et ce septième n'y était pas. Le §11 fait de
`SessionStopped` le seul événement porteur d'un chiffre et la source du total
du mois — **aucun arrêt n'enregistrait son coût**. Aucun test ne pouvait le
voir : tous affirment sur l'objet du domaine, jamais sur le document écrit. La
frontière étale désormais l'événement, et un test relit le document depuis
l'émulateur avec une valeur non nulle.

Le passage immédiat courait après sa propre destruction. Une seconde après un
arrêt parfaitement réussi, le journal portait un `CleanupFailed` :
`resource_still_in_use, instance should be powered off`. `terminate` est
asynchrone ; le passage déclenché par la Function retombait sur des ressources
encore listées et tentait de les détruire une seconde fois. Rien n'a survécu et
l'état est resté `IDLE`, mais `CleanupFailed` signifie « on n'a pas pu garantir
le nettoyage » et il mentait à **chaque arrêt propre**. La correction n'est pas
d'élargir la garde d'idempotence — `resource_still_in_use` peut aussi dire
qu'une ressource est réellement tenue par autre chose, et faire passer un
fournisseur occupé pour une destruction réussie est le seul mensonge que ce
système ne peut pas se permettre. C'est le plan de la tâche 12 qui avait déjà
la bonne réponse sans le savoir : après un arrêt **réussi** il n'y a rien à
chercher, donc rien à demander. Les chemins d'échec continuent d'en demander un.

Un défaut de journal se confirme au passage, déjà signalé en revue finale :
`announce()` consigne un `ProvisioningFailed` pour une session qui devient
`RUNNING` dans la seconde. Lu dans le journal, ça ressemble à un échec de
provisionnement alors que le provisionnement a réussi.

## Ce qui a failli coûter la soirée

Trois défauts trouvés en montant la soirée, tous corrigés avant le clic, et
qu'aucun test ne pouvait voir :

1. **`firebase.dev.json` ne déclarait aucune Function.** La commande de
   l'étape 4 démarrait Firestore seul : rien n'aurait provisionné.
2. **`defineSecret` ne lit pas `.env`.** L'émulateur interroge Secret Manager
   sauf override dans `.secret.local`, dans le dossier source des Functions —
   que chaque build efface.
3. **`getApps().length === 0` posait la mauvaise question.** Elle demande s'il
   existe *une* application, là où `getFirestore()` réclame la *par défaut* ;
   le runtime de l'émulateur en initialise avant nous, et le déclencheur
   mourait à chaque invocation.
