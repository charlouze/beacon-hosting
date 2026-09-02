# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Nx monorepo, Angular, TypeScript de bout en bout. Firebase pour le plan de
contrôle : Hosting, Auth (Google), Firestore, Functions gen2, Cloud Scheduler.
OVH Public Cloud pour le serveur de jeu, OVH Object Storage pour les
sauvegardes, OVH DynHost pour le DNS. Choisi par le commanditaire, pas délégué.

## Users

Trois à quatre amis qui jouent à Enshrouded ensemble, quelques soirées par mois.
Groupe fermé, connu, sur liste blanche — pas d'inscription libre.

Deux rôles seulement. **Player** : tout le monde, y compris les non
techniciens. Un joueur doit pouvoir lancer une partie sans rien comprendre à
l'infrastructure. **Admin** : le propriétaire du compte OVH, qui gère en plus la
liste des membres, les réglages et le gabarit d'instance.

Aucun membre n'a d'autorité sur la session d'un autre : n'importe qui peut
démarrer, prolonger ou arrêter. La ressource est commune.

## Product Purpose

Remplacer un serveur Enshrouded dédié facturé 7,90 €/mois en continu par un
serveur qui n'existe que pendant les sessions de jeu, en conservant les
sauvegardes entre deux parties.

Réussite : le coût tombe à environ 1,75 €/mois pour 32 h jouées, et personne
n'est jamais empêché de jouer par le dispositif. Un échec coûteux serait un
serveur oublié allumé ; un échec grave serait une sauvegarde perdue.

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

Environ quatre minutes séparent le clic du serveur jouable, dont deux à trois de
téléchargement SteamCMD. Cette attente est incompressible et connue d'avance.

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

- L'instance est **détruite**, jamais éteinte. OVH facture une machine arrêtée.
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

- Le spec d'architecture, **en revue et non validé** :
  `docs/superpowers/specs/2026-09-02-game-hosting-design.md`.
  Il fait autorité sur l'architecture, le modèle de données et le vocabulaire.
- Aucun code, aucune interface existante, aucune capture.
- Aucun logo ni actif de marque.
- Aucune recherche utilisateur au-delà du commanditaire, qui est lui-même un
  des quatre joueurs.

Les chiffres de coût du spec (§11) sont des **estimations** dépendant de
vérifications encore ouvertes (§12). Ne jamais les présenter comme mesurés
tant que deux mois de facture réelle ne les ont pas confirmés.

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
   valeur. La session et son échéance, si.
5. **Une sauvegarde ne se perd jamais.** C'est la seule donnée irremplaçable du
   système ; tout le reste est jetable par construction.
