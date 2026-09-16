---
version: 1
slug: "apps-web-src-app-session-session-page-html"
primary_target: "apps/web/src/app/session/session.page.html"
related_targets: []
---

## Scope

L'écran d'un monde, sous `/worlds/{worldId}` depuis le 2026-09-15 : les cinq
états d'une session de jeu sur une seule page, plus ce que le monde possède
hors de toute session. Mode visiteur : **Operate**.

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

## Mise à jour du 2026-09-15 — le monde

Le tour des mondes (`.impeccable/mocks/worlds/`, planches E à H) ajoute à cet
écran, sans toucher au monde visuel :

- **Le nom du monde entre dans le bandeau** à la place du jeu, et `Beacon` y
  devient le retour vers la liste. Le pied discret gagne « Your worlds » à
  gauche de « Sign out ».
- **Le jeu se lit, il ne se choisit plus.** Figé à l'adoption (§4 du spec), il
  quitte le pied de l'écran hors service : le sélecteur disparaît, et le bouton
  n'a plus rien à choisir.
- **Une bande du monde sous les actions**, dans les trois colonnes du point de
  jonction : le nom et « Rename », le lien d'invitation avec « Copy » et
  « New link », les joueurs comptés — jamais nommés, le §5 l'interdit — et
  « Leave this world ». Elle ne bouge pas d'un état à l'autre, et elle est
  sous tout ce que le pouce cherche à 20 h ou à 23 h 30.
- **Renommer se fait sur place**, un champ à la place de la valeur, la borne
  du domaine en clair. **Un nouveau lien et quitter se confirment sur place**,
  dans leur colonne, avec la phrase qui dit ce qui va se passer — jamais dans
  une fenêtre.
- **Les petits boutons passent à 11 px**, `Copy` compris : 10 px est sous le
  plancher de lisibilité du texte fonctionnel.

## Contraintes du commanditaire

- **Rien de sombre.** Contrainte ferme, sur toute la surface.
- **Jamais une console cloud** : ni pastille de statut, ni identifiant
  d'instance mis en avant, ni jargon d'infrastructure.
- **Pendant l'attente de démarrage, l'interface libère** : elle annonce
  l'heure de disponibilité et rend l'utilisateur à sa soirée. Elle ne cherche
  jamais à retenir ni à occuper l'attente.
- **Le coût ne se compare jamais** au tarif du serveur dédié précédent, et
  aucune économie réalisée n'est affichée.

## Acquis de la comparaison

Deux trouvailles des mondes écartés méritent d'être reprises dans celui-ci si
l'occasion se présente, sans importer leur habillage :

- Du Call Board : la fenêtre de prolongation gagne à se lire comme une ligne de
  programme annoncée plutôt que comme la justification d'un bouton grisé.
  Adoptée en tranche 5.
- Du Watch Roster : l'historique des soirées avec l'ouvrant, le relevant et le
  coût par nuit raconte le groupe, et n'existe nulle part ailleurs.

## Non tranché

- La typographie. Les maquettes utilisent les polices système ; le choix
  définitif reste à faire.
- Le rouge de signalisation, qui peut virer au bleu sans rien casser d'autre.
- **L'heure annoncée au démarrage est une fourchette**, imposée par la mesure
  de `probe/RESULTS.md` §S — 4 min 49 s puis 7 min 58 s sur le même gabarit.
  Ce qui avait le droit de revenir avec la mesure, c'est un chiffre ; pas sa
  précision. L'ancienne note qui attendait cette mesure est périmée depuis la
  tranche 5.
