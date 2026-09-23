# infrastructure

## Boundary

Ce module porte **ce que le système suppose en place pour tourner, et ce qui
fait que ce qui tourne est ce qu'on a voulu** : le compte sur lequel Beacon vit,
la façon dont on le déclare et dont on prouve qu'il se reconstruit, la mise en
production, et ce qui prévient l'administrateur quand le système cesse de se
tenir seul.

Il couvre ce que le compte porte et ce qu'il ne revendique jamais, la mise en
place du compte et ce qu'elle a le droit de faire, la reconstruction sur un
compte vide, la mise en production et ce qui la garde, les identifiants que le
système confie et à qui, ce qui ramène un onglet ouvert sur le code en
production, et ce qui prévient l'administrateur.

**Il déclare le contenant, jamais le contenu.** Ce qui s'écrit dans le compte
pendant que le système tourne n'est pas à lui : ni ce qui naît et meurt avec une
session, ni ce qu'un serveur de jeu a le droit de toucher (`session`), ni les
mondes, leurs sauvegardes et ce que la règle de durée du stockage en retire
(`monde`), ni qui est membre (`membre`).

## Ubiquitous language

Les noms de code sont en anglais alors que la langue métier est le français :
l'expert du domaine lit lui-même le code, donc il n'y a pas de fossé de
traduction à combler.

**Ce tableau nomme les concepts du domaine, et rien d'autre.** Un libellé, un
titre ou un message ne sont pas des concepts : ils habillent un concept déjà
nommé ici, ou ils n'en portent aucun.

Un concept qu'on peine à nommer dans les deux colonnes est le signe que le
modèle est faux, pas que la traduction est difficile.

| Métier | Code | Ce que c'est |
|---|---|---|
| compte | — | tout ce qui survit à toutes les sessions et que le système suppose en place avant de tourner |
| déclaration du compte | `WANTED` | ce que le compte doit porter, écrit dans le dépôt |
| écart | `gap` | ce qui sépare ce que le compte porte de ce qui est déclaré |
| mise en place | `deploy-setup` | le geste qui comble l'écart |
| mise en production | — | la fusion d'une pull request dans `main` |
| version en production | `rulesVersion` | la version du code que la dernière mise en production a publiée |

### Ce que ce contexte emprunte, et ce qu'il en connaît

**Ce contexte a son propre modèle des objets qu'il touche, réduit à ce dont il
se sert** — et c'est délibéré : si leur définition bouge ailleurs, c'est ici
qu'on verra si elle bouge aussi pour lui, au lieu de l'apprendre par une panne.

| Terme | Ce que ce contexte en connaît, et rien de plus |
|---|---|
| `Session` (`docs/specs/session.md`) | ce qui naît et meurt dans le compte sans que personne le déclare. Ce contexte sait seulement qu'une session tient certaines garanties sans attendre personne, et qu'il faut savoir quand elles cessent d'être tenues |
| `Save` (`docs/specs/monde.md`) | du contenu, écrit dans un seau que le compte déclare. Ce contexte ne l'écrit, ne le lit et ne le retire jamais |
| `Member` (`docs/specs/membre.md`) | une personne autorisée. Ce contexte ne connaît que l'administrateur : celui qui détient le compte, reçoit ses alertes et fait ses gestes humains |

## What the account holds

**Ce qui survit à toutes les sessions est le compte, et le compte se déclare :
il ne se manipule pas à l'exécution.** La durée de vie est le critère, et il
tranche tous les cas sans qu'on ait à les énumérer.

**La frontière porte sur qui crée la ressource, jamais sur qui écrit dedans.**
Une sauvegarde survit à sa session et le système l'écrit pourtant à chaque fois :
elle est du contenu. Le seau qui la contient est la ressource, et le seau est au
compte. Ce qui limite ce qu'une ressource laisse faire, et la règle de durée qui
finit par en retirer du contenu, sont des attributs de la ressource, donc du
compte.

**Le compte ne revendique jamais ce qui naît et meurt avec une session.** Deux
mécanismes sur le même objet se le disputent, et celui qui tourne en boucle
gagne contre celui qu'on lance — après l'avoir fait échouer.

**Un enregistrement de domaine se déclare en existence, jamais en valeur.**
L'enregistrement survit à toutes les sessions : c'est le compte. L'adresse qu'il
porte est réécrite à chaque session : c'est la session. Déclarer l'adresse
repointerait le sous-domaine vers une session morte pendant qu'une autre tourne.

## Setting up the account

**La mise en place ne détruit jamais une ressource.** Elle déclare le contenant,
jamais le contenu : il n'existe aucun chemin par lequel un changement de nom
emporte un seau et les mondes qu'il contient.

**On sait toujours, sans rien modifier, en quoi le compte diffère de sa
déclaration.** L'écart se lit sans écrire, et relancée sur un compte conforme,
la mise en place ne propose rien. La question à laquelle elle répond le plus
souvent n'est pas « comment installer », qui n'arrive qu'une fois, mais « est-ce
que c'est toujours bien posé ».

**L'écart porte sur ce qui est déclaré.** Ce qui diverge d'un attribut déclaré
est signalé ; une ressource qui existe sans être déclarée ne l'est pas. Pour un
compte d'une vingtaine de ressources connues, c'est le bon marché.

**Rien ne se pose sur le compte sans que l'administrateur y ait consenti, geste
par geste**, en lisant ce qui manque et ce que le geste va faire. Un seul
consentement pour treize droits d'administration, ce sont treize décisions que
personne n'a prises. Une mise en place partielle le dit, et ne ressemble jamais
à une mise en place complète.

**Quatre choses restent des gestes humains, et ce n'est pas un manque** :

- **la mise en production**, parce qu'elle est une décision ;
- **la valeur des secrets** : un mécanisme capable de les reconstituer seul
  serait un mécanisme qui les détient ;
- **l'identifiant qui met à jour le domaine** : l'adopter demanderait de le
  recréer, donc d'en changer le mot de passe, et la session en cours perdrait
  sa mise à jour au passage ;
- **le premier administrateur** : rien d'antérieur à sa première connexion ne
  peut le nommer.

## Rebuilding the account

**Beacon se réinstalle sur un compte vide par une suite de gestes écrits, en un
temps connu.** Pas pour changer de compte — il n'y en a qu'un —, mais parce que
c'est le seul énoncé qui se vérifie : une déclaration qui décrit un compte déjà
conforme ne prouve rien, la même sur un compte vide prouve tout.

**Tout ce que le compte porte est déclaré dans le dépôt**, hormis les gestes
humains de la section précédente. Un geste de console ne laisse aucune trace
rejouable, et le jour où il est fait de travers, personne ne s'en aperçoit.

## Putting into production

**Mettre en production, c'est fusionner une pull request dans `main`.** Ce n'est
jamais déclencher quoi que ce soit d'autre. `main` est donc égal à ce qui tourne
pour tout ce qui se déploie, et personne ne peut oublier de déployer. Il n'y a
qu'un environnement : ce qui part en production touche directement ce dont les
joueurs se servent.

> [!NOTE]
> Rien n'empêche un déploiement lancé depuis un poste. C'est un chemin sans
> revue qu'on sait exister, pas une seconde voie de mise en production.

**`main` n'accepte rien qui ne soit passé par une pull request vérifiée** : pas
de poussée directe, pas de fusion dont les vérifications sont rouges. Sans cela,
tout ce qui garde la mise en production se contourne d'une poussée.

**Ce qui part en production est vérifié tel quel.** Deux branches vertes
séparément peuvent produire une fusion rouge : c'est le résultat de la fusion
qui est vérifié avant de partir, pas seulement la pull request.

**La mise en production s'arrête au premier échec**, et les règles d'accès ne
partent jamais si leurs refus ne sont pas vérifiés.

**Une fusion qui n'a rien à publier ne met rien en production.** La publier
republierait l'identique, et ferait recharger tous les onglets ouverts pour une
virgule dans un document. `main` peut donc porter une documentation plus récente
que ce qui tourne. Ce que ça coûte : une telle fusion ne répare pas une mise en
production précédente qui aurait échoué.

**Toute pull request est vérifiée, documentaire comprise.** Le filtre porte sur
la mise en production, jamais sur la vérification.

**Une pull request ne touche aucun compte réel.** Ce qui s'éprouve contre le
compte d'hébergement se lance depuis le poste d'un développeur, jamais depuis
l'environnement qui vérifie une pull request.

**Le système n'a aucun paramètre d'installation.** La première mise en
production donne un système déployé et sans aucun membre, et c'est un état
normal, pas une panne.

**Une mise en production pose les réglages d'un système qui n'en a aucun, et ne
modifie jamais ceux qui existent**, sauf les valeurs qu'elle est seule à
connaître.

## What runs is what was verified

**Toute image de conteneur que le système fait tourner est désignée par une
référence immuable** : celles que Beacon construit comme celles qu'il emprunte.
Changer de version est un commit, jamais un effet de bord, et on sait toujours
dire après coup quelle version a tourné.

**L'image que Beacon construit pour ses serveurs de jeu se publie par un geste
explicite, jamais par une fusion**, et ne se publie que si elle a démarré avant.

## Credentials

**Aucun identifiant d'hébergeur n'est confié à l'hébergement du code** — ni au
dépôt, ni à ce qui y vérifie ou y déploie. Il vit dans le plan de contrôle, lu
par ce qui en a besoin. Une copie ailleurs serait un second coffre à protéger,
avec un modèle de menace différent et une surface plus large.

**La mise en production ne détient aucune clé de longue durée.** Elle prouve son
identité à chaque fois.

**La valeur d'un secret du compte est saisie par un humain, et rien ne la
retient au passage** : ni un fichier, ni une ligne de commande, ni l'état d'un
outil.

## Open tabs follow production

**Un onglet ouvert ne reste pas sur un code plus ancien que celui qui tourne.**
Quand une mise en production change le code, tout onglet ouvert se recharge de
lui-même, sans que personne ait à le faire. Sinon un onglet ouvert la veille
calcule avec les règles d'hier contre le système d'aujourd'hui, et le joueur
voit un bouton qui marche puis un effet qui s'évapore.

**La règle vaut pour tout ce que le navigateur calcule**, quel que soit le
module dont la règle a changé.

**Seule la mise en production écrit la version en production, et l'adresse à
laquelle un serveur de jeu rapporte.** Personne d'autre, administrateur
compris : écrire la première désynchroniserait tous les onglets, écrire la
seconde redirigerait l'endroit où les serveurs rapportent.

## Warning the administrator

**Quand ce qui tient les garanties d'une session sans attendre personne cesse
de tourner, l'administrateur est prévenu.** Une alerte de dépense mesure le
dégât une fois qu'il est fait ; celle-ci mesure la panne.

**Une dépense chez l'hébergeur qui dépasse ce qu'on attend prévient
l'administrateur.** C'est le garde-fou de dernier recours, quand tout le reste a
manqué.

**Ces alertes vont à l'administrateur, hors de l'application, et jamais aux
joueurs.** Un bandeau « le système ne se surveille plus » sur l'écran des
joueurs n'apprendrait rien d'actionnable à quelqu'un qui veut juste jouer.

## Changelog

| batch | date | change |
|---|---|---|
