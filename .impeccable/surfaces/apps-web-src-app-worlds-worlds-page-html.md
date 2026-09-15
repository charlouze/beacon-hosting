---
version: 1
slug: "apps-web-src-app-worlds-worlds-page-html"
primary_target: "apps/web/src/app/worlds/worlds.page.html"
related_targets: ["apps/web/src/app/join/join.page.html"]
---

## Scope

La liste de mes mondes, premier écran de Beacon depuis le 2026-09-15, et la
page d'entrée par un lien `/join/{worldId}/{code}` qui y renvoie. Mode
visiteur : **Operate**.

## Audience et tâche

Un membre qui joue dans un ou plusieurs mondes — trois ou quatre amis par
monde, plusieurs groupes sur le même jeu. Il ouvre `beacon.charlouze.com`
depuis son téléphone vers 20 h pour savoir si quelque chose tourne et lancer
son monde, ou depuis le PC en alt-tab pour retrouver le bon tableau. Un membre
sans monde voit la liste vide et la phrase qui dit de demander un lien.

Chaque bande est le lien vers le monde ; il n'y a pas d'action primaire sur
cette page. Le cumul du mois n'y est pas : la face client ne lit pas `events`
avant la tranche 8.

## Direction retenue

Le monde visuel ne rejoue pas — **The Departure Board**, contrat dans
`../DIRECTION.md`. Ce tour n'a choisi qu'une composition : **l'index des
noms**, une bande par monde, retenue le 2026-09-15 contre une colonne par
monde et les lignes du tableau, toutes deux construites et conservées dans
`../mocks/worlds/`.

## Direction contract

THESIS: Mes mondes est un tableau des départs à plusieurs lignes. Le nom du
monde mène, l'état et l'heure le suivent, et le bandeau dit s'il y a quelque
chose en service avant qu'on lise une ligne. Refuse la grille de cartes à
vignette, pastille et bouton « Ouvrir » par carte.

OWN-WORLD: Celui de DIRECTION.md, sans rien de neuf — papier chaud, encre, un
seul rouge pour les secondes, filets en trois poids, capitales espacées,
chiffres tabulaires. Une bande est un espace entre deux filets fins, jamais un
cadre.

STORY: Le membre lit en une seconde lequel de ses mondes tourne et jusqu'à
quand, touche la bande et arrive sur son tableau. Sans monde, il lit qu'il lui
faut un lien, et à qui le demander.

FIRST VIEWPORT: Bandeau « Beacon · Your worlds » et, à droite, l'état de
l'ensemble — « 1 in service », « No world yet » ; filet de 4 px. Puis une bande
par monde, séparées de filets de 1 px et centrées entre le filet et le pied :
le nom à 72 px en large et 34 px sur téléphone, dessous la pastille, l'état,
le jeu et le nombre de joueurs ; à droite en large, dessous sur téléphone, le
temps restant à 34 px en chiffres tabulaires avec les secondes en rouge et
l'heure de fermeture — ou la fourchette « Ready between », ou « Next session ·
4 h once opened ». Pied discret : « Sign out ». `/join` n'a que deux visages,
« Taking you in. » puis la redirection, et « This link doesn't open anything
any more. » avec un bouton fantôme vers la liste.

FORM: L'index des noms, candidat 6 d'une liste de sept structures ordonnée par
résonance avec le tableau de gare, servi par le tirage et choisi par le
commanditaire contre le candidat de tête. Seed e4199fec.

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance

## Non tranché

- La typographie, toujours sur les polices système. Un tour à elle seule.
- Ce que `/join` fait pour un visiteur non membre : la porte de la tranche 5
  s'applique, la règle refuse, et l'écran du lien périmé ne le distingue pas
  d'un code faux. À confirmer au plan.
