# Tranche 4 — la première mise en production

Relevé de la tâche 13, conduite les 2026-09-10 et 2026-09-11. **Le système est
exposé** : `beacon.charlouze.com` sert l'application, un membre s'y connecte,
et ce que les règles refusent a été mesuré plutôt que supposé.

**Coût de calcul : zéro.** Aucune session n'a été ouverte — cette tâche prouve
l'authentification, les règles et la chaîne de livraison, pas le cycle, éprouvé
depuis la tranche 3.

## Ce que la tâche voulait prouver, et qui l'est

| | |
|---|---|
| La fusion déploie | ✅ cinq fusions, la cinquième verte de bout en bout |
| Les règles déployées sont celles du dépôt | ✅ **identiques au caractère près** à `origin/main:firestore.rules`, 294 lignes, vérifié en relisant le ruleset publié |
| Le semis pose ce qu'aucun client ne peut créer | ✅ `server/current` en `IDLE`, `config/settings` avec ses durées, `members` **vide** |
| Le tampon écrit les deux champs réservés | ✅ `rulesVersion` = `9134fce…`, le commit fusionné |
| Le déploiement lit sa propre adresse | ✅ `agentEndpoint` = `https://agentreport-mykl2oqx2a-ew.a.run.app`, **en une seule fusion** |
| Le premier admin entre par la console | ✅ `{ role: 'admin', email: null, steamId: null }`, la forme que `libs/rules` épingle |
| Le sujet déclare son propre `steamId` | ✅ l'écriture est passée depuis le pilote, ce qui valide toute la chaîne |
| Un membre ajouté devient membre **sans se reconnecter** | ✅ constaté dans l'onglet déjà ouvert |
| Un membre dont le document est supprimé **cesse d'avoir des droits, en direct** | ✅ constaté dans le même onglet, sans reconnexion — c'est l'autre moitié de ce que le §5 achète en gardant le rôle en base plutôt qu'en *custom claim*, qui aurait vécu jusqu'à l'expiration du jeton |
| Le refus est la mesure | ✅ une écriture de `{ steamId, role }` sur son propre document est refusée ; la même sans `role` passe |

## Les durées

Le déploiement vert, fusion #23 :

| Étape | Durée |
|---|---|
| **Attente d'un exécuteur GitHub** | **17 min 41 s** |
| `npm ci` | 51 s |
| `lint test build typecheck --all` — la barrière | 1 min 47 s |
| `web:build` | 8 s |
| `firebase deploy` | **1 min 46 s** |
| Semis | 4 s |
| Lecture de l'url d'`agentReport` | 8 s |
| Tampon des deux champs | 4 s |
| **Le job** | **4 min 58 s** |
| **De la fusion à la production** | **22 min 39 s** |

Deux choses que ces chiffres disent et qu'on n'attendait pas.

**L'attente d'un exécuteur est la plus longue étape du déploiement**, et de
loin : dix-sept minutes pour cinq minutes de travail. Elle ne dépend de rien
qu'on écrive ici. C'est le vrai délai entre la décision de fusionner et le
système à jour, et c'est lui qu'il faut annoncer, pas les cinq minutes.

**La barrière ne coûte presque rien** — 1 min 47 s pour lint, tests, build et
typecheck de seize projets. L'argument « les tests ralentissent le déploiement »
n'a pas de prise ici : ils pèsent un dixième de l'attente.

Les quatre étapes du §10 qui suivent `firebase deploy` tiennent en **16
secondes**.

## Les quatre refus, et ce que chacun a appris

| Fusion | Ce qui a arrêté le déploiement | Durée avant l'arrêt |
|---|---|---|
| #19 | 403 sur `firebaseextensions.googleapis.com` | 2 min |
| #20 | le **même** 403, malgré `roles/firebase.developViewer` accordé | 19 min |
| #21 | `We failed to modify the IAM policy for the project` | 3 min |
| #22 | `cloudbilling.googleapis.com` non activée | 3 min |
| #23 | — | **succès** |

**La liste des droits était fausse quatre fois, et aucun test ne pouvait le
dire.** Ce qu'un déploiement réel exige ne se lit nulle part dans le dépôt : ni
dans le code, ni dans la documentation de Firebase, ni — c'est la découverte de
la fusion #20 — dans les métadonnées des rôles IAM. L'API des extensions vérifie
`firebaseextensions.instances.list`, une permission absente des permissions
octroyables, des métadonnées des rôles, et du Policy Troubleshooter. Elle n'a
été trouvée qu'en appelant l'API en usurpant le compte de déploiement.

Chaque échec a coûté un aller-retour complet : corriger, ouvrir une pull
request, la fusionner, attendre le workflow. C'est le prix d'une barrière qui
n'a qu'une seule porte, et il est assumé — mais il n'était pas budgété.

**Le meilleur moment pour échouer.** Les quatre refus sont tombés pendant la
préparation de `firebase deploy`, avant toute publication : Hosting est resté en
404, aucune Function n'est partie, `config/settings` n'a jamais été tamponné à
moitié. L'avertissement que le workflow imprime dans ce cas — « ce qui est servi
est inconnu, ne tamponnez rien avant d'avoir lu » — s'est déclenché quatre fois
et a désigné le cas 2a à chaque fois, correctement.

## Ce qui a surpris

**Un `resourcemanager.projects.setIamPolicy` refusé est une bonne nouvelle.** Au
premier déploiement d'une Function à déclencheur, `firebase deploy` accorde
lui-même des liaisons aux agents de service de Google, en réécrivant la
politique IAM du projet. Lui donner ce droit, c'est donner à un compte de
déploiement le pouvoir de tout s'accorder. La fusion #22 a posé ces liaisons
d'avance, à la main, et l'outil les vérifie désormais comme il vérifie les
rôles. Le déploiement n'a plus rien à réécrire.

**Un « tout vert » peut venir d'un cache.** Une vérification locale complète est
passée au vert alors qu'un projet était cassé : Nx avait resservi un résultat
mis en cache. Depuis, toute vérification qui précède une fusion se fait en
`--skip-nx-cache`.

**GitHub a deux mécanismes de protection de branche, et l'API historique ment
sur le second.** Une branche protégée par un ruleset répond 404 sur
`branches/main/protection`. L'outil a donc annoncé `main` grand ouverte alors
qu'elle était correctement protégée — et le geste qu'il proposait pour la fermer
aurait posé un second mécanisme par-dessus le premier.

**Un test peut verrouiller un défaut au lieu de l'attraper.** Le `principalSet`
de la fédération portait `attributes.repository` au lieu de `attribute.repository`.
Le test affirmait la même chaîne fausse, écrit depuis la même croyance que le
code : il ne prouvait que leur accord. Seul l'appel réel à `gcloud` a pu dire
non — au dixième geste sur dix, trois minutes après le début.

## Ce que la tâche a produit en plus du déploiement

`tools/deploy-setup`, qui n'était pas au plan. La tâche 12 décrivait sept gestes
de console en prose ; elle tient maintenant en trois commandes qui lisent l'état
réel, impriment l'écart, et demandent commande par commande. Elle répond surtout
à une autre question que « comment installer », qui n'arrive qu'une fois : « est-ce
que c'est toujours bien posé », qui se repose.

Et une correction du spec : `agentEndpoint` a quitté les variables de dépôt pour
`config/settings`, écrit par le déploiement qui crée la Function (§4, §10
étape 5). La chaîne se mordait la queue — l'url n'existe qu'après le déploiement
qui la crée — et le plan prévoyait deux fusions dont une avec un relevé à la
main. Il en faut une.

## Ce qui reste ouvert

**Le dépôt est public, et les tests portent un identifiant Steam réel.** Le
fixture de `libs/rules/src/lib/members.spec.ts` est celui du commanditaire,
repris tel quel en écrivant les tests de la tranche. Ce n'est pas un secret —
un SteamID64 se lit sur une URL de profil — mais c'est l'identifiant d'une
personne réelle dans un dépôt ouvert, et rien ne l'exigeait : un test qui
vérifie qu'une chaîne de dix-sept chiffres est acceptée n'a pas besoin de celle
de quelqu'un.

**Les agents de service sont posés pour les déclencheurs d'aujourd'hui.** Une
Function d'une forme nouvelle en demanderait un de plus, et `firebase deploy`
échouerait de nouveau sur la politique IAM. C'est le prix assumé du refus
ci-dessus ; il est écrit ici pour ne pas être redécouvert.

**Les actions du workflow visent Node 20**, que GitHub force déjà sur Node 24, et
`setup-java@v4` est déprécié. Rien ne casse ; les épingles se montent quand on
voudra.
