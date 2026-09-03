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

Ce fichier a déjà été périmé une fois par un changement d'hébergeur ; il n'en
nomme plus aucun.

## Users

Trois à quatre amis qui jouent à Enshrouded ensemble, quelques soirées par mois.
Groupe fermé, connu, sur liste blanche — pas d'inscription libre.

Deux rôles seulement. **Player** : tout le monde, y compris les non
techniciens. Un joueur doit pouvoir lancer une partie sans rien comprendre à
l'infrastructure. **Admin** : le propriétaire des comptes d'hébergement, qui
gère en plus la liste des membres, les réglages et le gabarit d'instance.

Aucun membre n'a d'autorité sur la session d'un autre : n'importe qui peut
démarrer, prolonger ou arrêter. La ressource est commune.

## Product Purpose

Remplacer un serveur Enshrouded dédié facturé 7,90 €/mois en continu par un
serveur qui n'existe que pendant les sessions de jeu, en conservant les
sauvegardes entre deux parties.

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
identifié ne propose pas Enshrouded.

## Operating Context

La soirée se décide sur Discord en début de soirée. Le lancement vient souvent
d'un téléphone, depuis le canapé ; la prolongation de fin de session se fait en
alt-tab depuis le jeu, sur le PC. **Les deux contextes portent des actions
différentes et comptent autant l'un que l'autre.**

Quelques minutes séparent le clic du serveur jouable : le jeu se télécharge par
SteamCMD à chaque démarrage, et l'attente est incompressible. **Sa durée n'est
pas mesurée** — l'estimation d'origine, environ quatre minutes, a été écrite
avant que l'hébergeur change et n'a jamais été confrontée à une vraie session.
L'interface ne doit donc pas l'annoncer comme une promesse tant que la tranche 0
ne l'a pas relevée.

Le serveur se rejoint par `enshrouded.beacon.charlouze.com`, dont l'IP change à
chaque session. Afficher aussi l'IP brute est une exigence explicite du
commanditaire : le DNS peut échouer sans que la partie soit perdue.

## Capabilities and Constraints

Ce que l'interface permet : démarrer une session, la prolonger, l'arrêter, et
voir en temps réel l'état, le compte à rebours, le nom de domaine, l'IP brute,
le coût estimé de la session en cours et le cumul du mois. L'état est partagé —
il change simultanément chez tout le monde, sans rechargement.

Réservé à l'admin : la liste des membres, les réglages, le choix du gabarit
d'instance.

Contraintes structurantes, détaillées dans le spec :

- L'instance est **détruite**, jamais éteinte. **Il n'existe pas d'état arrêté à
  coût nul** : une machine conservée garde son disque et son adresse, facturés
  tant qu'ils existent. Il n'y a donc pas de « serveur en pause » à dessiner.
- Un seul serveur à la fois. Le modèle ne prévoit pas de sessions parallèles.
- Enshrouded seulement en v1.
- Authentification Google sur liste blanche. Pas d'auto-inscription : un
  visiteur non autorisé existe et doit être traité.

Hors périmètre v1, à ne pas dessiner : les autres jeux, les notifications hors
de l'interface (Discord, e-mail), la restauration d'une ancienne sauvegarde
depuis l'interface, plusieurs serveurs simultanés.

**Langues.** L'interface et le code sont en anglais. Le spec et la
documentation restent en français. Le glossaire du spec (§4) fait le pont —
tout terme visible dans l'interface doit y figurer.

## Brand Commitments

Le produit s'appelle **Beacon** : un feu qu'on allume pour appeler les autres,
éteint après. Le nom raconte l'acte social — lancer le serveur, c'est convoquer
la soirée — plutôt que la machine.

L'app vit sur `beacon.charlouze.com`, les serveurs de jeu sur
`<jeu>.beacon.charlouze.com`.

Aucun logo, aucune charte, aucun actif visuel n'existe à ce jour.

## Evidence on Hand

- Le spec d'architecture, **validé le 2026-09-03** :
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
   VM, l'authentification, l'hébergement : rien de tout cela n'est notre
   valeur. La session et son échéance, si. C'est aussi pourquoi le nom de
   l'hébergeur n'a pas sa place dans ce document.
5. **Une sauvegarde ne se perd jamais.** C'est la seule donnée irremplaçable du
   système ; tout le reste est jetable par construction.
