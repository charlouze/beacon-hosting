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

Ce fichier a déjà été périmé une fois par un changement d'hébergeur, une
seconde fois par l'arrivée d'un deuxième jeu, et une troisième par l'arrivée
des mondes. **Il ne nomme donc ni fournisseur ni jeu.** Les deux sont des
détails d'implémentation qui vivent dans `STACK.md` et dans le spec ; ce qui
reste vrai ici est qu'on héberge des serveurs de jeu à la demande.

## Users

Quelques groupes de trois ou quatre amis, chacun sur son monde, quelques
soirées par mois chacun. Groupe fermé, connu, sur liste blanche — pas
d'inscription libre. Depuis le 2026-09-15, plusieurs groupes jouent au même
jeu sans partager leur monde, et peuvent jouer le même soir.

Deux rôles seulement. **Player** : tout membre, y compris les non
techniciens. Un joueur doit pouvoir lancer une partie sans rien comprendre à
l'infrastructure. **Admin** : le propriétaire des comptes d'hébergement, qui
gère en plus la liste des membres, les réglages, le gabarit d'instance, et fait
naître les mondes depuis sa machine.

**Un membre est joueur d'un ou plusieurs mondes, ou d'aucun.** On entre dans un
monde par un lien d'invitation collé sur Discord, là où la soirée se décide ; on
en sort soi-même. Aucun joueur n'a d'autorité sur la session d'un autre : dans
un monde, n'importe lequel de ses joueurs démarre, prolonge ou arrête. La
ressource est commune à ceux qui la partagent.

## Product Purpose

Remplacer un serveur de jeu dédié facturé 7,90 €/mois en continu par un serveur
qui n'existe que pendant les sessions de jeu, en conservant les sauvegardes
entre deux parties. Depuis les mondes, la plateforme en fait naître autant qu'on
en adopte : deux machines un soir coûtent deux soirées, pas deux mois.

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
fragile de toutes les approches examinées. C'est aussi ce qui dispense d'un
plafond de machines : trois mondes lancés le même soir sont trois soirées
facturées, et chacune s'éteint seule.

L'état de l'art établi dans le spec (§2) n'a trouvé aucun équivalent : les
panels de jeu pilotent des machines allumées en permanence, les projets
Terraform n'ont ni interface ni échéance, et le seul hébergeur facturé à l'heure
identifié ne proposait pas le jeu du groupe.

## Operating Context

La soirée se décide sur Discord en début de soirée. Le lancement vient souvent
d'un téléphone, depuis le canapé ; la prolongation de fin de session se fait en
alt-tab depuis le jeu, sur le PC. **Les deux contextes portent des actions
différentes et comptent autant l'un que l'autre.**

C'est aussi sur Discord que circule le lien d'invitation d'un monde. Celui qui
l'ouvre, s'il est membre, devient joueur de ce monde ; un joueur qui invite
connaît l'adresse Discord de son ami, jamais son identifiant, et n'a rien
d'autre à connaître. Régénérer le lien met l'ancien hors d'usage, y compris la
copie qui traîne.

Quelques minutes séparent le clic du serveur jouable, et l'attente est
incompressible : le serveur se met en place à chaque démarrage. La durée varie
d'une session à l'autre — mesurée entre cinq et huit minutes — donc l'interface
annonce une fourchette d'heures de disponibilité, jamais une durée promise ni
une heure unique.

**Ce qu'il faut pour rejoindre dépend du jeu**, et c'est une contrainte de
conception, pas un détail. Certains jeux se rejoignent par une adresse — un nom
de domaine propre au monde dont l'IP change à chaque session, et l'IP brute
affichée à côté, exigence explicite du commanditaire parce que le DNS peut
échouer sans que la partie soit perdue. D'autres ne se rejoignent pas par une
adresse du tout, mais par un identifiant que le serveur produit à son démarrage
et qui change à chaque fois.

L'interface ne peut donc pas traiter « rejoindre » comme un champ fixe. Ce qui
est constant est le besoin : **le joueur doit pouvoir copier ce qu'il faut, et
disposer d'un recours si le moyen principal échoue.**

## Capabilities and Constraints

Ce que l'interface permet : voir la liste de ses mondes, chacun avec son état
et son décompte s'il tourne ; sur un monde, démarrer une session, la prolonger,
l'arrêter, et voir en temps réel l'état, le compte à rebours, ce qu'il faut pour
rejoindre et le coût estimé de la session en cours ; renommer le monde, copier
ou régénérer son lien d'invitation, le quitter. L'état est partagé — il change
simultanément chez tous les joueurs du monde, sans rechargement.

Réservé à l'admin : la liste des membres, les réglages, le choix du gabarit
d'instance. L'adoption et la restitution d'un monde se font depuis sa machine,
hors interface, parce que l'adoption est la seule opération du système qui
recouvre une sauvegarde.

Contraintes structurantes, détaillées dans le spec :

- L'instance est **détruite**, jamais éteinte. **Il n'existe pas d'état arrêté à
  coût nul** : une machine conservée garde son disque et son adresse, facturés
  tant qu'ils existent. Il n'y a donc pas de « serveur en pause » à dessiner.
- **Un monde ne tourne qu'une fois à la fois**, et c'est la seule limite :
  plusieurs mondes peuvent tourner le même soir, sans plafond de machines.
- **Le jeu est celui du monde**, figé à son adoption. Il ne se choisit plus à
  l'ouverture d'une session : c'est le monde qu'on choisit, et le jeu vient
  avec.
- **Le monde est la seule donnée irremplaçable**, et une sauvegarde en est un
  état. Rien ne détruit un monde, ni depuis l'écran ni depuis l'outil.
- **La sauvegarde du serveur suit une cadence, et rien ne permet de la forcer.**
  Selon le jeu, les dernières minutes d'une session peuvent manquer. L'interface
  ne doit donc jamais affirmer que tout est sauvegardé à l'instant.
- Authentification Google sur liste blanche, globale. Pas d'auto-inscription :
  un visiteur non autorisé existe et doit être traité, et un lien d'invitation
  ne fait rien pour lui.
- **Un joueur ne lit pas le profil d'un autre membre.** L'écran d'un monde
  compte ses joueurs sans les nommer, et n'affiche de l'ouvrant que l'heure.

Hors périmètre v1, à ne pas dessiner : les notifications hors de l'interface
(Discord, e-mail), la restauration d'une ancienne sauvegarde depuis l'interface,
l'adoption d'un monde depuis l'interface, des réglages par monde, la
suppression d'un monde.

**Langues.** L'interface et le code sont en anglais. Le spec et la
documentation restent en français. Le glossaire du spec (§4) fait le pont —
tout terme visible dans l'interface doit y figurer.

## Brand Commitments

Le produit s'appelle **Beacon** : un feu qu'on allume pour appeler les autres,
éteint après. Le nom raconte l'acte social — lancer le serveur, c'est convoquer
la soirée — plutôt que la machine.

L'app vit sur `beacon.charlouze.com`, et les serveurs de jeu sur
`<monde>.beacon.charlouze.com` quand le jeu se rejoint par une adresse. Un lien
d'invitation s'écrit `beacon.charlouze.com/join/<monde>/<code>`.

Aucun logo, aucune charte, aucun actif visuel n'existe à ce jour. Le monde
visuel retenu — The Departure Board — est un contrat de conception, dans
`.impeccable/DIRECTION.md`, pas une identité de marque.

## Evidence on Hand

- Le spec d'architecture, **validé le 2026-09-03 et révisé le 2026-09-15** :
  `docs/superpowers/specs/2026-09-02-game-hosting-design.md`.
  Il fait autorité sur l'architecture, le modèle de données et le vocabulaire.
- Le rapport de sonde `probe/RESULTS.md`, qui porte les seuls faits réellement
  mesurés du projet, avec les commandes qui les fondent — dont la durée de
  démarrage d'un serveur, entre cinq et huit minutes.
- **L'écran d'une session existe**, dans `apps/web`, livré par la tranche 5 ;
  les mondes, la liste et l'entrée par un lien sont dessinés et attendent
  leur tranche. Les trois tours de maquettes sont sous `.impeccable/mocks/`,
  chacun avec la trace de ce qu'il a retenu et écarté.
- Aucun logo ni actif de marque.
- Aucune recherche utilisateur au-delà du commanditaire, qui est lui-même un
  des joueurs.

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
2. **Personne n'est jamais bloqué.** N'importe quel joueur d'un monde le
   démarre, le prolonge et l'arrête, et y invite qui il veut. Aucune action de
   jeu ne dépend de la disponibilité de l'admin.
3. **L'échéance est une promesse, pas une sanction.** On sait toujours quand ça
   s'arrête, et on peut toujours prolonger tant qu'on est là.
4. **Tout est emprunté sauf la session.** Le conteneur, le cycle de vie de la
   VM, l'authentification, l'hébergement, le jeu lui-même : rien de tout cela
   n'est notre valeur. La session et son échéance, si. C'est aussi pourquoi ni
   le nom de l'hébergeur ni celui d'un jeu n'ont leur place dans ce document.
5. **Le monde est la seule chose qu'on protège.** Tout le reste du système
   est jetable par construction, et conçu pour l'être. Ce principe dit une
   priorité et non une garantie : ce qu'on peut réellement tenir dépend de ce
   que chaque jeu accepte d'écrire, et cette limite se mesure plutôt qu'elle ne
   se promet.
