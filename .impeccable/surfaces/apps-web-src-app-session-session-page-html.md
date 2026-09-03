---
version: 1
slug: "apps-web-src-app-session-session-page-html"
primary_target: "apps/web/src/app/session/session.page.html"
related_targets: []
---

## Scope

L'écran unique de Beacon : les cinq états d'une session de jeu sur une seule
page. Mode visiteur : **Operate**.

## Audience et tâche

Trois à quatre amis, dont des non-techniciens. Deux scènes réelles et
distinctes, à traiter à égalité : le lancement depuis un téléphone vers 20 h
quand la soirée se décide, et la prolongation en alt-tab depuis le jeu vers
23 h 30. Sur desktop, le décompte et le bouton doivent être atteignables sans
lire.

L'état mène ; les actions disponibles découlent de l'état lu. Un seul écran sert
les cinq états au lieu de se retourner.

## Direction retenue

**The Departure Board** — horloge de gare et tableau à palettes. L'heure de
fermeture s'écrit comme une heure de départ. La matière est l'impression
elle-même : filets épais et fins en hiérarchie, capitales espacées, chiffres
tabulaires, un seul rouge. Aucun objet physique n'est dessiné en CSS — c'est ce
qui avait fait échouer la première tentative.

Moment mémorable : le décompte à 172 px sur écran large, dont les secondes
seules sont en rouge et sont la seule chose qui bouge de la page.

Directions écartées, conservées dans `.impeccable/mocks/decision/` :
The Lido Board et The Pay-and-Display (éliminées par relance), The Call Board et
The Watch Roster (construites en large, écartées après comparaison).

## Contraintes du commanditaire

- **Rien de sombre.** Contrainte ferme, sur toute la surface.
- **Jamais une console cloud** : ni pastille de statut, ni identifiant
  d'instance mis en avant, ni jargon d'infrastructure.
- **Pendant l'attente de démarrage, l'interface libère** : elle annonce
  l'heure de disponibilité et rend l'utilisateur à sa soirée. Elle ne cherche
  jamais à retenir ni à occuper l'attente. La durée, elle, n'est pas mesurée —
  voir *Non tranché*.
- **Le coût ne se compare jamais** au tarif du serveur dédié précédent, et
  aucune économie réalisée n'est affichée.

## Acquis de la comparaison

Deux trouvailles des mondes écartés méritent d'être reprises dans celui-ci si
l'occasion se présente, sans importer leur habillage :

- Du Call Board : la fenêtre de prolongation gagne à se lire comme une ligne de
  programme annoncée plutôt que comme la justification d'un bouton grisé.
- Du Watch Roster : l'historique des soirées avec l'ouvrant, le relevant et le
  coût par nuit raconte le groupe, et n'existe nulle part ailleurs.

## Non tranché

- La typographie. Les maquettes utilisent les polices système ; le choix
  définitif reste à faire.
- Le rouge de signalisation, qui peut virer au bleu sans rien casser d'autre.
- **La durée d'attente, retirée des maquettes le 2026-09-03.** La ligne disait
  « Environ quatre minutes. On t'annoncera l'heure exacte. » — une prédiction
  que rien ne fondait : le débit réel de SteamCMD depuis l'instance n'est pas
  mesuré (§12 du spec), et l'estimation avait été écrite pour un hébergeur que
  le projet a quitté. Elle portait donc sur une machine qui n'est plus celle
  qu'on démarre.

  Seule la seconde phrase reste, dans les quatre maquettes concernées. Elle
  suffit : la contrainte ferme demande que l'interface annonce l'heure et
  libère, pas qu'elle chiffre l'attente — et une promesse sans chiffre
  invérifiable est plus forte, pas plus faible.

  **Un chiffre revient quand la mesure existe.** La tâche 6 de la tranche 0 la
  relève sur une vraie session et écrit la valeur dans `probe/RESULTS.md`, sous
  « Durée de démarrage à annoncer dans l'interface ». C'est cette valeur-là, et
  aucune autre, qui a le droit de remonter dans la copie.

  **À ne pas confondre avec `Prêt vers 20:18`**, qui reste. Cette ligne-là est
  l'annonce que la contrainte ferme *exige* — l'interface annonce l'heure de
  disponibilité et rend l'utilisateur à sa soirée. La retirer casserait la
  contrainte. Ce qui attend la mesure est la **valeur** derrière l'heure
  affichée, pas la ligne qui l'affiche : dans les maquettes, `20:18` est une
  donnée d'exemple comme les autres.

  La différence tient en un mot : la phrase retirée promettait avant le clic,
  celle-ci constate après. On peut annoncer une heure qu'on tient d'un calcul ;
  on ne peut pas promettre une durée qu'on n'a jamais mesurée.
