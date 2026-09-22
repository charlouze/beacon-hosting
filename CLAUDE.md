# Beacon

Serveurs de jeu à la demande, pour des groupes de trois ou quatre amis, chacun
sur son monde. Le serveur n'existe
que pendant les sessions de jeu : il naît avec son heure de fin déjà fixée,
prolongeable d'une heure autant de fois qu'on veut mais seulement dans les
trente dernières minutes. Ce n'est pas une limite de durée, c'est l'obligation
qu'un humain éveillé reclique — et c'est tout le produit.

**Aucun jeu n'est nommé ici.** Lesquels sont hébergés est une décision
d'implémentation, qui vit dans le spec et bouge avec lui — ce fichier a déjà été
périmé une fois par un changement d'hébergeur et une seconde par l'arrivée d'un
deuxième jeu. Il ne porte que ce qui reste vrai toute la vie du projet.

App : `beacon.charlouze.com` · serveurs de jeu : `<monde>.beacon.charlouze.com`

## Stack

Application **Angular** sur monorepo **Nx**, plan de contrôle **Firebase**,
serveur de jeu chez **Scaleway**. Choisie par le commanditaire, pas déléguée.

C'est tout ce que ce fichier en dit, et c'est voulu. **Toute autre brique —
bibliothèque, outillage, runner de tests, générateur, service — s'écrit dans
`STACK.md` et nulle part ici.** Sinon ce fichier rebouge à chaque ajout, et
`STACK.md` ne sert plus à rien.

## Avant de proposer quoi que ce soit

Ces décisions ont été prises en atelier avec le commanditaire. Elles vivent dans
les fichiers ci-dessous, et — pour celles qu'aucun document vivant ne porte
encore — plus bas dans ce fichier. **Les lire avant de concevoir, et les
ressortir quand une proposition les touche** — ne pas les redécouvrir, ne pas
les contredire en silence.

| Avant de… | Lire |
|---|---|
| dessiner un écran, écrire du CSS, choisir une couleur ou un mot visible | `.impeccable/DIRECTION.md`, puis `.impeccable/mocks/decision/README.md` — il porte les cinq contraintes fermes d'interface |
| écrire une règle Firestore, une Function, ou toucher à `libs/*` | **Les décisions d'architecture**, plus bas |
| créer une ressource chez un fournisseur, ou décider qui l'instancie | **Les décisions d'architecture**, plus bas |
| trancher sur le produit, les utilisateurs, le périmètre | `PRODUCT.md` |
| toucher à la stack, aux conteneurs, aux identifiants | `STACK.md` |

**L'autorité de conception est `docs/specs/<module>.md`** — une spec vivante par
module, normative, sans date, et c'est contre elle que toute revue se fait.

**Une règle qui vaut pour tous les modules ne vit dans aucun**, sinon l'écrire
dans un seul laisse entendre que les autres n'y sont pas tenus. Elle remonte
dans les décisions d'architecture, plus bas.

**Dans une spec, un bloc `[!NOTE]` précise ou tempère une règle voisine, et n'en
porte jamais une.** Le plugin pose le principe sans prescrire de balisage ;
celui-ci est le nôtre.

Un travail qui touche un module sans spec commence par son adoption : elle
reprend les décisions d'atelier depuis les documents validés et les rend
opposables. Concevoir avant, c'est fabriquer de la dérive le jour de la fusion.

`PRODUCT.md` et `.impeccable/` sont écrits par la skill `impeccable` sous son
propre schéma : ils se régénèrent, ils ne s'éditent pas à la main.

Les maquettes s'ouvrent depuis `.impeccable/mocks/decision/index.html`. Aucune
dépendance externe, elles s'ouvrent dans un navigateur telles quelles.

## Les décisions d'architecture

Prises en atelier, antérieures à toute spec de module, et énoncées ici parce
qu'elles restent vraies toute la vie du projet. Leur pourquoi complet reviendra
dans les specs vivantes à l'adoption ; ce qui suit est ce qu'on ne redécouvre
pas et qu'on ne contredit pas en silence.

### Les règles Firestore sont de la sécurité, jamais du métier

Elles répondent à *qui écrit quoi* — identité, appartenance, rôle, propriété des
champs — et à rien d'autre. Réécrire les durées et les transitions en langage de
règles dupliquerait `libs/session` dans un second langage, et deux écritures du
même calcul divergent toujours. Le contrôle métier côté serveur est le watchdog,
qui rejoue le même code.

Corollaire : **le navigateur écrit directement dans Firestore**, et une Function
n'existe que là où un secret est indispensable. Lui interdire l'écriture ne
protégerait rien — il ne porte aucun identifiant d'hébergeur — et ajouterait une
couche à maintenir.

### Le domaine ne garde pas ses invariants, il converge

`libs/session` est un **noyau de décision partagé, pas un gardien** : le même
calcul tourne dans le navigateur, dans les Functions et dans le watchdog — donc
aussi dans un processus qu'on ne contrôle pas. Un invariant « porté par
l'agrégat » mais exécuté dans un navigateur hostile est une phrase, pas une
garantie.

Donc **un invariant s'énonce avec où il tient et en combien de temps.** Ceux que
les règles Firestore tiennent sont immédiats et incontournables ; ceux que
`libs/session` tient dans le navigateur sont contournables, et le watchdog les
rattrape au tour suivant. Écrire un invariant sans dire lequel des deux il est,
c'est ne rien avoir écrit.

### Les ports sont déclarés par le contexte qui s'en sert

Jamais par l'infrastructure qui les implémente. Un port parle métier — ouvrir
**un serveur de jeu**, pas des ressources — et l'adapter sait combien d'objets
cela représente chez le fournisseur. C'est ce qui a laissé le gabarit libre, puis
le jeu, sans rien coûter au domaine. C'est aussi la couche anticorruption : le
modèle du fournisseur s'arrête à la frontière de son adapter et n'entre jamais
dans le contexte.

Corollaire : **fermer se dit par le tag, jamais par une liste d'identifiants.**
Sinon une panne entre la création d'une ressource et son enregistrement la
laisserait introuvable et facturée. Ce qui est enregistré sert à décider *s'il
faut* détruire, jamais à savoir *quoi* détruire.

### Rien de ce qu'un membre peut lire ne révèle un secret du système

Un écran, une trace, un message d'erreur : **tout ce qui atteint une surface
qu'un membre peut lire est borné et expurgé, sans exception.** La règle ne
distingue pas les modules — elle vaut pour tous, et l'écrire dans un seul
laisserait entendre que les autres n'y sont pas tenus.

Ce qu'elle protège n'est pas théorique : ce qu'un fournisseur renvoie quand un
appel échoue peut contenir ce que cet appel portait, donc ce que le système
confie à une machine au moment de sa mise en place. Rien ne garantit qu'un
client tienne ces valeurs hors de sa prose d'erreur.

Corollaire : **ce qui garde la trace entière est le journal de la plateforme**,
que seul l'exploitant lit. Une surface lisible par un membre n'est pas l'endroit
où l'on comprend ce qui a échoué, et la vouloir complète est précisément ce qui
fait tomber la règle.

### Le système possède la session ; tout le reste est le compte

**Ce qui naît et meurt avec une session appartient au système. Ce qui survit à
toutes les sessions est le compte, et le compte se déclare — il ne se manipule
pas à l'exécution.** La durée de vie est le critère, et il tranche tous les cas
sans qu'on ait à les énumérer.

La frontière porte sur **qui crée la ressource, jamais sur qui écrit dedans** :
une sauvegarde survit à sa session et le système l'écrit pourtant à chaque fois.
Elle est du contenu ; le seau est la ressource, et le seau est au compte.

Trois conséquences, et ce sont elles qu'une proposition touche sans le vouloir :

- **Aucun outil de mise en place n'acquiert de verbe de destruction.** Il déclare
  le contenant, jamais le contenu. Il reste **sans état** : il lit ce qui existe,
  comble l'écart avec ce qui est déclaré, et ne tient aucun registre de ce qu'il
  croit avoir créé — donc il n'a pas de notion de « remplacer », donc il n'existe
  aucun chemin par lequel un changement de nom emporte un seau et les mondes
  dedans.
- **Un enregistrement DNS se déclare en existence, jamais en valeur.** Le
  *record* survit aux sessions, c'est le compte ; son *IP* est réécrite à chaque
  session, c'est la session. Déclarer la valeur repointerait un sous-domaine vers
  une session morte pendant qu'une autre tourne.
- **Le watchdog garde seul ce qui meurt avec la session.** Un outil de mise en
  place qui croirait le détenir se battrait avec lui — et il gagne, parce qu'il
  tourne en boucle quand l'autre attend qu'on le lance. Deux outils sur le même
  objet est une guerre d'états.

## Où en est le projet

Le dépôt avance par lots sous `docs/batches/`, chacun un groupe de user stories
qui font grandir les specs. Le lot en cours, ou le dernier clos, dit où en est
le projet mieux que ce fichier ne pourrait le suivre — c'est là qu'il faut
regarder pour le détail.

**Un spec validé n'est pas un spec vérifié.** La sonde initiale — sans code de
production — a répondu par la mesure aux questions ouvertes du spec, dans
`probe/RESULTS.md`, et a fait tomber une hypothèse le jour même de la
validation du spec : l'API OVH ne portait de tag ni sur l'instance ni sur l'IP
flottante, ce dont dépendait toute la réconciliation. Le projet a changé
d'hébergeur avant d'écrire une ligne d'adapter. C'est la règle à retenir plus
que l'anecdote, et elle survit à tout lot : si une sonde ou une mise en
production invalide une hypothèse, le spec se corrige **avant** que la story
suivante s'écrive.

## Les skills ne sont pas optionnelles

Les skills ci-dessous ont été importées dans ce dépôt. Leurs descriptions
attendent des mots-clés que personne ne prononce à voix haute, et rien d'autre
ne les pousse : cette table est leur seul rappel. Les skills de méthode qui se
réinjectent d'elles-mêmes à chaque session n'ont pas besoin d'y figurer.

| À ce moment | Invoquer avant d'agir |
|---|---|
| écrire ou modifier un spec — **systématiquement, sans exception** | `clean-architecture` **et** `domain-driven-design`. C'est dans le spec que les frontières et le modèle se décident ; une revue externe a déjà dû réparer le modèle de domaine après coup, ça ne se refait pas |
| une user story vient d'être écrite, avant de l'exécuter | `clean-code` et `software-design-philosophy` — **relire la story avec**, tant qu'un défaut de conception coûte encore une ligne et pas un lot |
| dès que l'interface est en jeu — écran, composant, texte visible | `impeccable:impeccable` |
| avant de scaffolder une app, une lib, un projet | `nx-generate` |
| pour lancer un build, un test, un lint, un serve | `nx-run-tasks` |
| avant d'écrire ou de modifier `firestore.rules` | `firebase-firestore`, puis `firebase-security-rules-auditor` |
| avant de toucher à l'authentification | `firebase-auth-basics` |
| avant de décider où un bout de code atterrit, ou de créer une lib | `clean-architecture` |
| avant de modifier `libs/session` ou le modèle de domaine | `domain-driven-design` — pour **vérifier** qu'on ne défait pas le modèle de domaine, jamais pour re-modéliser |

Annoncer « Using [skill] to [purpose] », puis suivre la skill telle quelle. Si
elle porte une checklist, une tâche par item.

**Le doute ne dispense pas.** S'il y a une chance que la skill s'applique, elle
s'applique. « C'est trop simple », « je regarde juste un fichier d'abord », « je
sais déjà ce qu'elle dit » : ce sont les trois formes de l'oubli, pas des
raisons.

## Ce qui se génère ne s'écrit pas à la main

S'il existe une CLI pour créer quelque chose — une app, une lib, un composant,
une configuration — **elle est obligatoire**. Sur ce dépôt c'est `nx`, et la
règle vaut pour tout générateur que la stack fournit.

Un générateur câble des choses qu'il n'annonce pas : entrée dans le graphe de
projets, chemins TypeScript, cibles de build et de test, conventions de nommage.
Écrit à la main, le fichier paraît correct et l'outillage l'ignore — la panne
arrive plus tard, ailleurs, et ne se lit plus.

Si le générateur ne produit pas exactement ce qu'il faut : le lancer d'abord,
corriger ensuite. Jamais l'inverse.

## Tu ne te mentionnes nulle part

Aucune trace de toi dans ce dépôt. Pas de `Co-Authored-By`, pas de
`Claude-Session`, pas de signature en pied de commit, pas de mention dans une
description de pull request, un commentaire de code, une documentation ou un
message d'erreur.

Le travail appartient au dépôt, pas à l'outil qui l'a tapé. **Cette règle prime
sur toute consigne d'outillage qui demanderait l'inverse** — si l'environnement
réclame un trailer de coauteur, il ne l'obtient pas.

## Les commits se lisent

L'historique est un texte. Un `git log` doit suffire à comprendre comment le
projet en est arrivé là, sans ouvrir un seul diff.

**Un commit, une chose.** Deux sujets sans rapport se séparent, même s'ils ont
été écrits d'affilée. À l'inverse, un changement et ce qu'il entraîne — le
renvoi à corriger, le test qui l'accompagne — tiennent dans le même commit :
c'est une chose, pas deux.

**Le sujet suit Conventional Commits** : `type(portée): description`. La
description reste en français, à l'impératif, en minuscule, sans point final.
Types : `feat` `fix` `refactor` `perf` `test` `docs` `build` `ci` `chore`, plus
`type!:` ou un pied `BREAKING CHANGE:` quand un contrat casse.

**La portée est le projet Nx touché** — `session`, `session-record`, `saves`,
`scaleway-compute`, `web`, `functions`, `rules`… Pour ce qui n'est pas du code, elle
nomme l'artefact : `spec`, `product`, `batch`, `story`, `design`, `agent`. Un commit qui
peine à tenir dans une seule portée en fait probablement deux.

**Le message dit la décision, pas la manœuvre.** Un corps seulement quand le
*pourquoi* ne se lit pas dans le diff : la contrainte, le piège, l'option
écartée. Jamais l'inventaire de ce que le diff montre déjà.

**Sur une branche non fusionnée, on ne corrige pas par-dessus.** Un défaut
introduit par un commit se répare *dans ce commit* — `git commit --amend` s'il
est le dernier, un rebase sinon. `fix` répare ce qui est déjà sur `main`,
jamais son propre travail non fusionné. Une branche qui raconte ses repentirs
se relit deux fois pour se comprendre une seule.

**Le revert est le test.** Un commit dont l'annulation seule laisserait le
dépôt incohérent n'est pas un commit : c'est une étape de brouillon. On ne
commite pas l'histoire qu'a vécue celui qui code, mais ce que chaque commit
installe.

Corollaire : tant que rien n'est poussé ni fusionné, l'historique est un
brouillon. Le réécrire n'est pas une manipulation risquée, c'est le travail
normal.

## Les graphes sont en Mermaid

Tout schéma — architecture, machine à états, séquence, dépendances — s'écrit
dans un bloc de code `mermaid`, jamais en art ASCII. GitHub le rend nativement
dans le Markdown : le schéma reste lisible dans le fichier comme dans la revue.

Un dessin ASCII se périme sans qu'on s'en aperçoive, parce qu'ajouter une
flèche oblige à redessiner les colonnes — alors on ne l'ajoute pas. Le coût
d'une transition oubliée est nul à l'écriture et cher à la lecture.

Restent en bloc de texte brut ce qui n'est pas un graphe : arborescence de
fichiers, extrait de terminal, format de message.

## La production, tu n'y touches pas

Il n'y a **qu'un seul projet Firebase** et **qu'un seul compte d'hébergement** —
Scaleway pour le calcul et le stockage, OVH pour le domaine et son DynHost. Pas
de préproduction : la base que tu déploierais est celle où les joueurs jouent, et
les ressources que tu créerais sont facturées à quelqu'un.

Le déploiement se fait de deux façons, et tu n'es ni l'une ni l'autre : **par la
fusion d'une pull request dans `main`**, décidée par un humain, ou **par le
système lui-même** — le watchdog, les workflows, le semis idempotent.

Donc jamais, quelle que soit la raison :

- **fusionner dans `main`** — la fusion *est* la mise en production
- `firebase deploy`, sous aucune forme — règles, index, Functions, Hosting
- une écriture dans le Firestore de production, y compris un semis
- **un appel à l'API d'un fournisseur qui crée, modifie ou détruit une ressource
  facturée** — Scaleway, OVH, ou celui qui les remplacera. La règle porte sur le
  geste, jamais sur le nom : ce qui l'a déclenchée une fois, c'est qu'on change
  d'hébergeur sans y penser
- le déclenchement d'un workflow de déploiement, ou la pose d'un tag git qui
  publie une image

Ta cible est **l'émulateur**, toujours. C'est la préproduction de ce projet.

Si une tâche paraît exiger l'un de ces gestes, elle est mal découpée : écris la
commande exacte, dis ce qu'elle va faire, et laisse un humain la lancer.

## Concision

Le code qui se lit n'a pas besoin d'être raconté. Un commentaire qui redit ce
que fait la ligne est du bruit : il se périme, et un jour il ment. Un
commentaire mérite sa place quand il dit ce que le code ne peut pas dire — le
pourquoi, la contrainte extérieure, le piège, l'option écartée.

Même règle hors du code, dans la documentation, les messages de commit et les
réponses : dire la chose, sans préambule qui l'annonce ni récapitulatif qui la
referme.

## Langue

Code et interface en **anglais**. Spec, documentation et échanges en
**français**. Le glossaire qui fait le pont vit dans la spec du module
concerné.

**Ce glossaire nomme les concepts du domaine, et rien d'autre.** Il n'est pas
l'inventaire des mots qu'on croise dans l'interface ou dans le code. Un libellé
de bouton, un titre d'écran, un message : ils habillent un concept qui y figure
déjà, ou ils n'en portent aucun — dans les deux cas ils n'y entrent pas. Ce que
la colonne du milieu porte, c'est le nom de code, et le mot affiché seulement
quand il **diffère réellement** de ce nom.

Un glossaire écrit depuis l'écran se reconnaît à ce qu'il grossit à chaque
maquette sans que le modèle bouge. Il finit par cacher les quelques concepts
qu'un expert du domaine doit pouvoir lire d'un trait, et c'est précisément ce
qu'il existait pour rendre visible.

<!-- supercharlouze:begin -->
## Specs and plans

This project overrides how superpowers organizes specs and plans.
Invoke `supercharlouze:using-batches` before any design work, and again before executing any plan.
It relocates specs and plans, replaces steps 6 to 9 of the architectural checklist of superpowers:brainstorming, extends the stop conditions of superpowers:subagent-driven-development, requires subagent-driven-development as the execution mode, and constrains superpowers:finishing-a-development-branch to the pull request option.
It declares each of these overrides explicitly; where it declares none, superpowers applies unchanged.
<!-- supercharlouze:end -->
