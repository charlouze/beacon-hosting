# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Nx monorepo, Angular, TypeScript de bout en bout. Firebase pour le plan de
contrôle : Hosting, Auth (Google), Firestore, Functions gen2, Cloud Scheduler.
Choisi par le commanditaire, pas délégué.

Le serveur de jeu tourne chez **un hébergeur français facturé à l'heure**, et
ses sauvegardes dans un stockage objet de la même région. Le nom du fournisseur
n'est pas ici : il vit dans `STACK.md`, qui fait autorité là-dessus. Ce qui
compte au niveau produit est la facturation à l'heure — c'est elle qui rend le
serveur éphémère possible — et le fait qu'il soit français, la souveraineté des
données de jeu étant une contrainte du commanditaire.

Ce fichier a déjà été périmé une fois par un changement d'hébergeur, et une
seconde fois par l'arrivée d'un deuxième jeu. **Il ne nomme donc ni fournisseur
ni jeu.** Les deux sont des détails d'implémentation qui vivent dans `STACK.md`
et dans le spec ; ce qui reste vrai ici est qu'on héberge des serveurs de jeu à
la demande.

## Users

Trois à quatre amis qui jouent ensemble, quelques soirées par mois. Groupe
fermé, connu, sur liste blanche — pas d'inscription libre.

Deux rôles seulement. **Player** : tout le monde, y compris les non
techniciens. Un joueur doit pouvoir lancer une partie sans rien comprendre à
l'infrastructure. **Admin** : le propriétaire des comptes d'hébergement, qui
gère en plus la liste des membres, les réglages et le gabarit d'instance.

Aucun membre n'a d'autorité sur la session d'un autre : n'importe qui peut
démarrer, prolonger ou arrêter. La ressource est commune.

## Product Purpose

Remplacer un serveur de jeu dédié facturé 7,90 €/mois en continu par un serveur
qui n'existe que pendant les sessions de jeu, en conservant les sauvegardes
entre deux parties.

Réussite : la dépense mensuelle passe très en dessous de cette référence, et
personne n'est jamais empêché de jouer par le dispositif. Un échec coûteux
serait un serveur oublié allumé ; un échec grave serait une sauvegarde perdue.

Le montant exact n'est pas un fait de ce document : il dépend des grilles
tarifaires, qui bougent. Le spec le chiffre au §11, et c'est là qu'il se met à
jour.

## Positioning

Le mécanisme qu'un produit voisin ne pourrait pas copier de bonne foi : la
**session naît avec son heure de fin**. Quatre heures par défaut, prolongeable
d'une heure autant de fois qu'on veut mais uniquement dans les trente dernières
minutes.

Ce n'est pas une limite de durée, c'est l'obligation qu'un humain éveillé
reclique. Une machine oubliée s'arrête donc toujours dans l'heure — sans jamais
avoir à détecter la présence des joueurs, ce qui était le composant le plus
fragile de toutes les approches examinées.

L'état de l'art établi dans le spec (§2) n'a trouvé aucun équivalent : les
panels de jeu pilotent des machines allumées en permanence, les projets
Terraform n'ont ni interface ni échéance, et le seul hébergeur facturé à l'heure
identifié ne proposait pas le jeu du groupe.

## Operating Context

La soirée se décide sur Discord en début de soirée. Le lancement vient souvent
d'un téléphone, depuis le canapé ; la prolongation de fin de session se fait en
alt-tab depuis le jeu, sur le PC. **Les deux contextes portent des actions
différentes et comptent autant l'un que l'autre.**

Quelques minutes séparent le clic du serveur jouable, et l'attente est
incompressible : le serveur se met en place à chaque démarrage. La durée varie
d'une session à l'autre — l'interface annonce donc une heure de disponibilité,
jamais une durée promise.

**Ce qu'il faut pour rejoindre dépend du jeu**, et c'est une contrainte de
conception, pas un détail. Certains jeux se rejoignent par une adresse — un nom
de domaine dont l'IP change à chaque session, et l'IP brute affichée à côté,
exigence explicite du commanditaire parce que le DNS peut échouer sans que la
partie soit perdue. D'autres ne se rejoignent pas par une adresse du tout, mais
par un identifiant que le serveur produit à son démarrage et qui change à chaque
fois.

L'interface ne peut donc pas traiter « rejoindre » comme un champ fixe. Ce qui
est constant est le besoin : **le joueur doit pouvoir copier ce qu'il faut, et
disposer d'un recours si le moyen principal échoue.**

## Capabilities and Constraints

Ce que l'interface permet : choisir le jeu et démarrer une session, la
prolonger, l'arrêter, et voir en temps réel l'état, le compte à rebours, ce
qu'il faut pour rejoindre, le coût estimé de la session en cours et le cumul du
mois. L'état est partagé — il change simultanément chez tout le monde, sans
rechargement.

Réservé à l'admin : la liste des membres, les réglages, le choix du gabarit
d'instance.

Contraintes structurantes, détaillées dans le spec :

- L'instance est **détruite**, jamais éteinte. **Il n'existe pas d'état arrêté à
  coût nul** : une machine conservée garde son disque et son adresse, facturés
  tant qu'ils existent. Il n'y a donc pas de « serveur en pause » à dessiner.
- Un seul serveur à la fois, donc **un seul jeu à la fois**. Le modèle ne prévoit
  pas de sessions parallèles.
- **Le jeu se choisit à l'ouverture de la session**, par n'importe quel membre,
  et ne change plus jusqu'à la fin. Ce n'est pas un réglage d'administrateur :
  celui qui lance la soirée décide à quoi on joue.
- **La sauvegarde du serveur suit une cadence, et rien ne permet de la forcer.**
  Selon le jeu, les dernières minutes d'une session peuvent manquer. L'interface
  ne doit donc jamais affirmer que tout est sauvegardé à l'instant.
- Authentification Google sur liste blanche. Pas d'auto-inscription : un
  visiteur non autorisé existe et doit être traité.

Hors périmètre v1, à ne pas dessiner : les notifications hors de l'interface
(Discord, e-mail), la restauration d'une ancienne sauvegarde depuis l'interface,
plusieurs serveurs simultanés.

**Langues.** L'interface et le code sont en anglais. Le spec et la
documentation restent en français. Le glossaire du spec (§4) fait le pont —
tout terme visible dans l'interface doit y figurer.

## Brand Commitments

Le produit s'appelle **Beacon** : un feu qu'on allume pour appeler les autres,
éteint après. Le nom raconte l'acte social — lancer le serveur, c'est convoquer
la soirée — plutôt que la machine.

L'app vit sur `beacon.charlouze.com`, et les serveurs de jeu sur
`<jeu>.beacon.charlouze.com` quand le jeu se rejoint par une adresse.

Aucun logo, aucune charte, aucun actif visuel n'existe à ce jour.

## Evidence on Hand

- Le spec d'architecture, **validé le 2026-09-03 et révisé le 2026-09-05** :
  `docs/superpowers/specs/2026-09-02-game-hosting-design.md`.
  Il fait autorité sur l'architecture, le modèle de données et le vocabulaire.
- Le rapport de sonde `probe/RESULTS.md`, qui porte les seuls faits réellement
  mesurés du projet à ce jour, avec les commandes qui les fondent.
- Du code de sonde jetable dans `probe/`, et deux artefacts de déploiement dans
  `deploy/`. **Aucune interface, aucun écran, aucune capture** : rien de visuel
  n'existe encore.
- Aucun logo ni actif de marque.
- Aucune recherche utilisateur au-delà du commanditaire, qui est lui-même un
  des quatre joueurs.

Les chiffres de coût du spec (§11) sont des **tarifs lus sur des grilles
publiques**, pas des mesures. Ne jamais les présenter comme mesurés tant que
deux mois de facture réelle ne les ont pas confirmés.

**Un spec validé n'est pas un spec vérifié.** Le projet en a fait l'expérience
le jour même de la validation : une hypothèse d'infrastructure est tombée à la
première mesure, et l'hébergeur a changé. Ce qui n'est pas dans
`probe/RESULTS.md` n'est pas mesuré.

## Product Principles

1. **Le coût est un fait affiché, jamais un argument.** La dépense de la session
   et celle du mois sont visibles parce que ce sont des faits utiles.
   L'interface ne compare **jamais** au tarif du serveur dédié précédent et
   n'affiche aucune économie réalisée. Ce chiffre a justifié le projet ; il n'a
   rien à dire à quelqu'un qui veut jouer ce soir, et une interface qui plaide
   sa propre utilité finit par culpabiliser l'usage qu'elle sert.
2. **Personne n'est jamais bloqué.** N'importe quel membre démarre, prolonge et
   arrête. Aucune action de jeu ne dépend de la disponibilité de l'admin.
3. **L'échéance est une promesse, pas une sanction.** On sait toujours quand ça
   s'arrête, et on peut toujours prolonger tant qu'on est là.
4. **Tout est emprunté sauf la session.** Le conteneur, le cycle de vie de la
   VM, l'authentification, l'hébergement, le jeu lui-même : rien de tout cela
   n'est notre valeur. La session et son échéance, si. C'est aussi pourquoi ni
   le nom de l'hébergeur ni celui d'un jeu n'ont leur place dans ce document.
5. **La sauvegarde est la seule chose qu'on protège.** Tout le reste du système
   est jetable par construction, et conçu pour l'être. Ce principe dit une
   priorité et non une garantie : ce qu'on peut réellement tenir dépend de ce
   que chaque jeu accepte d'écrire, et cette limite se mesure plutôt qu'elle ne
   se promet.
