# Beacon

Serveur Enshrouded à la demande, pour trois ou quatre amis. Le serveur n'existe
que pendant les sessions de jeu : il naît avec son heure de fin déjà fixée,
prolongeable d'une heure autant de fois qu'on veut mais seulement dans les
trente dernières minutes. Ce n'est pas une limite de durée, c'est l'obligation
qu'un humain éveillé reclique — et c'est tout le produit.

App : `beacon.charlouze.com` · serveurs de jeu : `<jeu>.beacon.charlouze.com`

## Stack

Application **Angular** sur monorepo **Nx**, plan de contrôle **Firebase**,
serveur de jeu chez **OVH**. Choisie par le commanditaire, pas déléguée.

C'est tout ce que ce fichier en dit, et c'est voulu. **Toute autre brique —
bibliothèque, outillage, runner de tests, générateur, service — s'écrit dans
`STACK.md` et nulle part ici.** Sinon ce fichier rebouge à chaque ajout, et
`STACK.md` ne sert plus à rien.

## Avant de proposer quoi que ce soit

Ces décisions ont été prises en atelier avec le commanditaire. Elles vivent dans
les fichiers ci-dessous, qui font autorité et en donnent le pourquoi. **Les lire
avant de concevoir, et les ressortir quand une proposition les touche** — ne pas
les redécouvrir, ne pas les contredire en silence.

| Avant de… | Lire |
|---|---|
| dessiner un écran, écrire du CSS, choisir une couleur ou un mot visible | `.impeccable/DIRECTION.md`, puis `.impeccable/mocks/decision/README.md` — il porte les cinq contraintes fermes d'interface |
| écrire une règle Firestore, une Function, ou toucher à `libs/*` | §2 et §4 du spec — décisions actées, modèle de domaine, ports, et où chaque invariant tient réellement |
| écrire le plan d'une tranche, ou en changer l'ordre | `docs/superpowers/plans/` — deux gates fermes y conditionnent l'exposition du système et la migration d'un monde |
| trancher sur le produit, les utilisateurs, le périmètre | `PRODUCT.md` |
| toucher à la stack, aux conteneurs, aux identifiants | `STACK.md` |

Le spec est `docs/superpowers/specs/2026-09-02-game-hosting-design.md`.

`PRODUCT.md` et `.impeccable/` sont écrits par la skill `impeccable` sous son
propre schéma : ils se régénèrent, ils ne s'éditent pas à la main.

Les maquettes s'ouvrent depuis `.impeccable/mocks/decision/index.html`. Aucune
dépendance externe, elles s'ouvrent dans un navigateur telles quelles.

## Les skills ne sont pas optionnelles

Les skills ci-dessous ont été importées dans ce dépôt. Leurs descriptions
attendent des mots-clés que personne ne prononce à voix haute, et rien d'autre
ne les pousse : cette table est leur seul rappel. Les skills de méthode qui se
réinjectent d'elles-mêmes à chaque session n'ont pas besoin d'y figurer.

| À ce moment | Invoquer avant d'agir |
|---|---|
| écrire ou modifier un spec — **systématiquement, sans exception** | `clean-architecture` **et** `domain-driven-design`. C'est dans le spec que les frontières et le modèle se décident ; une revue externe a déjà dû réparer le §4 après coup, ça ne se refait pas |
| le plan d'une tranche vient d'être écrit, avant de l'exécuter | `clean-code` et `software-design-philosophy` — **relire le plan avec**, tant qu'un défaut de conception coûte encore une ligne et pas une tranche |
| dès que l'interface est en jeu — écran, composant, texte visible | `impeccable:impeccable` |
| avant de scaffolder une app, une lib, un projet | `nx-generate` |
| pour lancer un build, un test, un lint, un serve | `nx-run-tasks` |
| avant d'écrire ou de modifier `firestore.rules` | `firebase-firestore`, puis `firebase-security-rules-auditor` |
| avant de toucher à l'authentification | `firebase-auth-basics` |
| avant de décider où un bout de code atterrit, ou de créer une lib | `clean-architecture` |
| avant de modifier `libs/session` ou le modèle de domaine | `domain-driven-design` — pour **vérifier** qu'on ne défait pas le §4, jamais pour re-modéliser |

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

## La production, tu n'y touches pas

Il n'y a **qu'un seul projet Firebase** et **qu'un seul compte OVH**. Pas de
préproduction : la base que tu déploierais est celle où les joueurs jouent, et
les ressources que tu créerais sont facturées à quelqu'un.

Le déploiement se fait de deux façons, et tu n'es ni l'une ni l'autre : **à la
main**, par un humain qui déclenche le workflow, ou **par le système lui-même**
— le watchdog, les workflows, le semis idempotent.

Donc jamais, quelle que soit la raison :

- `firebase deploy`, sous aucune forme — règles, index, Functions, Hosting
- une écriture dans le Firestore de production, y compris un semis
- un appel à l'API OVH qui crée, modifie ou détruit une ressource réelle
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
**français**. Le glossaire qui fait le pont est au §4 du spec ; tout terme
visible dans l'interface doit y figurer.
